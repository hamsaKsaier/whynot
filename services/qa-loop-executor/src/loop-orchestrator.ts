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
        await this.performLogin();
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
   * Run exploration phase using Claude with tiered model selection
   */
  private async runExploration(plan: IterationPlan): Promise<any> {
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

    const prompt = this.currentIteration === 1
      ? `Start exploring ${this.config.targetUrl}. First, call get_session_state() to initialize, then begin systematic exploration.`
      : `Continue exploration. Focus on these targets: ${plan.targets.join(', ')}. First, call get_session_state() to see your current progress.`;

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

    return result;
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
