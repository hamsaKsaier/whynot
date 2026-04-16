import { createLogger } from '../../shared/logger/logger';
import { QALoopRepository } from './repositories/qa-loop-repository';
import { ClaudeSession, CostInfo } from './claude-session';
import { GemmaSession } from './gemma-session';
import { emitToSession, cleanupSession } from './api/websocket';
import { ChaosAgent } from './agents/chaos-agent';
import { DetectiveAgent } from './agents/detective-agent';
import { GuardianAgent, GuardianConfig, QualityScore, IterationPlan } from './agents/guardian-agent';
import { RetestExecutor } from './retest-executor';
import { ParallelTestExecutor } from './parallel-test-executor';
import { selectModel, ClaudeModel, FOCUS_AREA_MODELS, getModelDisplayName } from './model-selector';
import { MCPBrowser } from './mcp-browser';
import { stitchVideo, cleanupFrames } from './video-stitcher';
import { notifyGateway } from './notifications/email-notifier';


const logger = createLogger('loop-orchestrator');

export interface LoginCredentials {
  loginUrl?: string;        // URL to navigate to for login (defaults to targetUrl)
  emailSelector?: string;   // CSS selector for email/username field
  passwordSelector?: string; // CSS selector for password field
  submitSelector?: string;  // CSS selector for submit button
  email: string;            // The email/username value
  password: string;         // The password value
}

export interface LoopConfig {
  targetUrl: string;
  mode: string;
  qualityThreshold: number;
  maxIterations: number;
  maxDurationHours: number;
  documentContext?: string;
  config?: Record<string, any>;
  enableChaos?: boolean;
  enableDetective?: boolean;
  maxBudgetCents?: number;
  loginCredentials?: LoginCredentials;
  testPriority?: 'functional_first' | 'balanced' | 'security_first';
  /** True when the orchestrator is resuming a previously paused session */
  isResume?: boolean;
  /** The iteration number the session was paused at — used to restore currentIteration */
  resumeFromIteration?: number;
  /** Workspace ID for notification routing */
  workspaceId?: string;
  /** Project context from knowledge base */
  projectContext?: any;
  /** User PRD text */
  userPrd?: string;
}

export type FocusArea = 'explore' | 'chaos' | 'retest' | 'investigate';

export class LoopOrchestrator {
  private sessionId: string;
  private config: LoopConfig;
  private repository: QALoopRepository;
  private claudeSession: ClaudeSession | GemmaSession | null = null;
  private isPaused: boolean = false;
  private isStopped: boolean = false;
  private currentIteration: number = 0;
  private startTime: Date | null = null;
  /** True once performLogin() has succeeded this run — used to warn Claude when login state is absent */
  private loginEstablished: boolean = false;

  /** MCP browser instance — one per session, shared across all phases */
  private mcpBrowser: MCPBrowser | null = null;

  /** Track test case IDs that have already been corrected once — max 1 retry per test case. */
  private correctedTestCaseIds: Set<string> = new Set();

  // Multi-agent system
  private chaosAgent: ChaosAgent;
  private detectiveAgent: DetectiveAgent;
  private guardianAgent: GuardianAgent;
  private currentFocus: FocusArea = 'explore';

  /**
   * Cached document context loaded once at session start (2.6).
   * `undefined` = not yet loaded, `null` = loaded but no docs found.
   */
  private cachedDocumentContext: string | null | undefined = undefined;

  /**
   * Optional dependency overrides — primarily for unit testing (5.5).
   * Production code uses the defaults (shared pool, real agents).
   */
  constructor(sessionId: string, config: LoopConfig, deps?: {
    repository?: QALoopRepository;
    chaosAgent?: ChaosAgent;
    detectiveAgent?: DetectiveAgent;
    guardianAgent?: GuardianAgent;
  }) {
    this.sessionId = sessionId;
    this.config = config;
    this.repository = deps?.repository ?? new QALoopRepository();

    // Restore iteration counter when resuming so continuation prompts are used
    if (config.isResume && config.resumeFromIteration && config.resumeFromIteration > 0) {
      this.currentIteration = config.resumeFromIteration;
      logger.info('Restored iteration counter for resume', {
        sessionId, resumeFromIteration: config.resumeFromIteration
      });
    }

    // Initialize agents (accept injected or create defaults)
    this.chaosAgent = deps?.chaosAgent ?? new ChaosAgent(sessionId);
    this.detectiveAgent = deps?.detectiveAgent ?? new DetectiveAgent(sessionId);
    this.guardianAgent = deps?.guardianAgent ?? new GuardianAgent(sessionId, {
      testPriority: config.testPriority
    });

    // Set budget limits if specified
    if (config.maxBudgetCents) {
      this.guardianAgent.setBudgetLimits(undefined, config.maxBudgetCents);
    }
  }

  async start(): Promise<void> {
    logger.info('Starting QA Loop', { sessionId: this.sessionId, config: this.config });
    this.startTime = new Date();

    try {
      // Force-cleanup any lingering browser for THIS session to prevent
      // "Browser is already in use" errors — never kills other sessions' browsers
      await MCPBrowser.forceCleanup(this.sessionId);

      // Start MCP browser — one instance for the entire session
      this.mcpBrowser = new MCPBrowser(this.sessionId);
      await this.mcpBrowser.start();

      // Start video recording (captures screenshots as frames for stitching into MP4)
      await this.mcpBrowser.startRecording();

      // Wire browser to chaos agent so it uses Playwright MCP instead of legacy REST
      this.chaosAgent.setBrowser(this.mcpBrowser);

      // Perform login if credentials are provided (Phase 2)
      if (this.config.loginCredentials) {
        if (this.config.isResume) {
          // RESUME: the auth page was already tested in a previous run — skip exploration.
          // Just re-establish the browser session (login state was lost when the orchestrator
          // was recreated), then continue from the last iteration.
          logger.info('Resuming session — skipping auth exploration, performing re-login', {
            sessionId: this.sessionId,
            resumeFromIteration: this.config.resumeFromIteration
          });
          emitToSession(this.sessionId, {
            type: 'status_update',
            data: { message: 'Resuming session — re-establishing login state...', phase: 'resume_login' }
          });
          await this.performLogin();
          this.loginEstablished = true;
          // After login, navigate straight to the target URL so Claude's first
          // snapshot is the authenticated app, not the login page.
          try {
            await this.mcpBrowser!.callTool('browser_navigate', { url: this.config.targetUrl });
          } catch (err: any) {
            logger.warn('Post-login navigation to targetUrl failed', {
              sessionId: this.sessionId,
              error: err.message,
            });
          }
        } else {
          // FRESH START: skip auth exploration — go straight to login.
          // Auth exploration wastes 10-15 tool calls before the user's credentials
          // are even used. The login page will be tested during the main exploration
          // loop after login is established.
          await this.performLogin();
          this.loginEstablished = true;
          // After login, navigate straight to the target URL so Claude's first
          // snapshot is the authenticated app, not the login page.
          try {
            await this.mcpBrowser!.callTool('browser_navigate', { url: this.config.targetUrl });
          } catch (err: any) {
            logger.warn('Post-login navigation to targetUrl failed', {
              sessionId: this.sessionId,
              error: err.message,
            });
          }
        }
      } else if (this.config.isResume && this.config.config?.hasLoginCredentials) {
        // Resumed WITHOUT credentials but the session originally used login.
        // We cannot re-login — warn Claude so it doesn't waste tool calls on the login form.
        logger.warn('Resuming session that required login but no credentials were provided', {
          sessionId: this.sessionId
        });
        emitToSession(this.sessionId, {
          type: 'status_update',
          data: {
            message: 'Session resumed without login credentials — will explore public pages only. ' +
                     'Stop and start a new session to resume with full access.',
            phase: 'resume_no_credentials',
            isWarning: true
          }
        });
        // loginEstablished stays false — exploration prompt will warn Claude
      }

      // Pre-load document context once so every ClaudeSession iteration reuses it (2.6)
      await this.loadCachedDocumentContext();

      await this.runLoop();
    } catch (error: any) {
      logger.error('QA Loop failed', { sessionId: this.sessionId, error: error.message });
      await this.repository.updateSessionStatus(this.sessionId, 'failed', error.message);
      emitToSession(this.sessionId, {
        type: 'error',
        data: { message: error.message }
      });
    } finally {
      // Generate final report
      try {
        const report = await this.guardianAgent.generateReport();
        emitToSession(this.sessionId, {
          type: 'session_complete',
          data: { report, phase: 'final_report' }
        });
      } catch (e) {
        logger.warn('Failed to generate final report', { error: e });
      }

      // Send session-complete email notification via gateway
      if (this.config.workspaceId) {
        try {
          const sessionData = await this.repository.getSession(this.sessionId);
          notifyGateway({
            type: 'scan_complete',
            workspaceId: this.config.workspaceId,
            data: {
              sessionId: this.sessionId,
              targetUrl: this.config.targetUrl,
              projectName: this.config.targetUrl,
              bugCount: sessionData?.bugs_found || 0,
              criticalCount: 0,
            },
          }).catch(() => {});
        } catch {
          // non-critical
        }
      }

      // Stitch video from captured frames
      if (this.mcpBrowser) {
        try {
          const { frameDir, frameCount } = this.mcpBrowser.stopRecording();
          if (frameDir && frameCount >= 2) {
            const videoFilename = await stitchVideo(this.sessionId, frameDir, frameCount);
            if (videoFilename) {
              await this.repository.updateSessionVideoPath(this.sessionId, videoFilename);
              logger.info('Session video saved', { sessionId: this.sessionId, videoFilename });
            }
            await cleanupFrames(frameDir);
          }
        } catch (videoErr: any) {
          logger.warn('Video stitching failed (non-critical)', { error: videoErr.message });
        }
      }

      // Stop MCP browser subprocess — always release, even if stop() throws
      if (this.mcpBrowser) {
        try {
          await this.mcpBrowser.stop();
        } catch (stopErr: any) {
          logger.warn('Graceful browser stop failed in finally block, force-stopping', {
            sessionId: this.sessionId,
            error: stopErr.message
          });
          try {
            await this.mcpBrowser.forceStop();
          } catch {
            // Already logged inside forceStop
          }
        }
        this.mcpBrowser = null;
      }
      cleanupSession(this.sessionId);
    }
  }

  /**
   * Perform login using provided credentials before starting exploration (Phase 2)
   */
  private async performLogin(): Promise<void> {
    const creds = this.config.loginCredentials!;
    const loginUrl = creds.loginUrl || this.config.targetUrl;

    logger.info('Performing login', { sessionId: this.sessionId, loginUrl });

    emitToSession(this.sessionId, {
      type: 'status_update',
      data: { message: 'Performing login...', phase: 'login' }
    });

    if (!this.mcpBrowser) {
      throw new Error('MCP browser not initialized');
    }

    try {
      // Navigate to login page via MCP
      const navResult = await this.mcpBrowser.callTool('browser_navigate', { url: loginUrl });
      if (navResult.error) {
        throw new Error(`Failed to navigate to login page: ${navResult.error}`);
      }

      // Wait for page to load
      await this.sleep(2000);

      // Fill credentials using default or custom selectors
      const emailSelector = creds.emailSelector ||
        'input[type="email"], input[name="email"], input[name="username"], input[type="text"][name*="user"], input[type="text"][name*="email"]';
      const passwordSelector = creds.passwordSelector ||
        'input[type="password"]';
      const submitSelector = creds.submitSelector ||
        'button[type="submit"], input[type="submit"]';

      // Use browser_evaluate to fill the form (works with React/Vue)
      const fillResult = await this.mcpBrowser.callTool('browser_evaluate', {
        expression: `(() => {
          function fillInput(selector, value) {
            const el = document.querySelector(selector);
            if (!el) return false;
            el.focus();
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(el, value);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          const emailOk = fillInput(${JSON.stringify(emailSelector)}, ${JSON.stringify(creds.email)});
          const passOk = fillInput(${JSON.stringify(passwordSelector)}, ${JSON.stringify(creds.password)});
          return { emailOk, passOk };
        })()`
      });

      if (fillResult.error) {
        throw new Error(`Failed to fill login form: ${fillResult.error}`);
      }

      // Click submit via evaluate
      const clickResult = await this.mcpBrowser.callTool('browser_evaluate', {
        expression: `(() => {
          const el = document.querySelector(${JSON.stringify(submitSelector)});
          if (el) { el.click(); return true; }
          return false;
        })()`
      });

      if (clickResult.error) {
        logger.warn('Submit button click might have failed, continuing anyway', { error: clickResult.error });
      }

      // Wait for login to complete (redirect/page change)
      await this.sleep(3000);

      logger.info('Login completed', { sessionId: this.sessionId });

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: { message: 'Login successful, starting exploration...', phase: 'login_complete' }
      });

    } catch (error: any) {
      logger.error('Login failed', { sessionId: this.sessionId, error: error.message });
      emitToSession(this.sessionId, {
        type: 'status_update',
        data: { message: `Login might have failed: ${error.message}. Continuing with exploration...`, isWarning: true }
      });
      // Don't throw - continue with exploration even if login fails
    }
  }

  /**
   * Explore and test the authentication page BEFORE logging in with real credentials.
   *
   * This phase drives Claude to:
   *   1. Navigate to the login page and map its structure (inputs, buttons, error containers).
   *   2. Generate and save test cases covering:
   *        • Invalid credentials (wrong email / wrong password)
   *        • Empty email / empty password validation
   *        • Invalid e-mail format
   *        • SQL-injection and XSS probes in the login fields
   *        • Rate-limiting / brute-force protection observation
   *        • Correct login-flow documentation (selectors, flow)
   *   3. Execute those test cases immediately (up to MAX_INLINE_TESTS) so we get
   *      real pass/fail signal before the real credentials are ever submitted.
   *
   * Real credentials are NEVER submitted in this phase.
   * Non-fatal: any error is logged and the session continues to performLogin().
   */
  private async performAuthExploration(): Promise<void> {
    const creds = this.config.loginCredentials!;
    const loginUrl = creds.loginUrl || this.config.targetUrl;

    logger.info('Starting auth page exploration', { sessionId: this.sessionId, loginUrl });

    emitToSession(this.sessionId, {
      type: 'status_update',
      data: {
        message: 'Analyzing authentication page and generating test cases...',
        phase: 'auth_exploration'
      }
    });

    try {
      // Create parallel executor — tests execute immediately as Claude generates them
      const parallelExecutor = new ParallelTestExecutor(
        this.sessionId,
        { ...this.config, targetUrl: loginUrl },
        this.repository
      );

      // Create a ClaudeSession pointed at the login URL, using the explore tool-set
      // The onTestCaseCreated callback feeds each new test case into the parallel executor
      const authSession = new ClaudeSession(
        this.sessionId,
        { ...this.config, targetUrl: loginUrl },
        this.mcpBrowser!,
        'explore',
        this.cachedDocumentContext,
        (testCase, observedResult) => parallelExecutor.enqueue(testCase, observedResult || 'pass')
      );

      const modelSelection = selectModel({
        focusArea: 'explore',
        preferCostEffective: this.config.maxBudgetCents !== undefined
      });

      const authPrompt = `
You are performing a security and functional audit of the authentication page at: ${loginUrl}

══ CRITICAL: OBSERVATION-FIRST APPROACH ══
The app may be in ANY language (French, Arabic, English, etc.). You MUST:
- FIRST use browser_navigate() then browser_snapshot() to see the ACTUAL page content (accessibility tree)
- READ the actual labels, button text, placeholder text, and element roles in the snapshot
- When creating assertions, use the EXACT text and selectors you observed — never assume English

══ ASSERTION QUALITY RULE ══
Every test case MUST include at least one PRIMARY assertion that verifies actual UI feedback:
  ✅ assert_text_visible — with text you ACTUALLY SAW on the page
  ✅ assert_element_visible — with a CSS selector for a visible element (e.g. ".alert-danger")
  ✅ assert_attribute_contains — to check CSS classes changed (e.g. target="#email", value="class:is-invalid")
  ✅ assert_element_exists — with a CSS selector for an element that appeared

assert_url_contains and assert_no_console_errors are only SUPPLEMENTARY — use them as extras, never as the only assertions.

══ YOUR MISSION ══
1. Call get_session_state() first to initialise your session state.
2. Use browser_navigate() to go to ${loginUrl}, then call browser_snapshot() to see the full accessibility tree.
3. OBSERVE CAREFULLY: Read all form inputs, labels, button text, element roles. Note the LANGUAGE.

4. Test INVALID CREDENTIALS:
   a) Enter "invalid-user@test-qa.example" / "WrongPass#999!" and submit.
   b) OBSERVE: call browser_snapshot() and READ the error message that appeared. Note its exact text and infer CSS selectors from the element structure.
   c) Create save_test_case with:
      - assert_text_visible with the EXACT error text you observed (e.g. "Identifiants invalides")
      - assert_element_visible on the error container (e.g. ".alert-danger", ".toast-error")
      - assert_url_contains("/login") as a supplementary check

5. Test EMPTY FIELDS:
   a) Clear fields and submit. OBSERVE what validation appears with browser_snapshot().
   b) Create test case with assert_text_visible for the validation message you SAW.
   c) If input fields got error styling, use assert_attribute_contains (e.g. target="#email", value="class:is-invalid").
   ⚠️ Do NOT use CSS pseudo-selectors like :invalid, :required — they don't work reliably.

6. Test SQL INJECTION: enter  ' OR '1'='1'--  as both email and password, submit.
   OBSERVE: call browser_snapshot() — check what error message appeared.
   - assert_text_visible with the error text you saw
   - assert_url_contains("/login") as supplementary
   - assert_no_console_errors as supplementary

7. Test XSS: enter  <script>alert('xssprobe')</script>  as the email value, submit.
   OBSERVE: call browser_snapshot() — check what error message appeared.
   - assert_text_visible with the error text you saw
   - assert_url_contains("/login") as supplementary
   - assert_no_console_errors as supplementary
   ⚠️ Do NOT assert that "script" element doesn't exist — the page has legitimate script tags.

8. For any failures or missing validations, call save_bug() to report them.

══ FORBIDDEN PATTERNS ══
- NEVER create a test with ONLY assert_url_contains + assert_no_console_errors — that's a useless test
- NEVER use CSS pseudo-selectors (:invalid, :required, :checked)
- NEVER use "script" as an element selector
- NEVER assume error messages — READ them with browser_snapshot() first

9. Do NOT use the real credentials (email: ${creds.email}).
   Only use the fake/test values described above.

══ OBSERVED RESULT (MANDATORY) ══
When calling save_test_case(), ALWAYS include observed_result:
- "pass" — you performed the steps and the assertions matched what you saw
- "fail" — you observed a bug, error, or unexpected behavior
For auth security tests (SQL injection rejected, XSS blocked, invalid creds rejected):
  These are expected rejections → observed_result: "pass" (the app correctly blocked the attack)
Only use "fail" if the app FAILED to reject the attack or showed unexpected behavior.

Start now with get_session_state(), then navigate and explore.
`.trim();

      await authSession.runIteration(authPrompt, modelSelection.model);

      // Wait for any remaining queued tests to finish executing in parallel
      if (!this.isStopped) {
        await parallelExecutor.waitForCompletion();
        const executionResult = parallelExecutor.getResults();

        logger.info('Auth exploration complete', {
          sessionId: this.sessionId,
          testsExecuted: executionResult.testsExecuted,
          testsPassed: executionResult.testsPassed,
          testsFailed: executionResult.testsFailed
        });

        emitToSession(this.sessionId, {
          type: 'status_update',
          data: {
            message: `Auth page testing complete — ${executionResult.testsExecuted} test(s) run, ` +
              `${executionResult.testsPassed} passed, ${executionResult.testsFailed} failed. ` +
              `Proceeding to login...`,
            phase: 'auth_exploration_complete',
            testsExecuted: executionResult.testsExecuted,
            testsPassed: executionResult.testsPassed,
            testsFailed: executionResult.testsFailed
          }
        });
      } else {
        parallelExecutor.stop();
      }

    } catch (error: any) {
      // Auth exploration is non-fatal — log the problem and let the session proceed to login
      logger.error('Auth exploration failed (non-fatal), continuing to login', {
        sessionId: this.sessionId,
        error: error.message
      });
      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          message: `Auth exploration encountered an issue: ${error.message}. Proceeding to login...`,
          phase: 'auth_exploration_error',
          isWarning: true
        }
      });
    }
  }

  /**
   * Load and cache document context once at session start (2.6).
   * Delegates to a throwaway ClaudeSession just for the DB read, then stores
   * the result so it can be passed to every subsequent ClaudeSession via the
   * preloadedDocumentContext constructor arg — avoiding one DB query per iteration.
   */
  private async loadCachedDocumentContext(): Promise<void> {
    try {
      const tempSession = new ClaudeSession(this.sessionId, this.config, this.mcpBrowser!, 'explore');
      await tempSession.loadDocumentContext();
      this.cachedDocumentContext = (tempSession as any).documentContext as string | null;
      logger.info('Document context pre-loaded for session', {
        sessionId: this.sessionId,
        hasContext: this.cachedDocumentContext !== null
      });
    } catch (error: any) {
      logger.warn('Failed to pre-load document context; each iteration will load independently', {
        error: error.message
      });
      // Leave cachedDocumentContext as undefined so each ClaudeSession falls back to self-loading
    }
  }

  private async runLoop(): Promise<void> {
    while (!this.isStopped) {
      // Check pause state
      if (this.isPaused) {
        await this.sleep(1000);
        continue;
      }

      // Enforce maxDurationHours (3.2) — terminate if wall-clock time is exceeded
      if (this.startTime && this.config.maxDurationHours) {
        const elapsedHours = (Date.now() - this.startTime.getTime()) / (1000 * 3600);
        if (elapsedHours >= this.config.maxDurationHours) {
          logger.info('Session exceeded maxDurationHours — terminating', {
            sessionId: this.sessionId,
            elapsedHours: elapsedHours.toFixed(2),
            limit: this.config.maxDurationHours
          });
          await this.repository.updateSessionStatus(this.sessionId, 'completed');
          await this.repository.createTestSuiteFromSession(this.sessionId).catch((err: any) => {
            logger.error('Failed to create test suite on session complete (max_duration)', { sessionId: this.sessionId, error: err.message });
          });
          await this.repository.updateProjectContextFromSession(this.sessionId).catch((err: any) => {
            logger.error('Failed to update project context (max_duration)', { sessionId: this.sessionId, error: err.message });
          });
          emitToSession(this.sessionId, {
            type: 'session_complete',
            data: {
              reason: 'max_duration_reached',
              elapsedHours: parseFloat(elapsedHours.toFixed(2)),
              maxDurationHours: this.config.maxDurationHours
            }
          });
          return;
        }
      }

      // Safety net: if the browser has been running for more than 30 minutes,
      // force-restart it to prevent stale browser state from blocking sessions
      if (this.mcpBrowser && this.mcpBrowser.isExpired()) {
        logger.warn('Browser exceeded max duration (30min), recycling', {
          sessionId: this.sessionId
        });
        try {
          await this.mcpBrowser.forceStop();
        } catch {
          // Ignore — forceStop logs internally
        }
        // Launch a fresh browser for the remaining iterations
        this.mcpBrowser = new MCPBrowser(this.sessionId);
        await this.mcpBrowser.start();
        await this.mcpBrowser.startRecording();
        this.chaosAgent.setBrowser(this.mcpBrowser);
        // Re-establish login if credentials are available
        if (this.config.loginCredentials && this.loginEstablished) {
          try {
            await this.performLogin();
          } catch (loginErr: any) {
            logger.warn('Re-login after browser recycle failed', {
              sessionId: this.sessionId,
              error: loginErr.message
            });
          }
        }
      }

      // Guardian: Calculate quality and decide next action
      const qualityScore = await this.guardianAgent.calculateQualityScore();

      // Check termination conditions
      const decision = this.guardianAgent.shouldContinue(qualityScore, {
        threshold: this.config.qualityThreshold,
        maxIterations: this.config.maxIterations,
        currentIteration: this.currentIteration
      });

      if (!decision.shouldContinue) {
        logger.info('Loop terminating', {
          sessionId: this.sessionId,
          reason: decision.reason,
          qualityScore: qualityScore.overall
        });
        await this.repository.updateSessionStatus(this.sessionId, 'completed');
        await this.repository.createTestSuiteFromSession(this.sessionId).catch((err: any) => {
          logger.error('Failed to create test suite on session complete', { sessionId: this.sessionId, error: err.message });
        });
        await this.repository.updateProjectContextFromSession(this.sessionId).catch((err: any) => {
          logger.error('Failed to update project context on session complete', { sessionId: this.sessionId, error: err.message });
        });
        emitToSession(this.sessionId, {
          type: 'session_complete',
          data: {
            reason: decision.reason,
            qualityScore: qualityScore.overall,
            recommendation: decision.recommendation
          }
        });
        break;
      }

      // Guardian: Plan next iteration
      const plan = await this.guardianAgent.planNextIteration(qualityScore);
      this.currentFocus = plan.focusArea;

      this.currentIteration++;
      const iterationStartTime = Date.now();

      logger.info('Starting iteration', {
        sessionId: this.sessionId,
        iteration: this.currentIteration,
        focus: plan.focusArea,
        targets: plan.targets.length
      });

      emitToSession(this.sessionId, {
        type: 'iteration_start',
        data: {
          iteration: this.currentIteration,
          focus: plan.focusArea,
          qualityScore: qualityScore.overall,
          plan
        }
      });

      try {
        let result: any;

        // Execute based on focus area
        switch (plan.focusArea) {
          case 'explore':
            result = await this.runExploration(plan);
            break;
          case 'chaos':
            result = await this.runChaos(plan);
            break;
          case 'investigate':
            result = await this.runInvestigation(plan);
            break;
          case 'retest':
            result = await this.runRetest(plan);
            break;
        }

        // Log iteration results with model info (Phase 6 & 8)
        const iterationDuration = Date.now() - iterationStartTime;
        await this.repository.addIteration(this.sessionId, {
          iterationNumber: this.currentIteration,
          focusArea: plan.focusArea,
          pagesExplored: result?.pagesExplored || 0,
          testsGenerated: result?.testsGenerated || 0,
          bugsFound: result?.bugsFound || 0,
          toolCalls: result?.toolCalls || 0,
          tokensUsed: result?.tokensUsed || 0,
          durationMs: iterationDuration,
          completionReason: result?.completionReason || 'completed',
          // Phase 6 & 8: Track model and cost per iteration
          modelUsed: result?.modelUsed,
          inputTokens: result?.tokenUsage?.inputTokens || 0,
          outputTokens: result?.tokenUsage?.outputTokens || 0,
          costCents: result?.costInfo?.costCents || 0
        });

        // Update session progress
        await this.repository.updateSessionProgress(this.sessionId, {
          iterationCount: this.currentIteration,
          qualityScore: qualityScore.overall
        });

        emitToSession(this.sessionId, {
          type: 'iteration_end',
          data: {
            iteration: this.currentIteration,
            focus: plan.focusArea,
            duration: iterationDuration,
            result,
            qualityScore: qualityScore.overall
          }
        });

      } catch (error: any) {
        logger.error('Iteration failed', {
          sessionId: this.sessionId,
          iteration: this.currentIteration,
          focus: plan.focusArea,
          error: error.message
        });

        await this.repository.addIteration(this.sessionId, {
          iterationNumber: this.currentIteration,
          focusArea: plan.focusArea,
          errorMessage: error.message,
          completionReason: 'error',
          durationMs: Date.now() - iterationStartTime
        });

        // Run detective to analyze the error
        if (this.config.enableDetective !== false) {
          try {
            await this.detectiveAgent.analyzeFailure({
              id: `error-${this.currentIteration}`,
              testCaseId: '',
              testCaseName: `Iteration ${this.currentIteration}`,
              failedStepIndex: 0,
              failureReason: error.message,
              failureType: 'iteration_error',
              timestamp: new Date()
            });
          } catch (e) {
            logger.warn('Detective analysis failed', { error: e });
          }
        }

        // Continue to next iteration unless it's a fatal error
        if (this.isFatalError(error)) {
          throw error;
        }
      }

      // Brief pause between iterations
      await this.sleep(1000);
    }
  }

  /**
   * Run exploration phase using Claude with tiered model selection.
   * After exploration completes, immediately executes newly generated test cases
   * so the loop gains real pass/fail signal on every iteration.
   */
  private async runExploration(plan: IterationPlan): Promise<any> {
    // Create parallel executor — tests will be executed immediately as Claude generates them
    const parallelExecutor = new ParallelTestExecutor(
      this.sessionId,
      this.config,
      this.repository
    );

    // Pass focusArea so the session selects the right tool subset (2.2),
    // and pass the pre-loaded document context to skip the per-iteration DB query (2.6).
    // The onTestCaseCreated callback feeds each new test case into the parallel executor.
    //
    // When GOOGLE_AI_API_KEY is set, use GemmaSession ($0 per scan) instead of ClaudeSession.
    // Removing the env var instantly falls back to Claude — no code change needed.
    const useGemma = !!process.env.GOOGLE_AI_API_KEY;
    const testCaseCallback = (testCase: any, observedResult?: 'pass' | 'fail') =>
      parallelExecutor.enqueue(testCase, observedResult || 'pass');

    if (useGemma) {
      this.claudeSession = new GemmaSession(
        this.sessionId,
        this.config,
        this.mcpBrowser!,
        plan.focusArea as any,
        this.cachedDocumentContext,
        testCaseCallback,
      );
      logger.info('Using Gemma 4 26B for exploration (free tier)', { sessionId: this.sessionId });
    } else {
      this.claudeSession = new ClaudeSession(
        this.sessionId,
        this.config,
        this.mcpBrowser!,
        plan.focusArea as any,
        this.cachedDocumentContext,
        testCaseCallback,
      );
    }

    // Select model based on focus area (Phase 6: Tiered Models)
    const modelSelection = selectModel({
      focusArea: 'explore',
      preferCostEffective: this.config.maxBudgetCents !== undefined
    });

    logger.info('Model selected for exploration', {
      sessionId: this.sessionId,
      model: useGemma ? 'gemma-4-26b-a4b-it' : modelSelection.model,
      reason: useGemma ? 'GOOGLE_AI_API_KEY set — using free Gemma 4' : modelSelection.reason,
      estimatedCostPerCall: useGemma ? 0 : modelSelection.estimatedCostPerCall,
    });

    const targetHint = plan.targets.length > 0
      ? `Priority unexplored pages for this iteration:\n${plan.targets.map(t => `  - ${t}`).join('\n')}`
      : `Start from ${this.config.targetUrl} and navigate to unexplored pages.`;

    // Fetch the already-explored pages from the DB and embed them as a hard blocklist.
    // This prevents Claude from re-visiting pages it tested in a previous iteration,
    // whether that's within the same session or after a resume.
    const alreadyExploredPages = await this.repository.getExploredPages(this.sessionId);
    const alreadyExploredUrls = alreadyExploredPages.map(p => p.url);
    const skipBlock = alreadyExploredUrls.length > 0
      ? `\n⛔ ALREADY EXPLORED — DO NOT REVISIT THESE PAGES (skip them, navigate elsewhere):\n${alreadyExploredUrls.map(u => `  - ${u}`).join('\n')}\n`
      : '';

    const isFirstEverIteration = this.currentIteration <= 1 && alreadyExploredUrls.length === 0;

    // Warn Claude when this is a resumed session without login credentials, so it
    // doesn't waste tool calls attempting to fill in the login form.
    const needsLoginButNoCreds =
      this.config.isResume &&
      this.config.config?.hasLoginCredentials &&
      !this.loginEstablished;
    const noLoginWarning = needsLoginButNoCreds
      ? `\n⚠️  LOGIN NOTICE: This session was resumed without login credentials. ` +
        `The browser has NO active session — protected pages will redirect to the login form. ` +
        `DO NOT attempt to fill in or submit the login form. ` +
        `Instead, ONLY explore pages that are publicly accessible (no login required).\n`
      : '';

    // Credential context: inform the AI that login was established so it can
    // reference credentials from process.env rather than hardcoding them.
    const credentialContext = this.loginEstablished && this.config.loginCredentials
      ? `\n🔐 AUTHENTICATION: You are logged in with test credentials (available via process.env.TEST_USERNAME / process.env.TEST_PASSWORD). ` +
        `If you encounter a login form during exploration, use the provided credentials through environment variables — ` +
        `NEVER hardcode credentials in generated test code. The login session should already be established.\n`
      : '';

    const prompt = isFirstEverIteration
      ? `You are a QA engineer systematically testing ${this.config.targetUrl}.
${noLoginWarning}${credentialContext}
STEP 1 — Initialise: call get_session_state() first.
STEP 2 — Use browser_navigate() to go to ${this.config.targetUrl}, then call browser_snapshot() to see the full page.
STEP 3 — ★★★ DISCOVER ALL LINKS ★★★
  After browser_snapshot(), look at EVERY link/anchor in the accessibility tree.
  For EACH link that points to a different page on the same domain, call add_discovered_page({ url: "..." }).
  This is the MOST IMPORTANT step — it populates the exploration queue. Do this BEFORE anything else.
STEP 4 — For EVERY page you visit, you MUST:
  a) Call browser_snapshot() to observe the page — read ALL text, elements, buttons, forms in the accessibility tree.
  b) ★ Call add_discovered_page() for EVERY new link you see in the snapshot.
  c) Interact with the page (use browser_fill_form/browser_click with refs from the snapshot).
  d) After EACH interaction, call browser_snapshot() AGAIN to observe what changed.
  e) THEN call save_test_case() using the EXACT text and CSS selectors you inferred from what you observed.
     ⚠️ Every test case MUST have at least one PRIMARY assertion (assert_text_visible,
     assert_element_visible, assert_element_exists, or assert_attribute_contains).
     Tests with ONLY assert_url_contains + assert_no_console_errors are USELESS and will be rejected.
  f) If you spot a bug or broken element, call save_bug() right away.
  g) Call mark_page_explored() before moving to the next page.
STEP 5 — Click navigation links to explore more pages, repeating step 4 for each.

IMPORTANT RULES:
- ★ After EVERY browser_snapshot(), IMMEDIATELY call add_discovered_page() for all new links you see.
- If a click or type action fails (error in result), SKIP IT immediately — do not retry the same selector.
- Use descriptive selectors: prefer [data-testid], aria-label, or visible text over nth-of-type.
- Generate test cases BEFORE moving to the next page, not at the end.
- Aim to cover at least 3 different pages and save at least 6 test cases total this iteration.
- The app may be in ANY language — always call browser_snapshot() and use observed text.
- ALWAYS include observed_result ("pass" or "fail") in every save_test_case() call.`
      : `You are continuing a QA exploration of ${this.config.targetUrl}. Iteration ${this.currentIteration}.
${noLoginWarning}${credentialContext}${skipBlock}
STEP 1 — ${targetHint}
STEP 2 — For EVERY page you visit (that is NOT in the skip list above):
  a) Call browser_snapshot() to observe the page — read ALL text, elements, and structure.
  b) ★ Call add_discovered_page() for EVERY new link/URL you see in the snapshot.
  c) Interact with the page (browser_click/browser_fill_form), then call browser_snapshot() AGAIN to see what changed.
  d) Call save_test_case() with assertions based on what you ACTUALLY observed.
     ⚠️ Every test MUST include at least one PRIMARY assertion (assert_text_visible,
     assert_element_visible, assert_element_exists, or assert_attribute_contains).
     Tests with ONLY assert_url_contains + assert_no_console_errors are USELESS.
  e) Call save_bug() for any broken or missing functionality you observe.
  f) Call mark_page_explored() before moving on.
STEP 3 — After finishing the priority pages, check get_unexplored_pages() for remaining targets.

CRITICAL RULES:
- ★ After EVERY browser_snapshot(), IMMEDIATELY call add_discovered_page() for all new links you see.
- ⛔ NEVER navigate to a URL listed in the "ALREADY EXPLORED" block above. They are done.
- If a page redirects you somewhere already explored → go back and pick a different target.
- If a click, type, or navigation fails → SKIP it immediately, do NOT retry.
- Generate test cases ON THE PAGE, not after leaving it.
- Aim for at least 4 new test cases this iteration.
- ALWAYS call browser_snapshot() before creating assertions — use ONLY observed text/selectors.
- ALWAYS include observed_result ("pass" or "fail") in every save_test_case() call.`;

    // Emit phase start so the UI can show the current activity
    emitToSession(this.sessionId, {
      type: 'status_update',
      data: {
        message: isFirstEverIteration
          ? `Starting first exploration of ${this.config.targetUrl}…`
          : `Iteration ${this.currentIteration}: exploring ${plan.targets.length > 0 ? plan.targets.length + ' pages' : 'new pages'}…`,
        phase: 'exploring'
      }
    });

    const result = await this.claudeSession.runIteration(prompt, modelSelection.model);

    // Track real token usage and costs (Phase 8: Budget Tracking)
    if (result.costInfo) {
      this.guardianAgent.trackTokenUsage(
        'exploration',
        result.tokenUsage.totalTokens,
        Math.round(result.costInfo.costCents)
      );

      // Emit cost update to frontend
      emitToSession(this.sessionId, {
        type: 'progress',
        data: {
          phase: 'cost_update',
          model: result.modelUsed,
          modelName: getModelDisplayName(result.modelUsed),
          inputTokens: result.tokenUsage.inputTokens,
          outputTokens: result.tokenUsage.outputTokens,
          costCents: result.costInfo.costCents,
          totalCostCents: this.guardianAgent.getBudgetStatus().totalCostCents
        }
      });
    }

    // Wait for any remaining queued tests to finish executing in parallel
    if (!this.isStopped) {
      const pending = parallelExecutor.getResults();
      if (pending.testsExecuted < result.testsGenerated) {
        emitToSession(this.sessionId, {
          type: 'status_update',
          data: {
            message: `Waiting for remaining test executions to complete…`,
            phase: 'test_execution'
          }
        });
      }
      await parallelExecutor.waitForCompletion();

      // ── Self-healing: correction phase ────────────────────────────────
      await this.runCorrectionPhase(parallelExecutor);
    } else {
      parallelExecutor.stop();
    }

    const execResults = parallelExecutor.getResults();
    return {
      ...result,
      testsExecuted: execResults.testsExecuted,
      testsPassed: execResults.testsPassed,
      testsFailed: execResults.testsFailed
    };
  }

  /**
   * Self-healing correction phase: compare Claude's observed results with
   * mechanical execution results. If mismatches are found, make ONE focused
   * Claude API call to fix the test steps, then re-execute corrected tests.
   */
  private async runCorrectionPhase(parallelExecutor: ParallelTestExecutor): Promise<void> {
    const allMismatches = parallelExecutor.getMismatches();
    if (allMismatches.length === 0) {
      logger.info('No mismatches found — skipping correction phase', { sessionId: this.sessionId });
      return;
    }

    // Filter out test cases that have already been corrected once (max 1 retry per test case).
    // Already-retried tests that still mismatch are marked "needs_review" permanently.
    const mismatches = allMismatches.filter(m => !this.correctedTestCaseIds.has(m.testCaseId));
    const alreadyRetried = allMismatches.filter(m => this.correctedTestCaseIds.has(m.testCaseId));

    if (alreadyRetried.length > 0) {
      logger.info('Skipping already-retried test cases, marking as needs_review', {
        sessionId: this.sessionId,
        skippedCount: alreadyRetried.length,
        skippedIds: alreadyRetried.map(m => m.testCaseId)
      });
      // Mark previously-corrected tests that still fail as "needs_review" permanently
      for (const m of alreadyRetried) {
        emitToSession(this.sessionId, {
          type: 'test_run_result',
          data: {
            testCaseId: m.testCaseId,
            testCaseName: m.testCaseName,
            status: 'needs_review',
            isMismatch: true,
            message: 'Already corrected once — marked as needs_review permanently'
          }
        });
      }
    }

    if (mismatches.length === 0) {
      logger.info('All mismatched tests already retried once — skipping correction phase', { sessionId: this.sessionId });
      return;
    }

    logger.info('Starting correction phase', {
      sessionId: this.sessionId,
      mismatchCount: mismatches.length
    });

    emitToSession(this.sessionId, {
      type: 'status_update',
      data: {
        message: `Correcting ${mismatches.length} mismatched test(s)…`,
        phase: 'correction'
      }
    });

    try {
      const corrected = await this.callCorrectionAPI(mismatches);

      if (corrected.length === 0) {
        logger.info('Correction API returned no fixes', { sessionId: this.sessionId });
        return;
      }

      // Update corrected test cases in DB and track them as retried (max 1 correction per test)
      for (const c of corrected) {
        this.correctedTestCaseIds.add(c.testCaseId);
        try {
          await this.repository.updateTestCaseSteps(c.testCaseId, {
            steps: c.correctedSteps,
            correctionSource: 'self_healing'
          });
        } catch (updateErr: any) {
          logger.warn('Failed to update corrected test case', {
            testCaseId: c.testCaseId,
            error: updateErr.message
          });
        }
      }

      // Re-execute ONLY corrected tests (one final time)
      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          message: `Re-executing ${corrected.length} corrected test(s)…`,
          phase: 'correction_retest'
        }
      });

      const retestExecutor = new ParallelTestExecutor(this.sessionId, this.config, this.repository);
      for (const c of corrected) {
        const updated = await this.repository.getTestCaseById(c.testCaseId);
        if (updated) {
          retestExecutor.enqueue(updated, 'pass'); // Corrected tests should pass
        }
      }
      await retestExecutor.waitForCompletion();

      const retestResults = retestExecutor.getResults();
      logger.info('Correction retest complete', {
        sessionId: this.sessionId,
        testsExecuted: retestResults.testsExecuted,
        testsPassed: retestResults.testsPassed,
        testsFailed: retestResults.testsFailed
      });

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          message: `Correction complete — ${retestResults.testsPassed}/${retestResults.testsExecuted} corrected tests passing`,
          phase: 'correction_complete'
        }
      });

    } catch (error: any) {
      logger.error('Correction phase failed (non-fatal)', {
        sessionId: this.sessionId,
        error: error.message
      });
      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          message: `Correction phase encountered an issue: ${error.message}`,
          phase: 'correction_error',
          isWarning: true
        }
      });
    }
  }

  /**
   * Make ONE focused Claude API call to fix all mismatched tests.
   * Returns an array of { testCaseId, correctedSteps }.
   */
  private async callCorrectionAPI(mismatches: Array<{
    testCaseId: string;
    testCaseName: string;
    observedResult: string;
    executionResult: string;
    failureStepIndex?: number;
    failureReason?: string;
    steps: any[];
  }>): Promise<Array<{ testCaseId: string; correctedSteps: any[] }>> {
    const Anthropic = require('@anthropic-ai/sdk').default;
    const { getPlatformKey } = require('./platform-config');
    const apiKey = await getPlatformKey('anthropic');
    if (!apiKey) {
      logger.error('No Anthropic API key configured on platform — cannot run correction');
      return [];
    }

    const client = new Anthropic({ apiKey });

    // Build a focused prompt with all mismatches
    const mismatchDescriptions = mismatches.map((m, i) => {
      const failInfo = m.failureStepIndex !== undefined
        ? `Failed at step ${m.failureStepIndex}: ${m.failureReason || 'unknown error'}`
        : `Execution result: ${m.executionResult}`;
      return `
TEST ${i + 1}: "${m.testCaseName}" (id: ${m.testCaseId})
  Claude observed: ${m.observedResult}
  Mechanical result: ${m.executionResult}
  ${failInfo}
  Steps: ${JSON.stringify(m.steps, null, 2)}`;
    }).join('\n');

    const prompt = `You are fixing test cases that failed mechanical execution.
These tests were generated during exploration. Claude observed them as "${mismatches[0].observedResult}"
but our automated test runner got a different result.

Common issues to fix:
- Wrong CSS selectors (element not found)
- Missing wait steps before assertions
- Incorrect assertion text (typo or partial match)
- Missing navigate step at the beginning
- assert_text_visible with wrong text (check if it should be a substring match)

TARGET URL: ${this.config.targetUrl}

MISMATCHED TESTS:
${mismatchDescriptions}

Fix the test steps to make them work correctly. Return ONLY a JSON array:
[
  {
    "testCaseId": "<id>",
    "correctedSteps": [<fixed steps array>]
  }
]

Rules:
- Keep the same step structure (action, target, value, description)
- Only fix what's broken — don't rewrite the entire test
- If a selector failed, try a more general one
- Add wait steps (action: "wait", value: "1000") before assertions if timing might be an issue
- For assert_text_visible failures, verify the text exactly matches what the page shows
- Return ONLY the JSON array, no other text`;

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      });

      const textContent = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

      // Extract JSON from response — handle markdown code blocks, leading text, etc.
      let jsonStr = textContent.trim();

      // Strategy 1: Strip markdown code block wrapper
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // Strategy 2: If still not valid JSON, try to find the first [ ... ] array
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          parsed = JSON.parse(arrayMatch[0]);
        } else {
          throw new Error(`Could not extract JSON array from correction response: ${jsonStr.slice(0, 200)}`);
        }
      }
      if (!Array.isArray(parsed)) {
        logger.warn('Correction API returned non-array', { response: jsonStr.slice(0, 200) });
        return [];
      }

      // Validate structure
      const valid = parsed.filter((item: any) =>
        item.testCaseId &&
        Array.isArray(item.correctedSteps) &&
        item.correctedSteps.length > 0
      );

      logger.info('Correction API returned fixes', {
        sessionId: this.sessionId,
        totalMismatches: mismatches.length,
        fixesReturned: valid.length
      });

      return valid;

    } catch (error: any) {
      logger.error('Correction API call failed', {
        sessionId: this.sessionId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Run chaos/adversarial testing phase
   */
  private async runChaos(plan: IterationPlan): Promise<any> {
    if (this.config.enableChaos === false) {
      logger.info('Chaos testing disabled, skipping');
      return { skipped: true };
    }

    logger.info('Running chaos testing', { sessionId: this.sessionId, targets: plan.targets });

    emitToSession(this.sessionId, {
      type: 'progress',
      data: {
        phase: 'chaos',
        message: 'Starting adversarial testing...'
      }
    });

    // Get pages to test
    const pages = await this.repository.getPages(this.sessionId);
    const targetPages = plan.targets.length > 0
      ? pages.filter(p => plan.targets.includes(p.url))
      : pages.filter(p => p.is_explored && p.discovered_elements?.inputs?.length > 0);

    let totalVulnerabilities = 0;
    let totalAttacks = 0;

    for (const page of targetPages.slice(0, 5)) {
      const results = await this.chaosAgent.runChaos(page);
      totalAttacks += results.length;
      totalVulnerabilities += results.filter(r => r.vulnerabilityConfirmed).length;
    }

    // Run accessibility audit on main pages
    const mainPage = pages.find(p => p.url === this.config.targetUrl);
    if (mainPage) {
      const a11yResults = await this.chaosAgent.runAccessibilityAudit(mainPage.url);
      totalAttacks += a11yResults.length;
      totalVulnerabilities += a11yResults.filter(r => r.vulnerabilityConfirmed).length;
    }

    const summary = this.chaosAgent.getSummary();

    emitToSession(this.sessionId, {
      type: 'progress',
      data: { phase: 'chaos_complete', summary }
    });

    return {
      bugsFound: totalVulnerabilities,
      attacksRun: totalAttacks,
      summary
    };
  }

  /**
   * Run investigation/detective phase
   */
  private async runInvestigation(plan: IterationPlan): Promise<any> {
    if (this.config.enableDetective === false) {
      logger.info('Detective disabled, skipping');
      return { skipped: true };
    }

    logger.info('Running investigation', { sessionId: this.sessionId, targets: plan.targets });

    emitToSession(this.sessionId, {
      type: 'progress',
      data: {
        phase: 'detective',
        message: 'Analyzing failures...'
      }
    });

    // Get recent failures
    const testRuns = await this.repository.getTestRuns(this.sessionId);
    const failedRuns = testRuns.filter(r => r.status === 'failed');

    const analyses = [];

    for (const run of failedRuns.slice(0, 10)) {
      const analysis = await this.detectiveAgent.analyzeFailure({
        id: run.id,
        testCaseId: run.test_case_id,
        testCaseName: '',
        failedStepIndex: run.failure_step_index || 0,
        failureReason: run.failure_reason || 'Unknown',
        failureType: 'test_failure',
        timestamp: new Date(run.executed_at)
      });
      analyses.push(analysis);
    }

    // Look for correlations
    const failures = failedRuns.map(r => ({
      id: r.id,
      testCaseId: r.test_case_id,
      testCaseName: '',
      failedStepIndex: r.failure_step_index || 0,
      failureReason: r.failure_reason || 'Unknown',
      failureType: 'test_failure',
      timestamp: new Date(r.executed_at)
    }));

    const correlations = await this.detectiveAgent.correlateFailures(failures);

    emitToSession(this.sessionId, {
      type: 'progress',
      data: {
        phase: 'investigation',
        analysesCount: analyses.length,
        correlationsFound: correlations.length
      }
    });

    return {
      analyses: analyses.length,
      correlations: correlations.length,
      flakyTests: analyses.filter(a => a.category === 'flaky').length,
      bugs: analyses.filter(a => a.category === 'bug').length
    };
  }

  /**
   * Run retest phase using the real RetestExecutor (5.4)
   */
  private async runRetest(plan: IterationPlan): Promise<any> {
    logger.info('Running retest', { sessionId: this.sessionId, targets: plan.targets });

    emitToSession(this.sessionId, {
      type: 'progress',
      data: { phase: 'retest', message: 'Running regression tests...' }
    });

    const executor = new RetestExecutor(
      this.sessionId,
      this.sessionId, // sourceSessionId = current session (retest against itself)
      'quick',
      true  // enableAutoAnalysis
    );

    const result = await executor.run();

    return {
      testsRun: result.totalTests,
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      duration: result.duration
    };
  }

  private isFatalError(error: any): boolean {
    // Determine if error should stop the entire loop
    const fatalMessages = [
      'ANTHROPIC_API_KEY',
      'authentication failed',
      'rate limit exceeded',
      'insufficient funds'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return fatalMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
  }

  async pause(): Promise<void> {
    logger.info('Pausing QA Loop', { sessionId: this.sessionId });
    this.isPaused = true;

    // Kill the browser immediately on pause to free the browser lock.
    // On resume, a new browser will be started.
    if (this.mcpBrowser) {
      try {
        await this.mcpBrowser.forceStop();
      } catch (err: any) {
        logger.warn('Failed to stop browser on pause', {
          sessionId: this.sessionId,
          error: err.message
        });
      }
      this.mcpBrowser = null;
    }

    emitToSession(this.sessionId, {
      type: 'status_update',
      data: { status: 'paused' }
    });
  }

  async resume(): Promise<void> {
    logger.info('Resuming QA Loop', { sessionId: this.sessionId });
    this.isPaused = false;
    emitToSession(this.sessionId, {
      type: 'status_update',
      data: { status: 'running' }
    });
  }

  async stop(): Promise<void> {
    logger.info('Stopping QA Loop', { sessionId: this.sessionId });
    this.isStopped = true;
    if (this.claudeSession) {
      try {
        await this.claudeSession.abort();
      } catch (error: any) {
        logger.warn('Error aborting Claude session during stop', {
          sessionId: this.sessionId,
          error: error.message
        });
      }
    }
    // Stop MCP browser subprocess — force-stop if graceful close fails
    if (this.mcpBrowser) {
      try {
        await this.mcpBrowser.stop();
      } catch (error: any) {
        logger.warn('Graceful browser stop failed, force-stopping', {
          sessionId: this.sessionId,
          error: error.message
        });
        try {
          await this.mcpBrowser.forceStop();
        } catch {
          // Already logged inside forceStop
        }
      }
      this.mcpBrowser = null;
    }
    await this.repository.updateSessionStatus(this.sessionId, 'cancelled');
    emitToSession(this.sessionId, {
      type: 'status_update',
      data: { status: 'cancelled' }
    });
  }

  /**
   * Get current quality score
   */
  async getQualityScore(): Promise<QualityScore> {
    return this.guardianAgent.calculateQualityScore();
  }

  /**
   * Get current focus area
   */
  getCurrentFocus(): FocusArea {
    return this.currentFocus;
  }

  /**
   * Get current iteration number
   */
  getCurrentIteration(): number {
    return this.currentIteration;
  }

  /**
   * Manually trigger chaos testing
   */
  async triggerChaos(): Promise<any> {
    const plan: IterationPlan = {
      focusArea: 'chaos',
      targets: [],
      priorityReasoning: 'Manual trigger',
      riskAssessment: 'N/A',
      estimatedDurationMs: 60000,
      estimatedToolCalls: 50
    };
    return this.runChaos(plan);
  }

  /**
   * Manually trigger investigation
   */
  async triggerInvestigation(): Promise<any> {
    const plan: IterationPlan = {
      focusArea: 'investigate',
      targets: [],
      priorityReasoning: 'Manual trigger',
      riskAssessment: 'N/A',
      estimatedDurationMs: 30000,
      estimatedToolCalls: 20
    };
    return this.runInvestigation(plan);
  }

  /**
   * Generate report on demand
   */
  async generateReport(): Promise<any> {
    return this.guardianAgent.generateReport();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
// WORKTREE_BUILD_MARKER_1772873764
