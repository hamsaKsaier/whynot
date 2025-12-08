import { TestCase, ExecutionResult, StepResult } from '../domain/models';
import { PlaywrightController } from '../infrastructure/browser/playwright-controller';
import { HybridSelector } from '../infrastructure/selectors/hybrid-selector';
import { StepExecutor } from './step-executor';
import { BrowserStreamer } from '../infrastructure/browser/browser-streamer';
import { registerBrowserStream, unregisterBrowserStream } from '../api/websocket-handler';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('test-runner');

export class TestRunner {
  private browserController: PlaywrightController;
  private hybridSelector: HybridSelector;
  private stepExecutor: StepExecutor;

  constructor(
    aiServiceUrl: string = 'http://localhost:8000',
    screenshotsDir: string = './screenshots'
  ) {
    this.browserController = new PlaywrightController(screenshotsDir);
    this.hybridSelector = new HybridSelector(aiServiceUrl);
    this.stepExecutor = new StepExecutor(this.browserController, this.hybridSelector);
  }

  async runTest(testCase: TestCase, headless: boolean = true, providedExecutionId?: string): Promise<ExecutionResult> {
    const executionId = providedExecutionId || uuidv4();
    const startedAt = new Date().toISOString();
    const stepResults: StepResult[] = [];
    const screenshots: string[] = [];

    let status: 'running' | 'completed' | 'failed' | 'timeout' = 'running';
    let error: string | undefined;
    let browserStreamer: BrowserStreamer | null = null;

    // Helper function to send logs to both console and WebSocket
    const sendLog = (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => {
      console.log(message);
      if (browserStreamer) {
        browserStreamer.sendLog(level, message, data);
      }
    };

    sendLog('info', '\n🚀 ========================================');
    sendLog('info', '🚀 TEST EXECUTION STARTED');
    sendLog('info', '🚀 ========================================');
    sendLog('info', `📝 Test Case: ${testCase.name}`);
    sendLog('info', `🌐 Website: ${testCase.website_url}`);
    sendLog('info', `📊 Total Steps: ${testCase.steps.length}`);
    sendLog('info', `👁️  Mode: ${headless ? 'Headless' : 'Visible'}`);
    sendLog('info', `🆔 Execution ID: ${executionId}`);
    sendLog('info', '========================================\n');

    try {
      sendLog('info', '🔧 TASK: Initializing browser...');
      // Initialize browser
      await this.browserController.initialize(headless);
      sendLog('info', '✅ Browser initialized successfully\n');

      // Setup browser streaming (for logs in both modes, frames only in non-headless)
      const page = this.browserController.getPage();
      if (page) {
        browserStreamer = new BrowserStreamer(page, executionId);
        registerBrowserStream(executionId, browserStreamer);
        logger.info('Browser streaming setup', { executionId, headless });
        // Start streaming immediately, even without WebSocket connection
        // Frames will be queued until WebSocket connects
        if (!headless) {
          await browserStreamer.startStreaming();
        }
      }

      // Navigate to website first
      sendLog('info', `🌐 TASK: Navigating to ${testCase.website_url}...`);
      await this.browserController.navigate(testCase.website_url);
      sendLog('info', '✅ Navigation completed\n');

      // Notify streamer of navigation
      if (browserStreamer) {
        await browserStreamer.onNavigation(testCase.website_url);
      }

      // Execute each step
      for (let i = 0; i < testCase.steps.length; i++) {
        const step = testCase.steps[i];

        // Console log for step details
        sendLog('info', `\n📋 STEP ${i + 1}/${testCase.steps.length}: ${step.description || step.action}`);
        sendLog('info', `   Action: ${step.action}`);
        if (step.target) {
          sendLog('info', `   Target: ${JSON.stringify(step.target, null, 2).replace(/\n/g, '\n   ')}`);
        }
        if (step.value) {
          sendLog('info', `   Value: ${step.value}`);
        }
        if (step.expected_outcome) {
          sendLog('info', `   Expected: ${step.expected_outcome}`);
        }

        logger.info('Executing step', {
          stepNumber: i + 1,
          totalSteps: testCase.steps.length,
          stepId: step.id,
          action: step.action,
          description: step.description
        });

        try {
          // Pass log function to step executor
          const stepResult = await this.stepExecutor.executeStep(step, i, sendLog);
          stepResults.push(stepResult);

          if (stepResult.screenshot_path) {
            screenshots.push(stepResult.screenshot_path);
          }

          // Console log step result
          if (stepResult.success) {
            sendLog('info', `   ✅ Step ${i + 1} completed successfully (${stepResult.execution_time_ms}ms)`);
            if (stepResult.selector_used) {
              sendLog('info', `   Selector used: ${stepResult.selector_used.type} = "${stepResult.selector_used.value}"`);
            }
          } else {
            sendLog('error', `   ❌ Step ${i + 1} failed (${stepResult.execution_time_ms}ms)`);
            sendLog('error', `   Error: ${stepResult.error}`);
          }

          // If step failed, provide detailed error context
          if (!stepResult.success) {
            status = 'failed';
            const stepContext = `Step ${i + 1}/${testCase.steps.length}`;
            const actionContext = `Action: ${step.action}`;
            const descriptionContext = step.description ? `Description: "${step.description}"` : '';
            const elementContext = step.target ? `Target: ${JSON.stringify(step.target)}` : '';

            error = `${stepContext} failed. ${actionContext}. ${descriptionContext} ${elementContext}. Error: ${stepResult.error || 'Unknown error'}`;

            logger.error('Step execution failed', new Error(stepResult.error || 'Unknown error'), {
              stepNumber: i + 1,
              stepId: step.id,
              action: step.action,
              executionTimeMs: stepResult.execution_time_ms,
              elementFound: stepResult.element_found
            });

            // Add suggestion based on error type
            if (stepResult.error?.includes('element') || stepResult.error?.includes('selector')) {
              error += ' Suggestion: Element may not be visible or selector may need adjustment.';
            } else if (stepResult.error?.includes('timeout')) {
              error += ' Suggestion: Page may be loading slowly or element may be dynamically loaded.';
            }

            break;
          } else {
            logger.debug('Step execution succeeded', {
              stepNumber: i + 1,
              stepId: step.id,
              executionTimeMs: stepResult.execution_time_ms
            });
          }
        } catch (stepError: any) {
          // Catch any unexpected errors during step execution
          status = 'failed';
          const stepContext = `Step ${i + 1}/${testCase.steps.length}`;
          error = `${stepContext} threw unexpected error: ${stepError.message || 'Unknown error'}`;

          stepResults.push({
            step_id: step.id || `step-${i + 1}`,
            success: false,
            error: stepError.message || 'Unexpected error',
            execution_time_ms: Date.now() - Date.parse(startedAt),
            element_found: false
          });

          break;
        }
      }

      // If all steps passed, mark as completed
      if (status === 'running') {
        status = 'completed';
      }

    } catch (err: any) {
      status = 'failed';

      logger.error('Test execution error', err, {
        testCaseId: testCase.id,
        stepsCompleted: stepResults.length,
        totalSteps: testCase.steps.length
      });

      // Provide detailed error context
      if (err.message?.includes('Page crashed') || err.message?.includes('browser')) {
        error = `Browser error: ${err.message}. This may indicate a browser crash or resource issue.`;
      } else if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
        error = `Timeout error: ${err.message}. The operation took too long to complete.`;
      } else if (err.message?.includes('navigation') || err.message?.includes('goto')) {
        error = `Navigation error: ${err.message}. Failed to load the website. Check if the URL is correct and accessible.`;
      } else {
        error = `Test execution failed: ${err.message || 'Unknown error occurred'}`;
      }

      // Add context about what was being executed
      if (stepResults.length > 0) {
        error += ` Failed after completing ${stepResults.length} of ${testCase.steps.length} steps.`;
      } else {
        error += ` Failed during initialization or navigation.`;
      }
    } finally {
      // Stop streaming and cleanup
      if (browserStreamer) {
        browserStreamer.stopStreaming();
        // Send final result via WebSocket before cleanup
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
        unregisterBrowserStream(executionId);
      }

      // Close browser with error handling
      try {
        await this.browserController.close();
      } catch (closeError: any) {
        logger.warn('Error closing browser', { error: closeError.message });
        // Don't throw - test result is more important than cleanup errors
      }
    }

    const totalDuration = stepResults.reduce((sum, sr) => sum + sr.execution_time_ms, 0);
    const completedAt = new Date().toISOString();

    sendLog('info', '\n========================================');
    sendLog('info', '📊 TEST EXECUTION SUMMARY');
    sendLog('info', '========================================');
    sendLog('info', `Status: ${status === 'completed' ? '✅ COMPLETED' : status === 'failed' ? '❌ FAILED' : '⏸️  ' + status.toUpperCase()}`);
    sendLog('info', `Total Duration: ${totalDuration}ms`);
    sendLog('info', `Steps Completed: ${stepResults.length}/${testCase.steps.length}`);
    sendLog('info', `Steps Passed: ${stepResults.filter(s => s.success).length}`);
    sendLog('info', `Steps Failed: ${stepResults.filter(s => !s.success).length}`);
    sendLog('info', `Screenshots Captured: ${screenshots.length}`);
    if (error) {
      sendLog('error', `Error: ${error}`);
    }
    sendLog('info', '========================================\n');

    logger.info('Test execution finished', {
      executionId,
      status,
      totalDurationMs: totalDuration,
      stepsCount: stepResults.length,
      screenshotsCount: screenshots.length
    });

    return {
      execution_id: executionId,
      test_case_id: testCase.id,
      status,
      steps: stepResults,
      total_duration_ms: totalDuration,
      screenshots,
      error,
      started_at: startedAt,
      completed_at: completedAt
    };
  }
}

