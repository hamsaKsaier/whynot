import { TestCase, ExecutionResult, StepResult, TestStep } from '../domain/models';
import { PlaywrightController } from '../infrastructure/browser/playwright-controller';
import { HybridSelector } from '../infrastructure/selectors/hybrid-selector';
import { StepExecutor } from './step-executor';
import { SetupExecutor } from './setup-executor';
import { FailureReporter } from './failure-reporter';
import { SelectorHealthMonitor } from './selector-health-monitor';
import { BrowserStreamer } from '../infrastructure/browser/browser-streamer';
import { BrowserPool } from '../infrastructure/browser/browser-pool';
import { registerBrowserStream, unregisterBrowserStream } from '../api/websocket-handler';
import { TestCaseRepository } from '../../shared/database/repositories/test-case-repository';
import { BaselineManager } from './baseline-manager';
import { VisualComparator } from './visual-comparator';
import { VisualRegressionRepository } from '../../shared/database/repositories/visual-regression-repository';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('test-runner');

interface ActiveExecution {
  cancelled: boolean;
  browserController?: any;
  browserStreamer?: any;
  isolatedContext?: any;
  pooledContext?: { context: any; page: any } | null;
}

export class TestRunner {
  private aiServiceUrl: string;
  private screenshotsDir: string;
  private browserPool: BrowserPool;
  private usePool: boolean;
  private failureReporter: FailureReporter;
  private selectorHealthMonitor: SelectorHealthMonitor;
  private baselineManager?: BaselineManager;
  private visualComparator?: VisualComparator;
  private visualRegressionRepository?: VisualRegressionRepository;
  private visualRegressionEnabled: boolean;
  private activeExecutions: Map<string, ActiveExecution> = new Map();

  constructor(
    aiServiceUrl: string = 'http://localhost:8000',
    screenshotsDir: string = './screenshots',
    usePool: boolean = true
  ) {
    this.aiServiceUrl = aiServiceUrl;
    this.screenshotsDir = screenshotsDir;
    this.browserPool = BrowserPool.getInstance();
    this.usePool = usePool;
    this.failureReporter = new FailureReporter();
    this.selectorHealthMonitor = new SelectorHealthMonitor();
    
    // Initialize visual regression components
    this.visualRegressionEnabled = process.env.VISUAL_REGRESSION_ENABLED !== 'false';
    if (this.visualRegressionEnabled) {
      this.visualRegressionRepository = new VisualRegressionRepository();
      this.visualComparator = new VisualComparator(aiServiceUrl);
      this.baselineManager = new BaselineManager(this.visualRegressionRepository, this.visualComparator);
    }
  }

  async runTest(
    testCase: TestCase,
    headless: boolean = true,
    providedExecutionId?: string,
    isolate: boolean = true // Default to isolated (fresh context per test)
  ): Promise<ExecutionResult> {
    const executionId = providedExecutionId || uuidv4();
    const startedAt = new Date().toISOString();

    // Fast path: if test case has playwright_code, run it directly
    if ((testCase as any).playwright_code) {
      const { runPlaywrightCode } = require('./playwright-runner');
      try {
        const result = await runPlaywrightCode((testCase as any).playwright_code, { timeoutMs: 30000 });
        return {
          execution_id: executionId,
          test_case_id: testCase.id,
          status: result.passed ? 'completed' : 'failed',
          steps: [],
          total_duration_ms: result.duration,
          screenshots: result.screenshots || [],
          error: result.error,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        };
      } catch (pwError: any) {
        return {
          execution_id: executionId,
          test_case_id: testCase.id,
          status: 'failed',
          steps: [],
          total_duration_ms: 0,
          screenshots: [],
          error: pwError.message,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        };
      }
    }

    const stepResults: StepResult[] = [];
    const screenshots: string[] = [];

    let status: 'running' | 'completed' | 'failed' | 'timeout' | 'paused' | 'cancelled' = 'running';
    let error: string | undefined;
    let browserStreamer: BrowserStreamer | null = null;
    let pooledContext: { context: any; page: any } | null = null;
    let isolatedContext: any = null; // Track isolated context for cleanup
    let testCaseModified = false; // Track if test case was modified during execution

    // Register this execution as active
    const activeExecution: ActiveExecution = { cancelled: false };
    this.activeExecutions.set(executionId, activeExecution);

      // Create fresh controller and executor for THIS test (no sharing!)
      const browserController = new PlaywrightController(this.screenshotsDir);
      
      // Store references for cancellation
      activeExecution.browserController = browserController;
      const hybridSelector = new HybridSelector(this.aiServiceUrl);
      const stepExecutor = new StepExecutor(browserController, hybridSelector, this.aiServiceUrl);
      const setupExecutor = new SetupExecutor(stepExecutor);

    // Helper function to send logs to console and WebSocket
    const sendLog = (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => {
      console.log(message);
      if (browserStreamer) {
        browserStreamer.sendLog(level, message, data);
      }
    };

    sendLog('info', '\n🚀 TEST EXECUTION STARTED');
    sendLog('info', `📝 Test: ${testCase.name}`);
    sendLog('info', `🌐 URL: ${testCase.website_url}`);
    sendLog('info', `📊 Steps: ${testCase.steps.length}`);
    sendLog('info', `🆔 ID: ${executionId}`);
    const modeText = isolate ? 'Isolated (fresh context)' : (this.usePool ? 'Pooled (shared context)' : 'Standard');
    sendLog('info', `⚡ Mode: ${modeText}\n`);

    try {
      sendLog('info', '🔧 Initializing browser...');
      
      if (isolate) {
        // Create fresh isolated context (no cookies/storage from previous tests)
        const browser = await this.browserPool.getBrowser();
        isolatedContext = await browser.newContext({
          viewport: { width: 1920, height: 1080 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ignoreHTTPSErrors: true,
          javaScriptEnabled: true,
        });
        const page = await isolatedContext.newPage();
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(30000);
        browserController.setPage(page);
        browserController.setContext(isolatedContext);
        browserController.setBrowser(browser);
        sendLog('info', '✅ Browser ready (isolated context)\n');
      } else if (this.usePool) {
        // Use browser pool for faster startup (shared context)
        pooledContext = await this.browserPool.acquire();
        browserController.setPage(pooledContext.page);
        activeExecution.pooledContext = pooledContext;
        browserController.setContext(pooledContext.context);
        sendLog('info', '✅ Browser ready (from pool)\n');
      } else {
        // Traditional initialization
        await browserController.initialize(headless);
        sendLog('info', '✅ Browser ready\n');
      }

      // Setup browser streaming
      const page = browserController.getPage();
      if (page) {
        browserStreamer = new BrowserStreamer(page, executionId);
        registerBrowserStream(executionId, browserStreamer);
        activeExecution.browserStreamer = browserStreamer;
        logger.info('Browser streaming setup', { executionId, headless });
        if (!headless) {
          await browserStreamer.startStreaming();
        }
      }

      // Execute setup hooks before test execution
      const hooks = await setupExecutor.loadHooks(testCase.id);
      if (hooks.length > 0) {
        sendLog('info', `🔧 Loading ${hooks.length} setup hook(s)...`);
        const setupResult = await setupExecutor.executeHooks(hooks, sendLog);
        
        if (!setupResult.success) {
          status = 'failed';
          error = `Setup hooks failed: ${setupResult.error}`;
          sendLog('error', `❌ ${error}`);
          throw new Error(error);
        }
      }

      // Check selector health and auto-update test case if needed
      try {
        const updatedTestCase = await this.selectorHealthMonitor.autoUpdateTestCase(testCase, 0.7);
        if (updatedTestCase) {
          sendLog('info', '🧠 Auto-updated test case with proven selectors from learning database');
          testCase = updatedTestCase;
          testCaseModified = true;
        }
      } catch (error: any) {
        sendLog('warn', `⚠️ Selector health check failed: ${error.message}`);
        // Continue with original test case - health check is optional
      }

      // Navigate to website (skip if first step is navigate to same URL)
      const firstStep = testCase.steps[0];
      const skipInitialNav = firstStep?.action === 'navigate' && 
        (firstStep.value || firstStep.target?.attributes?.href) === testCase.website_url;

      if (!skipInitialNav) {
        sendLog('info', `🌐 Navigating to ${testCase.website_url}...`);
        await browserController.navigate(testCase.website_url);
        // Wait extra for SPAs: after networkidle, give JS frameworks time to render
        const page = browserController.getPage();
        if (page) {
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          // Wait for common interactive elements to appear (forms, buttons, inputs)
          await page.waitForSelector('input, button, form, [role="button"]', { timeout: 3000 }).catch(() => {});
        }
        sendLog('info', '✅ Navigation done\n');

        // Don't take screenshot here - we'll get one from the first step if needed
        // Only notify browser streamer of URL change (without screenshot)
        if (browserStreamer) {
          browserStreamer.sendUrlUpdate(testCase.website_url);
        }
      }

      // Track if test case was modified during execution
      const onStepUpdated = (updatedStep: TestStep) => {
        testCaseModified = true;
        // Update the step in the test case
        const stepIndex = testCase.steps.findIndex(s => s.id === updatedStep.id);
        if (stepIndex !== -1) {
          testCase.steps[stepIndex] = updatedStep;
        }
      };

      // Execute steps
      for (let i = 0; i < testCase.steps.length; i++) {
        // Check for cancellation
        if (activeExecution.cancelled) {
          status = 'cancelled';
          error = 'Test execution was cancelled by user';
          sendLog('warn', '\n⚠️ Test execution cancelled');
          break;
        }

        const step = testCase.steps[i];

        sendLog('info', `\n📋 STEP ${i + 1}/${testCase.steps.length}: ${step.description || step.action}`);
        logger.info('Executing step', { stepNumber: i + 1, action: step.action });

        if (browserStreamer) {
          browserStreamer.sendStepStart(step, i);
        }

        try {
          const stepResult = await stepExecutor.executeStep(step, i, sendLog, testCase.id, browserStreamer, onStepUpdated, testCase);
          stepResults.push(stepResult);

          // Capture frame after step (non-blocking for live preview)
          // Note: step-executor already captured screenshot, this is just for live preview
          if (browserStreamer) {
            browserStreamer.captureFrameOnStepComplete(i);
            if (step.action === 'navigate') {
              const url = step.value || step.target?.attributes?.href;
              if (url) {
                browserStreamer.sendUrlUpdate(url);
                // Don't call onNavigation here - it would duplicate the screenshot
              }
            }
          }

          if (browserStreamer) {
            browserStreamer.sendStepComplete(stepResult, i);
          }

          // Perform visual comparison if enabled and screenshot exists
          if (this.visualRegressionEnabled && stepResult.screenshot_path && this.baselineManager) {
            try {
              const baseline = await this.baselineManager.getBaseline(testCase.id, step.id);
              
              if (baseline && this.visualComparator && this.visualRegressionRepository) {
                sendLog('info', `   🔍 Comparing screenshot with baseline...`);
                
                // Compare screenshots
                const comparison = await this.visualComparator.compareScreenshots(
                  baseline.screenshot_path,
                  stepResult.screenshot_path
                );

                // Store comparison result in database
                await this.visualRegressionRepository.createComparison({
                  execution_id: executionId,
                  step_id: step.id,
                  baseline_id: baseline.id,
                  current_screenshot_path: stepResult.screenshot_path,
                  diff_image_path: comparison.diffImagePath || null,
                  pixel_diff_score: comparison.pixelDiffScore,
                  ai_diff_analysis: comparison.aiAnalysis || null,
                  is_regression: comparison.isRegression,
                  regression_severity: comparison.severity,
                  ignored: false
                });

                // Add visual comparison to step result
                stepResult.visual_comparison = comparison;

                if (comparison.isRegression) {
                  const severityEmoji = comparison.severity === 'critical' ? '🔴' : 
                                       comparison.severity === 'high' ? '🟠' : 
                                       comparison.severity === 'medium' ? '🟡' : '🟢';
                  sendLog('warn', `   ${severityEmoji} Visual regression detected (${comparison.severity}): ${comparison.differences.slice(0, 2).join(', ')}`);
                  
                  // Mark step as failed if regression severity is high or critical
                  if (comparison.severity === 'critical' || comparison.severity === 'high') {
                    stepResult.success = false;
                    stepResult.error = `Visual regression detected: ${comparison.differences[0] || 'Significant visual differences found'}`;
                  }
                } else {
                  sendLog('info', `   ✅ No visual regression detected`);
                }
              } else {
                // No baseline exists yet - will be created after successful execution
                logger.debug('No baseline found for step', { testCaseId: testCase.id, stepId: step.id });
              }
            } catch (visualError: any) {
              logger.warn('Visual comparison failed', { error: visualError.message, stepId: step.id });
              // Don't fail the step if visual comparison fails
              sendLog('warn', `   ⚠️ Visual comparison failed: ${visualError.message}`);
            }
          }

          if (stepResult.screenshot_path) {
            screenshots.push(stepResult.screenshot_path);
          }

          if (stepResult.success) {
            sendLog('info', `   ✅ Step ${i + 1} passed (${stepResult.execution_time_ms}ms)`);
          } else {
            sendLog('error', `   ❌ Step ${i + 1} failed: ${stepResult.error}`);
            
            // Report failure if classified
            if (stepResult.failure_analysis) {
              const analysis = stepResult.failure_analysis;
              
              // Check if recovery was attempted and succeeded
              if (analysis.recoverySuccess === true) {
                // Recovery succeeded - step should now be marked as success
                // But if it's still false, recovery fixed selector but action failed
                // In that case, we should continue and let the next attempt handle it
                sendLog('info', `   ✅ Step ${i + 1} recovered, continuing...`);
                // Continue to next step (don't break)
              } else if (analysis.isSystemFailure === true && 
                         analysis.recoveryAttempted === true &&
                         analysis.recoverySuccess === false) {
                // System failure, recovery attempted but failed
                // Pause execution and wait for user input via chatbot
                status = 'paused';
                error = `Step ${i + 1} needs user assistance`;
                if (browserStreamer?.sendAgentMessage) {
                  browserStreamer.sendAgentMessage(i, 'needs_help', '💬 All recovery attempts failed. Opening chatbot for your assistance...');
                }
                // Track system failures
                await this.failureReporter.trackSystemFailure(stepResult, analysis);
                break; // Pause here
              } else if (analysis.isSystemFailure === false) {
                // Application bug - stop execution
                const bugReport = await this.failureReporter.reportApplicationFailure(
                  executionId,
                  stepResult,
                  analysis
                );
                if (bugReport) {
                  sendLog('info', `   🐛 Bug Report: ${analysis.category} (${bugReport.severity} severity)`);
                }
                status = 'failed';
                error = `Step ${i + 1} failed: ${stepResult.error}`;
                break;
              } else {
                // Unknown or no analysis - track as system failure and continue
                // (recovery might have been attempted but not properly marked)
                if (analysis.isSystemFailure === true) {
                  await this.failureReporter.trackSystemFailure(stepResult, analysis);
                }
                // Continue execution to see if next steps work
                sendLog('warn', `   ⚠️ Step ${i + 1} failed but continuing execution...`);
              }
            } else {
              // No analysis available - stop execution
              status = 'failed';
              error = `Step ${i + 1} failed: ${stepResult.error}`;
              break;
            }
          }
        } catch (stepError: any) {
          status = 'failed';
          error = `Step ${i + 1} error: ${stepError.message}`;
          stepResults.push({
            step_id: step.id || `step-${i + 1}`,
            success: false,
            error: stepError.message,
            execution_time_ms: Date.now() - Date.parse(startedAt),
            element_found: false
          });
          if (browserStreamer) {
            browserStreamer.sendStepComplete(stepResults[stepResults.length - 1], i);
          }
          break;
        }
      }

      if (status === 'running') {
        status = 'completed';
      }

    } catch (err: any) {
      status = 'failed';
      logger.error('Test execution error', err);

      if (err.message?.includes('timeout')) {
        error = `Timeout: ${err.message}`;
      } else if (err.message?.includes('navigation')) {
        error = `Navigation failed: ${err.message}`;
      } else {
        error = `Execution failed: ${err.message}`;
      }

      if (stepResults.length > 0) {
        error += ` (completed ${stepResults.length}/${testCase.steps.length} steps)`;
      }
    } finally {
      // Cleanup
      // Remove from active executions
      this.activeExecutions.delete(executionId);
      
      if (browserStreamer) {
        browserStreamer.stopStreaming();
        // Send final result via WebSocket before cleanup
        if (!headless) {
          try {
            browserStreamer.sendFinalResult({
              execution_id: executionId,
              test_case_id: testCase.id,
              status,
              steps: stepResults,
              total_duration_ms: stepResults.reduce((sum, sr) => sum + sr.execution_time_ms, 0),
              screenshots,
              error,
              started_at: startedAt,
              completed_at: new Date().toISOString()
            });
            // Give a moment for the message to be sent before cleanup
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error: any) {
            logger.warn('Error sending final result via WebSocket', { error: error.message, executionId });
          }
        }
        unregisterBrowserStream(executionId);
      }

      // Release browser resources
      if (isolate && isolatedContext) {
        // Close isolated context (test isolation - fresh context per test)
        try {
          const page = browserController.getPage();
          if (page && !page.isClosed()) {
            await page.close();
          }
          if (isolatedContext) {
            await isolatedContext.close();
          }
          logger.debug('Isolated context closed', { executionId });
        } catch (closeError: any) {
          logger.warn('Error closing isolated context', { error: closeError.message });
        }
      } else if (this.usePool && pooledContext) {
        // Return to pool (don't close browser)
        try {
          const page = browserController.getPage();
          if (page) {
            await this.browserPool.release(pooledContext.context, page);
          }
        } catch (releaseError: any) {
          logger.warn('Error releasing to pool', { error: releaseError.message });
        }
      } else {
        // Close browser normally
        try {
          await browserController.close();
      } catch (closeError: any) {
        logger.warn('Error closing browser', { error: closeError.message });
        }
      }
    }

    const totalDuration = stepResults.reduce((sum, sr) => sum + sr.execution_time_ms, 0);
    const completedAt = new Date().toISOString();

    sendLog('info', '\n========================================');
    sendLog('info', `📊 RESULT: ${status === 'completed' ? '✅ PASSED' : '❌ FAILED'}`);
    sendLog('info', `Duration: ${totalDuration}ms | Steps: ${stepResults.filter(s => s.success).length}/${testCase.steps.length} passed`);
    if (error) sendLog('error', `Error: ${error}`);
    sendLog('info', '========================================\n');

    logger.info('Test execution finished', { executionId, status, totalDurationMs: totalDuration });

    // Save updated test case if it was modified during execution
    if (testCaseModified) {
      try {
        const testCaseRepository = new TestCaseRepository();
        await testCaseRepository.update(testCase.id, { steps: testCase.steps });
        logger.info('Test case updated with successful selectors from recovery', { testCaseId: testCase.id });
        sendLog('info', `📝 Test case updated with successful selectors from recovery`);
      } catch (updateError: any) {
        logger.warn('Failed to update test case with successful selectors', { 
          error: updateError.message, 
          testCaseId: testCase.id 
        });
      }
    }

    // Promote execution screenshots as baselines if test passed and visual regression enabled
    if (this.visualRegressionEnabled && status === 'completed' && stepResults.length > 0 && this.baselineManager) {
      try {
        // Collect step screenshots that exist
        const stepScreenshots = stepResults
          .filter(sr => sr.screenshot_path && sr.success)
          .map(sr => ({
            stepId: sr.step_id,
            screenshotPath: sr.screenshot_path!
          }));

        if (stepScreenshots.length > 0) {
          const createdBaselines = await this.baselineManager.promoteExecutionAsBaseline(
            testCase.id,
            executionId,
            stepScreenshots
          );

          if (createdBaselines.length > 0) {
            sendLog('info', `📸 ${createdBaselines.length} baseline(s) created from successful execution`);
            logger.info('Baselines created from execution', {
              testCaseId: testCase.id,
              executionId,
              baselineCount: createdBaselines.length
            });
          }
        }
      } catch (baselineError: any) {
        logger.warn('Failed to promote execution as baseline', {
          error: baselineError.message,
          testCaseId: testCase.id,
          executionId
        });
        // Don't fail execution if baseline promotion fails
      }
    }

    // Save video recording (v2)
    let videoPath: string | null = null;
    try {
      videoPath = await browserController.saveVideo(executionId);
      if (videoPath) {
        sendLog('info', `🎬 Video recorded: ${videoPath}`);
      }
    } catch (videoError: any) {
      logger.warn('Failed to save video', { error: videoError.message, executionId });
    }

    return {
      execution_id: executionId,
      test_case_id: testCase.id,
      status,
      steps: stepResults,
      total_duration_ms: totalDuration,
      screenshots,
      video_path: videoPath || undefined,
      error,
      started_at: startedAt,
      completed_at: completedAt
    };
  }

  /**
   * Stop a running execution
   */
  async stopExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found or not running`);
    }

    logger.info('Stopping execution', { executionId });
    execution.cancelled = true;

    // Try to stop browser operations gracefully
    try {
      if (execution.browserStreamer) {
        execution.browserStreamer.stopStreaming();
      }
      
      if (execution.browserController) {
        const page = execution.browserController.getPage();
        if (page && !page.isClosed()) {
          // Close page to stop any ongoing operations
          await page.close().catch(() => {});
        }
      }
    } catch (error: any) {
      logger.warn('Error during execution stop', { error: error.message, executionId });
    }
  }

  /**
   * Pre-warm the browser pool
   */
  async warmUp(): Promise<void> {
    if (this.usePool) {
      await this.browserPool.initialize();
      logger.info('Browser pool warmed up', this.browserPool.getStats());
    }
  }

  /**
   * Shutdown the browser pool
   */
  async shutdown(): Promise<void> {
    if (this.usePool) {
      await this.browserPool.shutdown();
    }
  }
}
