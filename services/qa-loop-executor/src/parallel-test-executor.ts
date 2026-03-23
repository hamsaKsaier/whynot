import axios from 'axios';
import { createLogger } from '../../shared/logger/logger';
import { LoopConfig } from './loop-orchestrator';
import { QALoopRepository } from './repositories/qa-loop-repository';
import { emitToSession } from './api/websocket';

const logger = createLogger('parallel-test-executor');

/**
 * Information about a test where Claude's observed result differs from
 * the mechanical execution result.
 */
export interface MismatchInfo {
  testCaseId: string;
  testCaseName: string;
  observedResult: 'pass' | 'fail';
  executionResult: 'passed' | 'failed' | 'error';
  failureStepIndex?: number;
  failureReason?: string;
  steps: any[];
}

/**
 * Executes test cases in parallel with Claude's exploration.
 *
 * When Claude calls `save_test_case()`, the orchestrator pushes the newly
 * created test case into this queue.  The queue processes items one-at-a-time
 * (to avoid overloading the test-executor's browser pool) but runs
 * concurrently with the Claude API conversation loop.
 *
 * After exploration finishes, the orchestrator calls `waitForCompletion()`
 * to ensure all queued tests have been executed before reporting results.
 *
 * Self-healing: Each queued item carries Claude's `observedResult`. After
 * execution we compare it with the mechanical result. Mismatches are tracked
 * and exposed via `getMismatches()` so the orchestrator can run a correction
 * phase.
 */
export class ParallelTestExecutor {
  private queue: Array<{ testCase: any; observedResult: 'pass' | 'fail' }> = [];
  private processing = false;
  private results = { testsExecuted: 0, testsPassed: 0, testsFailed: 0 };
  private mismatches: MismatchInfo[] = [];
  private completionResolvers: Array<() => void> = [];
  private sessionId: string;
  private config: LoopConfig;
  private repository: QALoopRepository;
  private isStopped = false;
  private testExecutorUrl: string;

  constructor(sessionId: string, config: LoopConfig, repository: QALoopRepository) {
    this.sessionId = sessionId;
    this.config = config;
    this.repository = repository;
    this.testExecutorUrl = process.env.TEST_EXECUTOR_URL || 'http://localhost:3001';
  }

  /**
   * Add a test case to the execution queue.  Non-blocking — returns immediately.
   * The test case will be executed in the background.
   *
   * @param observedResult Claude's observed result ('pass' or 'fail'). Defaults to 'pass'.
   */
  enqueue(testCase: any, observedResult?: 'pass' | 'fail'): void {
    if (this.isStopped) return;
    this.queue.push({ testCase, observedResult: observedResult || 'pass' });
    logger.info('Test case queued for parallel execution', {
      sessionId: this.sessionId,
      testCaseId: testCase.id,
      name: testCase.name,
      observedResult: observedResult || 'pass',
      queueLength: this.queue.length
    });
    // Kick off processing (no-op if already processing)
    this.processNext();
  }

  /**
   * Internal: pick the next item off the queue and execute it.
   * Recursively chains to handle subsequent items.
   */
  private async processNext(): Promise<void> {
    // Nothing to do, or already running, or stopped
    if (this.processing || this.queue.length === 0 || this.isStopped) {
      // If the queue is fully drained and nothing is processing, resolve waiters
      if (this.queue.length === 0 && !this.processing) {
        this.resolveWaiters();
      }
      return;
    }

    this.processing = true;
    const item = this.queue.shift()!;

    try {
      await this.executeOne(item.testCase, item.observedResult);
    } catch (err: any) {
      logger.error('Unexpected error in parallel test execution', {
        sessionId: this.sessionId,
        testCaseId: item.testCase.id,
        error: err.message
      });
    } finally {
      this.processing = false;
      // Continue to next item in the queue
      this.processNext();
    }
  }

  /**
   * Execute a single test case against the test-executor service.
   * If the test case has playwright_code, run it directly via the Playwright runner.
   * Otherwise, fall back to the step-based execution.
   * Compares the result with Claude's observedResult to detect mismatches.
   */
  private async executeOne(testCase: any, observedResult: 'pass' | 'fail'): Promise<void> {
    // If playwright_code is available, use the direct Playwright runner
    if (testCase.playwright_code) {
      return this.executeViaPlaywright(testCase, observedResult);
    }

    // ── 1. Normalize steps ──────────────────────────────────────────────
    const rawSteps = testCase.steps;
    const rawStepsArr: any[] = Array.isArray(rawSteps)
      ? rawSteps
      : (typeof rawSteps === 'string'
        ? (() => { try { return JSON.parse(rawSteps); } catch { return []; } })()
        : []);

    const websiteUrl = testCase.source_page_url || this.config.targetUrl;

    const steps: any[] = rawStepsArr.map((step: any) => {
      const processed = { ...step };

      // Ensure step has a stable id
      if (!processed.id) {
        processed.id = require('crypto').randomUUID();
      }

      // Fill in missing URL for navigate actions
      if (processed.action === 'navigate') {
        if (typeof processed.target === 'string' && processed.target.startsWith('http')) {
          processed.value = processed.value || processed.target;
          processed.target = undefined;
        }
        if (!processed.value && !processed.target?.attributes?.href) {
          processed.value = websiteUrl;
        }
      }

      // Smart assertion types — don't convert to selectors
      const assertionActions = [
        'assert_url_contains', 'assert_url_equals', 'assert_text_visible',
        'assert_no_console_errors', 'assert_input_value',
        'assert_element_exists', 'assert_element_not_exists',
        'assert_element_visible', 'assert_element_count',
        'assert_attribute_contains'
      ];

      if (typeof processed.target === 'string' && processed.action !== 'navigate' && !assertionActions.includes(processed.action)) {
        const rawTarget = processed.target;
        const selectors: any[] = [];

        // Detect CSS selectors: starts with #, ., [, or contains CSS patterns like tag[attr], tag.class, tag#id
        const isCssSelector = /^[#.\[]|^[a-z]+[#.\[:]|^[a-z]+\s*>/i.test(rawTarget);

        if (rawTarget.startsWith('#')) {
          selectors.push({ type: 'css', value: rawTarget, stability_score: 0.9 });
          selectors.push({ type: 'id', value: rawTarget, stability_score: 0.9 });
        } else if (rawTarget.startsWith('.') || rawTarget.startsWith('[')) {
          selectors.push({ type: 'css', value: rawTarget, stability_score: 0.8 });
        } else if (rawTarget.startsWith('//') || rawTarget.startsWith('xpath=')) {
          selectors.push({ type: 'xpath', value: rawTarget, stability_score: 0.6 });
        } else if (isCssSelector) {
          // Handle CSS selectors like "input[type='email']", "button.submit", "div > span"
          // Also handle comma-separated selector lists — use first one as primary
          const selectorParts = rawTarget.split(',').map((s: string) => s.trim()).filter(Boolean);
          selectorParts.forEach((sel: string, idx: number) => {
            selectors.push({ type: 'css', value: sel, stability_score: 0.85 - idx * 0.05 });
          });
        } else {
          selectors.push({ type: 'text', value: `text="${rawTarget}"`, stability_score: 0.7 });
          selectors.push({ type: 'css', value: `button:has-text("${rawTarget}")`, stability_score: 0.6 });
          selectors.push({ type: 'css', value: `a:has-text("${rawTarget}")`, stability_score: 0.5 });
        }

        processed.target = { text: rawTarget };
        processed.suggested_selectors = selectors;
      }

      return processed;
    });

    // ── 2. Emit "running" event ─────────────────────────────────────────
    emitToSession(this.sessionId, {
      type: 'test_run_start',
      data: { testCaseId: testCase.id, testCaseName: testCase.name }
    });

    // ── 3. Execute via HTTP POST ────────────────────────────────────────
    try {
      const response = await axios.post(
        `${this.testExecutorUrl}/api/execute-test`,
        {
          testCase: {
            id: testCase.id,
            name: testCase.name,
            description: testCase.description || testCase.name,
            website_url: testCase.source_page_url || this.config.targetUrl,
            steps,
            selectors: testCase.selectors || {}
          },
          headless: true,
          useIsolatedContext: true
        },
        { timeout: 5 * 60 * 1000 } // 5-minute limit per test
      );

      const res = response.data;
      const stepResults = res.steps || res.stepResults || [];
      const allPassed = res.status === 'completed' && stepResults.every((s: any) => s.success);
      const status: 'passed' | 'failed' = allPassed ? 'passed' : 'failed';

      if (allPassed) this.results.testsPassed++; else this.results.testsFailed++;
      this.results.testsExecuted++;

      const failedStep = stepResults.findIndex((s: any) => !s.success);
      const failureReason = failedStep >= 0 ? stepResults[failedStep]?.error : undefined;

      // ── 3a. Mismatch detection ────────────────────────────────────────
      // Claude said "pass" but we got "failed" → MISMATCH (Claude's assertion was wrong)
      // Claude said "fail" but we got "passed" → MISMATCH (test steps don't reproduce the bug)
      // Claude said "pass" and we got "passed" → MATCH ✅
      // Claude said "fail" and we got "failed" → MATCH ✅
      const isMismatch =
        (observedResult === 'pass' && status === 'failed') ||
        (observedResult === 'fail' && status === 'passed');

      if (isMismatch) {
        this.mismatches.push({
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          observedResult,
          executionResult: status,
          failureStepIndex: failedStep >= 0 ? failedStep : undefined,
          failureReason,
          steps: rawStepsArr
        });
        logger.warn('Mismatch detected', {
          sessionId: this.sessionId,
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          observedResult,
          executionResult: status,
          failureReason
        });
      }

      // Save test run to DB (with mismatch info)
      try {
        await this.repository.addTestRun(this.sessionId, testCase.id, {
          status,
          durationMs: res.total_duration_ms || res.durationMs,
          stepsTotal: steps.length,
          stepsCompleted: stepResults.length,
          failureStepIndex: failedStep >= 0 ? failedStep : undefined,
          failureReason,
          observedResult,
          isMismatch
        });
      } catch (saveErr: any) {
        logger.warn('Failed to persist test run result', { testCaseId: testCase.id, error: saveErr.message });
      }

      // ── 4. Emit result (with mismatch info) ──────────────────────────
      emitToSession(this.sessionId, {
        type: 'test_run_result',
        data: {
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          status,
          durationMs: res.durationMs,
          failureReason,
          observedResult,
          isMismatch
        }
      });

      logger.info('Parallel test execution completed', {
        sessionId: this.sessionId,
        testCaseId: testCase.id,
        status,
        observedResult,
        isMismatch,
        durationMs: res.durationMs
      });

    } catch (error: any) {
      this.results.testsFailed++;
      this.results.testsExecuted++;

      // Error is always a mismatch if Claude said "pass"
      const isMismatch = observedResult === 'pass';
      if (isMismatch) {
        this.mismatches.push({
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          observedResult,
          executionResult: 'error',
          failureReason: error.message,
          steps: rawStepsArr
        });
      }

      logger.warn('Parallel test execution failed', {
        sessionId: this.sessionId,
        testCaseId: testCase.id,
        observedResult,
        isMismatch,
        error: error.message
      });

      // Save error state
      try {
        await this.repository.addTestRun(this.sessionId, testCase.id, {
          status: 'error',
          failureReason: error.message,
          observedResult,
          isMismatch
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
          failureReason: error.message,
          observedResult,
          isMismatch
        }
      });
    }
  }

  /**
   * Execute a test case using its playwright_code via the test-executor's
   * /api/run-playwright endpoint.
   */
  private async executeViaPlaywright(testCase: any, observedResult: 'pass' | 'fail'): Promise<void> {
    // Only skip tests explicitly tagged as requiring auth when no credentials are available.
    // Do NOT skip based on heuristic pattern matching — only skip when requires_auth === true.
    if (testCase.requires_auth === true && !this.config.loginCredentials) {
      logger.info('Skipping test — references authenticated page but no credentials available', {
        sessionId: this.sessionId,
        testCaseId: testCase.id,
      });
      try {
        await this.repository.addTestRun(this.sessionId, testCase.id, {
          status: 'skipped',
          failureReason: 'Skipped: test references authenticated page but no credentials available for verification browser',
          observedResult,
          isMismatch: false,
        });
      } catch (saveErr: any) {
        logger.warn('Failed to persist skipped test run', { testCaseId: testCase.id, error: saveErr.message });
      }
      emitToSession(this.sessionId, {
        type: 'test_run_result',
        data: {
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          status: 'skipped',
          failureReason: 'No credentials for verification browser',
          observedResult,
          isMismatch: false,
          runner: 'playwright',
        }
      });
      return;
    }

    emitToSession(this.sessionId, {
      type: 'test_run_start',
      data: { testCaseId: testCase.id, testCaseName: testCase.name, runner: 'playwright' }
    });

    try {
      const response = await axios.post(
        `${this.testExecutorUrl}/api/run-playwright`,
        {
          playwrightCode: testCase.playwright_code,
          timeoutMs: 30_000,
          credentials: this.config.loginCredentials ?? undefined,
        },
        { timeout: 60_000 }
      );

      const res = response.data;
      const status: 'passed' | 'failed' = res.passed ? 'passed' : 'failed';

      if (res.passed) this.results.testsPassed++; else this.results.testsFailed++;
      this.results.testsExecuted++;

      // Mismatch detection
      const isMismatch =
        (observedResult === 'pass' && status === 'failed') ||
        (observedResult === 'fail' && status === 'passed');

      // For Playwright runner: map result to confirmed/mismatch
      const finalStatus = isMismatch ? 'mismatch' : (status === 'passed' ? 'confirmed' : status);

      if (isMismatch) {
        this.mismatches.push({
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          observedResult,
          executionResult: status,
          failureReason: res.error,
          steps: testCase.steps || []
        });
        logger.warn('Mismatch detected (Playwright runner)', {
          sessionId: this.sessionId,
          testCaseId: testCase.id,
          observedResult,
          executionResult: status,
        });
      }

      // Persist test run (also updates confidence score via updateTestCaseLastRun)
      try {
        await this.repository.addTestRun(this.sessionId, testCase.id, {
          status,
          durationMs: res.duration,
          stepsTotal: 1,
          stepsCompleted: res.passed ? 1 : 0,
          failureReason: res.error,
          screenshots: res.screenshots,
          observedResult,
          isMismatch,
        });
      } catch (saveErr: any) {
        logger.warn('Failed to persist Playwright test run', { testCaseId: testCase.id, error: saveErr.message });
      }

      emitToSession(this.sessionId, {
        type: 'test_run_result',
        data: {
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          status: finalStatus,
          durationMs: res.duration,
          failureReason: res.error,
          humanError: res.humanError,
          observedResult,
          isMismatch,
          runner: 'playwright',
          screenshots: res.screenshots,
        }
      });

      logger.info('Playwright test execution completed', {
        sessionId: this.sessionId,
        testCaseId: testCase.id,
        status: finalStatus,
        observedResult,
        isMismatch,
        duration: res.duration,
      });

    } catch (error: any) {
      this.results.testsFailed++;
      this.results.testsExecuted++;

      const isMismatch = observedResult === 'pass';
      if (isMismatch) {
        this.mismatches.push({
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          observedResult,
          executionResult: 'error',
          failureReason: error.message,
          steps: testCase.steps || []
        });
      }

      logger.warn('Playwright test execution failed', {
        sessionId: this.sessionId,
        testCaseId: testCase.id,
        error: error.message,
      });

      try {
        await this.repository.addTestRun(this.sessionId, testCase.id, {
          status: 'error',
          failureReason: error.message,
          observedResult,
          isMismatch,
        });
      } catch (saveErr: any) {
        logger.warn('Failed to persist Playwright test run error', { testCaseId: testCase.id, error: saveErr.message });
      }

      emitToSession(this.sessionId, {
        type: 'test_run_result',
        data: {
          testCaseId: testCase.id,
          testCaseName: testCase.name,
          status: 'error',
          failureReason: error.message,
          observedResult,
          isMismatch,
          runner: 'playwright',
        }
      });
    }
  }

  /**
   * Returns a promise that resolves when all currently queued tests
   * have been executed.  If the queue is already empty, resolves immediately.
   */
  async waitForCompletion(): Promise<void> {
    if (this.queue.length === 0 && !this.processing) return;

    logger.info('Waiting for parallel test queue to drain', {
      sessionId: this.sessionId,
      remaining: this.queue.length,
      processing: this.processing
    });

    return new Promise<void>(resolve => {
      this.completionResolvers.push(resolve);
    });
  }

  /** Get execution totals. */
  getResults() {
    return { ...this.results };
  }

  /** Get all mismatches detected during execution. */
  getMismatches(): MismatchInfo[] {
    return [...this.mismatches];
  }

  /** Stop processing — current test finishes but no more are started. */
  stop() {
    this.isStopped = true;
    this.resolveWaiters();
  }

  private resolveWaiters() {
    const waiters = this.completionResolvers.splice(0);
    waiters.forEach(r => r());
  }
}
