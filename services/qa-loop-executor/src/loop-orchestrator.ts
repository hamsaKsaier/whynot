import { createLogger } from '../../shared/logger/logger';
import { QALoopRepository } from './repositories/qa-loop-repository';
import { ClaudeSession, CostInfo } from './claude-session';
import { emitToSession, cleanupSession } from './api/websocket';
import { ChaosAgent } from './agents/chaos-agent';
import { DetectiveAgent } from './agents/detective-agent';
import { GuardianAgent, GuardianConfig, QualityScore, IterationPlan } from './agents/guardian-agent';
import { RetestExecutor } from './retest-executor';
import { selectModel, ClaudeModel, FOCUS_AREA_MODELS, getModelDisplayName } from './model-selector';
import { BrowserTools } from './tools/browser-tools';
import axios from 'axios';

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
}

export type FocusArea = 'explore' | 'chaos' | 'retest' | 'investigate';

export class LoopOrchestrator {
  private sessionId: string;
  private config: LoopConfig;
  private repository: QALoopRepository;
  private claudeSession: ClaudeSession | null = null;
  private isPaused: boolean = false;
  private isStopped: boolean = false;
  private currentIteration: number = 0;
  private startTime: Date | null = null;
  /** True once performLogin() has succeeded this run — used to warn Claude when login state is absent */
  private loginEstablished: boolean = false;

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
        } else {
          // FRESH START: explore auth page first, then log in
          await this.performAuthExploration();
          await this.performLogin();
          this.loginEstablished = true;
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

    // Create browser tools instance for login
    const browserTools = new BrowserTools(this.sessionId, this.config);

    try {
      // Navigate to login page
      const navResult = await browserTools.navigate(loginUrl);
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
        'button[type="submit"], input[type="submit"], button:contains("Log in"), button:contains("Sign in")';

      // Type email/username
      const typeEmailResult = await browserTools.typeText(emailSelector, creds.email);
      if (typeEmailResult.error) {
        throw new Error(`Failed to enter email: ${typeEmailResult.error}`);
      }

      // Type password
      const typePasswordResult = await browserTools.typeText(passwordSelector, creds.password);
      if (typePasswordResult.error) {
        throw new Error(`Failed to enter password: ${typePasswordResult.error}`);
      }

      // Click submit
      const clickResult = await browserTools.click(submitSelector);
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
      // Snapshot pre-existing test case IDs so we can detect the ones generated here
      const preExisting = await this.repository.getTestCases(this.sessionId);
      const preExistingIds = new Set(preExisting.map(tc => tc.id));

      // Create a ClaudeSession pointed at the login URL, using the explore tool-set
      const authSession = new ClaudeSession(
        this.sessionId,
        { ...this.config, targetUrl: loginUrl },
        'explore',
        this.cachedDocumentContext
      );

      const modelSelection = selectModel({
        focusArea: 'explore',
        preferCostEffective: this.config.maxBudgetCents !== undefined
      });

      const authPrompt = `
You are performing a security and functional audit of the authentication page at: ${loginUrl}

== YOUR MISSION ==
1. Call get_session_state() first to initialise your session state.
2. Navigate to ${loginUrl} and capture the page (screenshot + DOM).
3. Identify all form inputs, labels, submit button, and any visible error/validation containers.
4. Generate and SAVE test cases for each of the following scenarios (use save_test_case tool):

   a) INVALID CREDENTIALS — enter email "invalid-user@test-qa.example" and password "WrongPass#999!",
      submit the form, and verify that a meaningful error message is displayed (e.g. "Invalid credentials").
      Expected: login is rejected, no redirect to a protected route, error visible.

   b) EMPTY EMAIL — clear the email field, enter any non-empty password, submit, and verify a
      validation error appears for the email field.
      Expected: form is not submitted / error shown inline.

   c) EMPTY PASSWORD — enter a valid email format, clear the password field, submit, and verify a
      validation error appears for the password field.
      Expected: form is not submitted / error shown inline.

   d) INVALID EMAIL FORMAT — enter "notanemail" (no @ sign) as the email, any password, submit,
      and verify the client or server rejects the format.
      Expected: format validation error, login not attempted.

   e) SQL INJECTION PROBE — enter  ' OR '1'='1'--  as both email and password and submit.
      Expected: login is rejected safely; no crash, no unexpected 500 error, no auth bypass.

   f) XSS PROBE — enter  <script>alert('xssprobe')</script>  as the email field value and submit.
      Expected: value is sanitized or escaped; no alert fires; no raw HTML rendered in the response.

   g) RATE-LIMIT / BRUTE-FORCE PROTECTION — attempt five rapid consecutive invalid logins and
      observe whether the app applies a lockout, CAPTCHA, or rate-limit response.
      Document what you observe (even if no protection is found — that is itself a bug to report).

   h) SUCCESSFUL LOGIN FLOW DOCUMENTATION — document the exact CSS selectors for the email input,
      password input, and submit button as a test case with steps that describe the happy path.
      Do NOT use real credentials. Use "doc@test-qa.example" / "DocPass#1" as placeholder values
      and add a note in the test description that these are placeholder values, not real credentials.

5. For any failures, unexpected errors, or missing validations you discover, also call add_bug() to
   record them with the appropriate severity and category.

6. Do NOT use the real credentials (email: ${creds.email}).
   Only use the fake/test values described above.

Start now with get_session_state(), then navigate and explore.
`.trim();

      await authSession.runIteration(authPrompt, modelSelection.model);

      // Execute the newly generated auth test cases immediately
      if (!this.isStopped) {
        const executionResult = await this.executeNewTestCases(preExistingIds);

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
      const tempSession = new ClaudeSession(this.sessionId, this.config, 'explore');
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
    // Snapshot existing test case IDs so we can detect new ones created this iteration
    const preExisting = await this.repository.getTestCases(this.sessionId);
    const preExistingIds = new Set(preExisting.map(tc => tc.id));

    // Pass focusArea so the session selects the right tool subset (2.2),
    // and pass the pre-loaded document context to skip the per-iteration DB query (2.6).
    this.claudeSession = new ClaudeSession(
      this.sessionId,
      this.config,
      plan.focusArea as any,
      this.cachedDocumentContext
    );

    // Select model based on focus area (Phase 6: Tiered Models)
    const modelSelection = selectModel({
      focusArea: 'explore',
      preferCostEffective: this.config.maxBudgetCents !== undefined
    });

    logger.info('Model selected for exploration', {
      sessionId: this.sessionId,
      model: modelSelection.model,
      reason: modelSelection.reason,
      estimatedCostPerCall: modelSelection.estimatedCostPerCall
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

    const prompt = isFirstEverIteration
      ? `You are a QA engineer systematically testing ${this.config.targetUrl}.
${noLoginWarning}
STEP 1 — Initialise: call get_session_state() first.
STEP 2 — Navigate to ${this.config.targetUrl} and capture the page with get_page_elements().
STEP 3 — For EVERY page you visit, you MUST:
  a) Observe what the page does (forms, buttons, data, navigation).
  b) Immediately call save_test_case() with 2–4 concrete test cases for that page.
     Each test case needs clear steps a real tester could follow.
  c) If you spot a bug or a broken element, call add_bug() right away.
  d) Call mark_page_explored() before moving to the next page.
STEP 4 — Click navigation links to explore more pages, repeating step 3 for each.

IMPORTANT RULES:
- If a click or type action fails (error in result), SKIP IT immediately — do not retry the same selector.
- Use descriptive selectors: prefer [data-testid], aria-label, or visible text over nth-of-type.
- Generate test cases BEFORE moving to the next page, not at the end.
- Aim to cover at least 3 different pages and save at least 6 test cases total this iteration.`
      : `You are continuing a QA exploration of ${this.config.targetUrl}. Iteration ${this.currentIteration}.
${noLoginWarning}${skipBlock}
STEP 1 — ${targetHint}
STEP 2 — For EVERY page you visit (that is NOT in the skip list above):
  a) Call get_page_elements() to understand the page structure.
  b) Immediately call save_test_case() with 2–4 test cases for that page's functionality.
  c) Call add_bug() for any broken or missing functionality you observe.
  d) Call mark_page_explored() before moving on.
STEP 3 — After finishing the priority pages, check get_session_state() for other unexplored pages.

CRITICAL RULES:
- ⛔ NEVER navigate to a URL listed in the "ALREADY EXPLORED" block above. They are done.
- If a page redirects you somewhere already explored → go back and pick a different target.
- If a click, type, or navigation fails → SKIP it immediately, do NOT retry.
- Generate test cases ON THE PAGE, not after leaving it.
- Aim for at least 4 new test cases this iteration.`;

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

    // 🔴 Fix: Execute newly generated test cases immediately instead of waiting for retest phase
    if (!this.isStopped) {
      const executionResult = await this.executeNewTestCases(preExistingIds);
      return {
        ...result,
        testsExecuted: executionResult.testsExecuted,
        testsPassed: executionResult.testsPassed,
        testsFailed: executionResult.testsFailed
      };
    }

    return result;
  }

  /**
   * Execute test cases that were newly created during the most recent exploration.
   * Capped at MAX_INLINE_TESTS per iteration to keep the loop responsive.
   */
  private async executeNewTestCases(preExistingIds: Set<string>): Promise<{
    testsExecuted: number;
    testsPassed: number;
    testsFailed: number;
  }> {
    const MAX_INLINE_TESTS = 5;
    const testExecutorUrl = process.env.TEST_EXECUTOR_URL || 'http://localhost:3001';

    const allTestCases = await this.repository.getTestCases(this.sessionId);
    const newTestCases = allTestCases
      .filter(tc => !preExistingIds.has(tc.id))
      .slice(0, MAX_INLINE_TESTS);

    if (newTestCases.length === 0) {
      return { testsExecuted: 0, testsPassed: 0, testsFailed: 0 };
    }

    logger.info('Executing newly generated test cases', {
      sessionId: this.sessionId,
      count: newTestCases.length
    });

    emitToSession(this.sessionId, {
      type: 'progress',
      data: {
        phase: 'test_execution',
        message: `Executing ${newTestCases.length} newly generated test${newTestCases.length > 1 ? 's' : ''}…`,
        count: newTestCases.length
      }
    });

    let passed = 0;
    let failed = 0;

    for (const testCase of newTestCases) {
      if (this.isStopped) break;

      // Normalise steps — JSONB comes back as a parsed array from pg, but guard
      // against it being a JSON string (double-serialised) or missing entirely.
      const rawSteps = (testCase as any).steps;
      const rawStepsArr: any[] = Array.isArray(rawSteps)
        ? rawSteps
        : (typeof rawSteps === 'string' ? (() => { try { return JSON.parse(rawSteps); } catch { return []; } })() : []);

      // ── Post-process steps: ensure navigate steps have a URL, ensure every
      //    step has an id (step_results table requires non-null step_id) ──────
      const websiteUrl = (testCase as any).source_page_url || this.config.targetUrl;
      const steps: any[] = rawStepsArr.map((step: any) => {
        const processed = { ...step };
        // Ensure step has a stable id — required by the step_results DB constraint
        if (!processed.id) {
          processed.id = require('crypto').randomUUID();
        }
        // Fill in missing URL for navigate actions (Claude often omits it)
        if (processed.action === 'navigate' && !processed.value && !processed.target?.attributes?.href) {
          processed.value = websiteUrl;
        }
        return processed;
      });

      // ── Emit "running" event so the user sees real-time progress ──────────
      emitToSession(this.sessionId, {
        type: 'test_run_start',
        data: { testCaseId: testCase.id, testCaseName: testCase.name }
      });

      try {
        const response = await axios.post(
          `${testExecutorUrl}/api/execute-test`,
          {
            testCase: {
              id: testCase.id,
              name: testCase.name,
              description: testCase.description || testCase.name,
              // website_url tells the test-runner where to navigate at the start of the test
              website_url: testCase.source_page_url || this.config.targetUrl,
              steps,                    // always an array (normalized above)
              selectors: testCase.selectors || {}
            },
            headless: true,
            useIsolatedContext: true
          },
          { timeout: 5 * 60 * 1000 } // 5-minute limit per test
        );

        const res = response.data;
        const allPassed = res.status === 'completed' && res.allStepsPassed;
        const status: 'passed' | 'failed' = allPassed ? 'passed' : 'failed';

        if (allPassed) passed++; else failed++;

        const failedStep = res.stepResults?.findIndex((s: any) => s.status === 'failed') ?? -1;
        const failureReason = failedStep >= 0 ? res.stepResults?.[failedStep]?.error : undefined;

        try {
          await this.repository.addTestRun(this.sessionId, testCase.id, {
            status,
            durationMs: res.durationMs,
            stepsTotal: steps.length,
            stepsCompleted: res.stepResults?.length ?? 0,
            failureStepIndex: failedStep >= 0 ? failedStep : undefined,
            failureReason
          });
        } catch (saveErr: any) {
          logger.warn('Failed to persist test run result', { testCaseId: testCase.id, error: saveErr.message });
        }

        // ── Emit result so UI can show ✅/❌ immediately ──────────────────
        emitToSession(this.sessionId, {
          type: 'test_run_result',
          data: {
            testCaseId: testCase.id,
            testCaseName: testCase.name,
            status,
            durationMs: res.durationMs,
            failureReason
          }
        });

      } catch (error: any) {
        failed++;
        logger.warn('Inline test execution failed', {
          sessionId: this.sessionId,
          testCaseId: testCase.id,
          error: error.message
        });

        // Save error state — guard so this can't bubble up and abort the loop
        try {
          await this.repository.addTestRun(this.sessionId, testCase.id, {
            status: 'error',
            failureReason: error.message
          });
        } catch (saveErr: any) {
          logger.warn('Failed to persist test run error state', { testCaseId: testCase.id, error: saveErr.message });
        }

        emitToSession(this.sessionId, {
          type: 'test_run_result',
          data: {
            testCaseId: testCase.id,
            testCaseName: testCase.name,
            status: 'error',
            failureReason: error.message
          }
        });
      }
    }

    logger.info('Inline test execution complete', {
      sessionId: this.sessionId,
      total: newTestCases.length,
      passed,
      failed
    });

    return { testsExecuted: newTestCases.length, testsPassed: passed, testsFailed: failed };
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
      await this.claudeSession.abort();
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
