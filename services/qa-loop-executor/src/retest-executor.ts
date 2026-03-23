import { createLogger } from '../../shared/logger/logger';
import { QALoopRepository, QALoopTestCase, QALoopPage } from './repositories/qa-loop-repository';
import { emitToSession } from './api/websocket';
import { DetectiveAgent, RootCauseAnalysis, TestFailure } from './agents/detective-agent';
import { DEFAULT_CONFIG } from './config/optimization-config';
import axios from 'axios';
import crypto from 'crypto';

const logger = createLogger('retest-executor');

export interface RetestResult {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  selfHealed: number;
  duration: number;
  results: TestRunResult[];
  changeReport?: ChangeReport;
}

export interface TestRunResult {
  testCaseId: string;
  testCaseName: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number;
  failureReason?: string;
  humanError?: string;
  failureStep?: number;
  failureType?: string;
  selfHealed?: boolean;
  healedSelectors?: string[];
  rootCauseAnalysis?: RootCauseAnalysis;
}

export interface ChangeReport {
  changedPages: PageChange[];
  newPages: string[];
  unchangedCount: number;
  totalChecked: number;
}

export interface PageChange {
  url: string;
  changeType: 'modified' | 'removed' | 'error';
  oldHash?: string;
  newHash?: string;
}

export class RetestExecutor {
  private sessionId: string;
  private sourceSessionId: string;
  private mode: 'quick' | 'smart';
  private repository: QALoopRepository;
  private testExecutorUrl: string;
  private detectiveAgent: DetectiveAgent;
  private enableAutoAnalysis: boolean;

  constructor(
    sessionId: string,
    sourceSessionId: string,
    mode: 'quick' | 'smart' = 'quick',
    enableAutoAnalysis: boolean = true
  ) {
    this.sessionId = sessionId;
    this.sourceSessionId = sourceSessionId;
    this.mode = mode;
    this.repository = new QALoopRepository();
    this.testExecutorUrl = process.env.TEST_EXECUTOR_URL || 'http://localhost:3001';
    this.detectiveAgent = new DetectiveAgent(sessionId);
    this.enableAutoAnalysis = enableAutoAnalysis;
  }

  async run(): Promise<RetestResult> {
    logger.info('Starting retest', {
      sessionId: this.sessionId,
      sourceSessionId: this.sourceSessionId,
      mode: this.mode
    });

    const startTime = Date.now();
    const results: TestRunResult[] = [];
    let changeReport: ChangeReport | undefined;

    try {
      // Get test cases from source session
      let testCases = await this.repository.getTestCases(this.sourceSessionId, { active: true });

      logger.info('Found test cases to run', { count: testCases.length });

      // If smart mode, detect changes first and filter affected tests
      if (this.mode === 'smart') {
        changeReport = await this.detectChanges();

        emitToSession(this.sessionId, {
          type: 'progress',
          data: {
            phase: 'change_detection',
            changes: changeReport
          }
        });

        // Filter to only run tests affected by changes
        if (changeReport.changedPages.length > 0 || changeReport.newPages.length > 0) {
          const changedUrls = new Set([
            ...changeReport.changedPages.map(p => p.url),
            ...changeReport.newPages
          ]);

          testCases = testCases.filter(tc => {
            // Check if test case is related to changed pages
            const sourcePageUrl = tc.source_page_url;
            if (sourcePageUrl && changedUrls.has(sourcePageUrl)) {
              return true;
            }
            // Also check step URLs
            const stepUrls = tc.steps
              .filter((s: any) => s.action === 'navigate')
              .map((s: any) => s.target);
            return stepUrls.some((url: string) => changedUrls.has(url));
          });

          logger.info('Filtered to affected test cases', {
            original: testCases.length,
            filtered: testCases.length
          });
        }
      }

      // Run test cases in parallel batches using maxConcurrentTests (4.8)
      const maxConcurrent = DEFAULT_CONFIG.parallel.maxConcurrentTests || 2;

      // requires_auth skip removed — a "failed" result is more useful than "skipped"

      /** Execute one test case: run → emit result → persist to DB */
      const runOne = async (testCase: QALoopTestCase, index: number): Promise<TestRunResult> => {
        emitToSession(this.sessionId, {
          type: 'progress',
          data: { phase: 'testing', current: index + 1, total: testCases.length, testCase: testCase.name }
        });

        const result = await this.executeTestCase(testCase);

        emitToSession(this.sessionId, {
          type: 'tool_result',
          data: { tool: 'test_execution', testCase: testCase.name, status: result.status, selfHealed: result.selfHealed }
        });

        await this.repository.addTestRun(this.sessionId, testCase.id, {
          status: result.status,
          durationMs: result.duration,
          stepsTotal: testCase.steps.length,
          stepsCompleted: result.failureStep !== undefined ? result.failureStep : testCase.steps.length,
          failureStepIndex: result.failureStep,
          failureReason: result.failureReason,
          failureType: result.failureType,
          selfHealed: result.selfHealed,
          healedSelectors: result.healedSelectors
        });

        return result;
      };

      // Process in concurrent batches of maxConcurrent (linear → parallel, 4.8)
      for (let batch = 0; batch < testCases.length; batch += maxConcurrent) {
        const chunk = testCases.slice(batch, batch + maxConcurrent);
        const batchResults = await Promise.all(
          chunk.map((tc, idx) => runOne(tc, batch + idx))
        );
        results.push(...batchResults);
      }

      const duration = Date.now() - startTime;
      const summary = this.calculateSummary(results, duration, changeReport);

      // Update session progress
      await this.repository.updateSessionProgress(this.sessionId, {
        testsGenerated: results.length,
        bugsFound: results.filter(r => r.status === 'failed').length
      });

      emitToSession(this.sessionId, {
        type: 'session_complete',
        data: summary
      });

      logger.info('Retest completed', { sessionId: this.sessionId, summary });
      return summary;

    } catch (error: any) {
      logger.error('Retest failed', { sessionId: this.sessionId, error: error.message });
      throw error;
    }
  }

  private async executeTestCase(testCase: QALoopTestCase): Promise<TestRunResult> {
    // If the test case has playwright_code, prefer the direct Playwright runner
    if (testCase.playwright_code) {
      return this.executeViaPlaywright(testCase);
    }

    return this.executeViaSteps(testCase);
  }

  /**
   * Execute a test case using its Playwright code directly.
   */
  private async executeViaPlaywright(testCase: QALoopTestCase): Promise<TestRunResult> {
    const startTime = Date.now();

    try {
      const response = await axios.post(`${this.testExecutorUrl}/api/run-playwright`, {
        playwrightCode: testCase.playwright_code,
        timeoutMs: 30_000,
      }, {
        timeout: 60_000,
      });

      const duration = Date.now() - startTime;
      const result = response.data;

      if (result.passed) {
        return {
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          status: 'passed',
          duration,
        };
      } else {
        return {
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          status: 'failed',
          duration,
          failureReason: result.error || 'Playwright test failed',
          humanError: result.humanError,
          failureType: 'assertion',
        };
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        status: 'error',
        duration,
        failureReason: error.message,
        failureType: 'network_error',
      };
    }
  }

  /**
   * Execute a test case using the step-based test executor (legacy).
   */
  private async executeViaSteps(testCase: QALoopTestCase): Promise<TestRunResult> {
    const startTime = Date.now();

    try {
      // Call test executor service to run the test
      const response = await axios.post(`${this.testExecutorUrl}/api/execute-test`, {
        testCase: {
          id: testCase.id,
          name: testCase.name,
          steps: testCase.steps,
          selectors: testCase.selectors
        },
        headless: true,
        useIsolatedContext: true
      }, {
        timeout: 5 * 60 * 1000 // 5 minute timeout per test
      });

      const duration = Date.now() - startTime;
      const result = response.data;

      if (result.status === 'completed' && result.allStepsPassed) {
        return {
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          status: 'passed',
          duration
        };
      } else if (result.status === 'completed') {
        // Find failed step
        const failedStep = result.stepResults?.findIndex((s: any) => s.status === 'failed');
        const failureReason = result.stepResults?.[failedStep]?.error || 'Unknown failure';
        const failureType = this.classifyFailure(failureReason);

        // Attempt self-healing if it's a selector failure
        if (failureType === 'selector') {
          const healResult = await this.attemptSelfHeal(testCase, failedStep, failureReason);
          if (healResult.success) {
            // Update test case with new selectors
            if (healResult.newSelectors) {
              await this.repository.updateTestCaseSelectors(testCase.id, healResult.newSelectors);
            }

            return {
              testCaseId: testCase.id,
              testCaseName: testCase.name,
              status: 'passed',
              duration: Date.now() - startTime,
              selfHealed: true,
              healedSelectors: healResult.healedSelectors
            };
          }
        }

        // Auto-analyze failure with Detective Agent
        let rootCauseAnalysis: RootCauseAnalysis | undefined;
        if (this.enableAutoAnalysis) {
          try {
            rootCauseAnalysis = await this.analyzeFailure(testCase, failedStep, failureReason, failureType);
          } catch (analysisError) {
            logger.warn('Auto-analysis failed', { error: analysisError });
          }
        }

        return {
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          status: 'failed',
          duration,
          failureReason,
          failureStep: failedStep,
          failureType,
          rootCauseAnalysis
        };
      } else {
        // Auto-analyze error
        let rootCauseAnalysis: RootCauseAnalysis | undefined;
        if (this.enableAutoAnalysis) {
          try {
            rootCauseAnalysis = await this.analyzeFailure(testCase, 0, result.error || 'Unknown error', 'execution_error');
          } catch (analysisError) {
            logger.warn('Auto-analysis failed', { error: analysisError });
          }
        }

        return {
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          status: 'error',
          duration,
          failureReason: result.error || 'Test execution error',
          failureType: 'execution_error',
          rootCauseAnalysis
        };
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Auto-analyze exception
      let rootCauseAnalysis: RootCauseAnalysis | undefined;
      if (this.enableAutoAnalysis) {
        try {
          rootCauseAnalysis = await this.analyzeFailure(testCase, 0, error.message, 'network_error');
        } catch (analysisError) {
          logger.warn('Auto-analysis failed', { error: analysisError });
        }
      }

      return {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        status: 'error',
        duration,
        failureReason: error.message,
        failureType: 'network_error',
        rootCauseAnalysis
      };
    }
  }

  /**
   * Analyze test failure using Detective Agent
   */
  private async analyzeFailure(
    testCase: QALoopTestCase,
    failedStepIndex: number,
    failureReason: string,
    failureType: string
  ): Promise<RootCauseAnalysis> {
    logger.info('Auto-analyzing failure', {
      testCaseId: testCase.id,
      failureType,
      failedStep: failedStepIndex
    });

    const failure: TestFailure = {
      id: `${testCase.id}-${Date.now()}`,
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      failedStepIndex,
      failureReason,
      failureType,
      pageUrl: testCase.source_page_url || undefined,
      timestamp: new Date()
    };

    const analysis = await this.detectiveAgent.analyzeFailure(failure);

    // Save the analysis
    await this.detectiveAgent.saveAnalysis(analysis);

    // Emit analysis result
    emitToSession(this.sessionId, {
      type: 'progress',
      data: {
        phase: 'analysis_complete',
        testCaseId: testCase.id,
        category: analysis.category,
        confidence: analysis.confidence,
        rootCause: analysis.rootCause,
        fixSuggestion: analysis.fixSuggestion
      }
    });

    return analysis;
  }

  private classifyFailure(reason: string): string {
    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes('element not found') ||
      lowerReason.includes('selector') ||
      lowerReason.includes('locator') ||
      lowerReason.includes('no element matches')) {
      return 'selector';
    }

    if (lowerReason.includes('timeout')) {
      return 'timeout';
    }

    if (lowerReason.includes('assertion') || lowerReason.includes('expect')) {
      return 'assertion';
    }

    if (lowerReason.includes('network') || lowerReason.includes('connection')) {
      return 'network';
    }

    return 'unknown';
  }

  private async attemptSelfHeal(
    testCase: QALoopTestCase,
    failedStepIndex: number,
    failureReason: string
  ): Promise<{
    success: boolean;
    healedSelectors?: string[];
    newSelectors?: Record<string, any>;
  }> {
    logger.info('Attempting self-heal', {
      testCaseId: testCase.id,
      failedStep: failedStepIndex
    });

    const failedStep = testCase.steps[failedStepIndex];
    if (!failedStep) {
      return { success: false };
    }

    try {
      // Strategy 1: Try alternative selectors from the saved selectors object
      const savedSelectors = testCase.selectors || {};
      const stepId = `step_${failedStepIndex}`;
      const alternativeSelectors = savedSelectors[stepId]?.alternatives || [];

      for (const altSelector of alternativeSelectors) {
        const success = await this.tryAlternativeSelector(testCase, failedStepIndex, altSelector);
        if (success) {
          logger.info('Self-heal succeeded with alternative selector', {
            testCaseId: testCase.id,
            selector: altSelector
          });

          // Update selectors with the working one
          const newSelectors = { ...savedSelectors };
          newSelectors[stepId] = {
            ...newSelectors[stepId],
            primary: altSelector,
            lastHealed: new Date().toISOString()
          };

          return {
            success: true,
            healedSelectors: [altSelector],
            newSelectors
          };
        }
      }

      // Strategy 2: Use AI to find new selector based on step description
      const aiSelector = await this.findSelectorWithAI(testCase, failedStepIndex);
      if (aiSelector) {
        const success = await this.tryAlternativeSelector(testCase, failedStepIndex, aiSelector);
        if (success) {
          logger.info('Self-heal succeeded with AI-generated selector', {
            testCaseId: testCase.id,
            selector: aiSelector
          });

          const newSelectors = { ...savedSelectors };
          newSelectors[stepId] = {
            primary: aiSelector,
            alternatives: [...alternativeSelectors, failedStep.target],
            lastHealed: new Date().toISOString(),
            healedBy: 'ai'
          };

          return {
            success: true,
            healedSelectors: [aiSelector],
            newSelectors
          };
        }
      }

      return { success: false };

    } catch (error: any) {
      logger.error('Self-heal attempt failed', {
        testCaseId: testCase.id,
        error: error.message
      });
      return { success: false };
    }
  }

  private async tryAlternativeSelector(
    testCase: QALoopTestCase,
    stepIndex: number,
    selector: string
  ): Promise<boolean> {
    try {
      // Create a modified test case with just this step and the new selector
      const modifiedSteps = [...testCase.steps];
      modifiedSteps[stepIndex] = {
        ...modifiedSteps[stepIndex],
        target: selector
      };

      // Run only the affected step
      const response = await axios.post(`${this.testExecutorUrl}/api/execute-test`, {
        testCase: {
          id: testCase.id,
          name: testCase.name,
          steps: modifiedSteps.slice(0, stepIndex + 1) // Only run up to the failing step
        },
        headless: true,
        useIsolatedContext: true
      }, {
        timeout: 60000
      });

      return response.data.status === 'completed' && response.data.allStepsPassed;
    } catch (error) {
      return false;
    }
  }

  private async findSelectorWithAI(
    testCase: QALoopTestCase,
    stepIndex: number
  ): Promise<string | null> {
    try {
      const failedStep = testCase.steps[stepIndex];

      // Call AI service to find selector
      const response = await axios.post(`${this.testExecutorUrl}/api/detect-elements`, {
        contextDescription: failedStep.description || failedStep.target,
        elementType: failedStep.action === 'click' ? 'button,a,input[type="submit"]' : 'input,textarea',
        maxResults: 3
      }, {
        timeout: 30000
      });

      const candidates = response.data?.elements || [];
      if (candidates.length > 0) {
        return candidates[0].selector;
      }

      return null;
    } catch (error) {
      logger.warn('AI selector lookup failed', { error });
      return null;
    }
  }

  private async detectChanges(): Promise<ChangeReport> {
    logger.info('Detecting changes', { sourceSessionId: this.sourceSessionId });

    const knownPages = await this.repository.getExploredPages(this.sourceSessionId);
    const changedPages: PageChange[] = [];
    const newPages: string[] = [];
    let unchangedCount = 0;

    for (const page of knownPages) {
      try {
        // Fetch current page state
        const response = await axios.post(`${this.testExecutorUrl}/api/capture-page`, {
          url: page.url,
          timeout: 30000
        }, {
          timeout: 45000
        });

        const currentHtml = response.data.html || '';
        const currentHash = crypto.createHash('sha256').update(currentHtml).digest('hex');

        if (page.html_hash && currentHash !== page.html_hash) {
          changedPages.push({
            url: page.url,
            changeType: 'modified',
            oldHash: page.html_hash,
            newHash: currentHash
          });
        } else {
          unchangedCount++;
        }

        // Extract and check for new links
        const links = this.extractLinks(currentHtml, page.url);
        for (const link of links) {
          const isKnown = knownPages.some(p => p.url === link);
          if (!isKnown && !newPages.includes(link)) {
            newPages.push(link);
          }
        }

      } catch (error: any) {
        // Page might have been removed
        if (error.response?.status === 404) {
          changedPages.push({
            url: page.url,
            changeType: 'removed'
          });
        } else {
          changedPages.push({
            url: page.url,
            changeType: 'error'
          });
        }
      }
    }

    const report: ChangeReport = {
      changedPages,
      newPages: newPages.slice(0, 20), // Limit new pages
      unchangedCount,
      totalChecked: knownPages.length
    };

    logger.info('Change detection complete', {
      changed: changedPages.length,
      new: newPages.length,
      unchanged: unchangedCount
    });

    return report;
  }

  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      try {
        const href = match[1];
        if (href.startsWith('#') || href.startsWith('javascript:')) continue;

        const url = new URL(href, baseUrl);
        const base = new URL(baseUrl);

        // Only include same-origin links
        if (url.origin === base.origin) {
          links.push(url.href);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }

    return [...new Set(links)];
  }

  private calculateSummary(
    results: TestRunResult[],
    duration: number,
    changeReport?: ChangeReport
  ): RetestResult {
    return {
      totalTests: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
      selfHealed: results.filter(r => r.selfHealed).length,
      duration,
      results,
      changeReport
    };
  }

  /**
   * Run failure correlation analysis after all tests complete
   */
  async correlateFailures(results: TestRunResult[]): Promise<any> {
    const failures = results
      .filter(r => r.status === 'failed' || r.status === 'error')
      .map(r => ({
        id: `${r.testCaseId}-${Date.now()}`,
        testCaseId: r.testCaseId,
        testCaseName: r.testCaseName,
        failedStepIndex: r.failureStep || 0,
        failureReason: r.failureReason || 'Unknown',
        failureType: r.failureType || 'unknown',
        timestamp: new Date()
      }));

    if (failures.length < 2) {
      return { correlations: [], message: 'Not enough failures to correlate' };
    }

    const correlations = await this.detectiveAgent.correlateFailures(failures);

    // Emit correlation results
    emitToSession(this.sessionId, {
      type: 'progress',
      data: {
        phase: 'correlations_found',
        correlationsCount: correlations.length,
        correlations
      }
    });

    return { correlations };
  }

  /**
   * Get analysis summary
   */
  getAnalysisSummary(results: TestRunResult[]): {
    analyzedCount: number;
    byCategory: Record<string, number>;
    flakyDetected: number;
    bugsDetected: number;
    environmentIssues: number;
    testIssues: number;
  } {
    const analyzed = results.filter(r => r.rootCauseAnalysis);

    const byCategory: Record<string, number> = {};
    let flakyDetected = 0;
    let bugsDetected = 0;
    let environmentIssues = 0;
    let testIssues = 0;

    for (const result of analyzed) {
      const category = result.rootCauseAnalysis!.category;
      byCategory[category] = (byCategory[category] || 0) + 1;

      switch (category) {
        case 'flaky':
          flakyDetected++;
          break;
        case 'bug':
          bugsDetected++;
          break;
        case 'environment':
          environmentIssues++;
          break;
        case 'test_issue':
        case 'data_issue':
          testIssues++;
          break;
      }
    }

    return {
      analyzedCount: analyzed.length,
      byCategory,
      flakyDetected,
      bugsDetected,
      environmentIssues,
      testIssues
    };
  }
}
