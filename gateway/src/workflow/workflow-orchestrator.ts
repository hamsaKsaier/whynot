import axios, { AxiosError } from 'axios';
import { TestCase, ExecutionResult, UserStory, ActionType } from '../../shared/types';
import type { PrerequisiteStep } from '../../shared/utils/create-edit-flow';
import { retryWithBackoff } from '../../shared/utils/retry';
import { CircuitBreaker } from '../../shared/utils/circuit-breaker';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('workflow-orchestrator');

export class WorkflowOrchestrator {
  private aiServiceUrl: string;
  private testExecutorUrl: string;
  private aiServiceCircuitBreaker: CircuitBreaker;
  private testExecutorCircuitBreaker: CircuitBreaker;

  constructor(
    aiServiceUrl: string = 'http://localhost:8000',
    testExecutorUrl: string = 'http://localhost:3001'
  ) {
    this.aiServiceUrl = aiServiceUrl;
    this.testExecutorUrl = testExecutorUrl;
    this.aiServiceCircuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60000
    });
    this.testExecutorCircuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60000
    });
  }

  /**
   * Capture page content (HTML + screenshot) before test generation
   */
  async capturePageContent(websiteUrl: string, prerequisiteSteps?: PrerequisiteStep[]): Promise<{
    html: string;
    screenshot_base64: string;
    url: string;
  }> {
    // Configurable timeout for page capture (default: 60 seconds)
    const captureTimeout = parseInt(
      process.env.PAGE_CAPTURE_TIMEOUT_MS || '60000',
      10
    );
    const maxRetries = parseInt(
      process.env.PAGE_CAPTURE_MAX_RETRIES || '2',
      10
    );

    try {
      logger.info('Capturing page content', {
        websiteUrl,
        timeout: captureTimeout,
        maxRetries,
        testExecutorUrl: this.testExecutorUrl
      });

      const response = await this.testExecutorCircuitBreaker.execute(() =>
        retryWithBackoff(
          () => {
            logger.debug('Sending page capture request', {
              url: websiteUrl,
              endpoint: `${this.testExecutorUrl}/api/capture-page`
            });
            return axios.post(
              `${this.testExecutorUrl}/api/capture-page`,
              { website_url: websiteUrl, prerequisite_steps: prerequisiteSteps ?? [] },
              {
                headers: { 'Content-Type': 'application/json' },
                timeout: captureTimeout
              }
            );
          },
          {
            maxRetries,
            initialDelayMs: 1000,
            maxDelayMs: 5000,
            retryableErrors: (error: any) => {
              const isRetryable =
                error.code === 'ECONNREFUSED' ||
                error.code === 'ETIMEDOUT' ||
                error.code === 'ENOTFOUND' ||
                (error.response?.status >= 500 && error.response?.status < 600);

              if (isRetryable) {
                logger.warn('Retryable error encountered, will retry', {
                  code: error.code,
                  status: error.response?.status,
                  message: error.message
                });
              }
              return isRetryable;
            }
          }
        )
      );

      if (!response.data) {
        throw new Error('Empty response from page capture endpoint');
      }

      if (!response.data.html || !response.data.screenshot_base64) {
        throw new Error('Incomplete page content: missing HTML or screenshot');
      }

      logger.info('Page content captured successfully', {
        url: response.data.url || websiteUrl,
        htmlLength: response.data.html?.length || 0,
        screenshotSize: response.data.screenshot_base64
          ? `${(response.data.screenshot_base64.length / 1024).toFixed(2)} KB`
          : 'unknown'
      });

      return response.data;
    } catch (error: any) {
      const axiosError = error as AxiosError;
      const errorDetails = {
        message: error.message,
        code: error.code,
        name: error.name,
        statusCode: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        responseData: axiosError.response?.data,
        url: websiteUrl,
        testExecutorUrl: this.testExecutorUrl,
        timeout: captureTimeout
      };

      logger.error('Failed to capture page content', error, errorDetails);

      // Provide more specific error messages
      let errorMessage = `Failed to capture page content from ${websiteUrl}`;

      if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        errorMessage += `: Request timed out after ${captureTimeout}ms. The page may be loading too slowly.`;
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage += `: Cannot connect to test executor at ${this.testExecutorUrl}. Service may be down.`;
      } else if (error.response?.status) {
        errorMessage += `: HTTP ${error.response.status} ${error.response.statusText || ''}`;
      } else {
        errorMessage += `: ${error.message || 'Unknown error'}`;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Complete workflow: Generate tests from user story and execute them
   */
  async runCompleteWorkflow(
    userStory: UserStory,
    headless: boolean = false
  ): Promise<{
    testCase: TestCase;
    executionResult: ExecutionResult;
  }> {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║           TEST AUTOMATION WORKFLOW STARTED                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`📖 User Story: ${userStory.story}`);
    console.log(`🌐 Website: ${userStory.website_url}`);
    console.log(`👁️  Mode: ${headless ? 'Headless' : 'Visible'}\n`);

    // Step 0: Capture page content before test generation
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📸 PHASE 1: CAPTURING PAGE CONTENT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('Step 0: Capturing page content', {
      websiteUrl: userStory.website_url
    });
    let pageContent: { html: string; screenshot_base64: string; url: string } | null = null;
    try {
      console.log(`   🔄 TASK: Navigating to ${userStory.website_url} and capturing page...`);
      pageContent = await this.capturePageContent(userStory.website_url);
      console.log(`   ✅ Page content captured successfully`);
      console.log(`   📄 HTML length: ${pageContent.html.length} characters`);
      console.log(`   🖼️  Screenshot: ${(pageContent.screenshot_base64.length / 1024).toFixed(2)} KB\n`);
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...(error.response && {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        })
      };
      console.log(`   ⚠️  Failed to capture page content: ${error.message}`);
      console.log(`   📋 Error details:`, JSON.stringify(errorDetails, null, 2));
      console.log(`   ℹ️  Continuing without page context...\n`);
      logger.warn('Failed to capture page content, proceeding without it', {
        error: errorDetails,
        url: userStory.website_url
      });
      // Continue without page content - will use old method
    }

    // Step 1: Generate test cases from user story
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 PHASE 2: GENERATING TEST CASES WITH AI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('Step 1: Generating test cases from user story', {
      websiteUrl: userStory.website_url,
      hasPageContent: !!pageContent
    });
    console.log(`   🔄 TASK: Sending request to AI service (Claude Sonnet 4.5)...`);
    console.log(`   📝 Analyzing user story and page content...`);
    const testCases = pageContent
      ? await this.generateTestCasesWithPageContext(userStory, pageContent)
      : await this.generateTestCases(userStory);

    if (testCases.length === 0) {
      console.log(`   ❌ ERROR: No test cases generated\n`);
      logger.error('No test cases generated', { websiteUrl: userStory.website_url });
      throw new Error('No test cases generated from user story');
    }

    // Use the first (highest priority) test case for execution
    // All test cases are already prioritized by the AI service
    const testCase = testCases[0];
    console.log(`   ✅ Generated ${testCases.length} test case(s) (prioritized)`);
    console.log(`   📋 Selected test case: "${testCase.name}"`);
    if (testCase.scenario_type) {
      console.log(`   🏷️  Scenario: ${testCase.scenario_type} (risk: ${testCase.risk_level || 'unknown'}, priority: ${testCase.priority_score || 0})`);
    }
    console.log(`   📊 Test steps: ${testCase.steps.length}\n`);
    logger.info('Generated test case', {
      testCaseId: testCase.id,
      name: testCase.name,
      scenarioType: testCase.scenario_type,
      riskLevel: testCase.risk_level,
      priorityScore: testCase.priority_score,
      stepsCount: testCase.steps.length
    });

    // Step 2: Execute the test case
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚙️  PHASE 3: EXECUTING TEST CASE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('Step 2: Executing test case', {
      testCaseId: testCase.id,
      headless
    });
    console.log(`   🔄 TASK: Starting test execution...`);
    const executionResult = await this.executeTest(testCase, headless);
    console.log(`\n   ✅ Test execution completed`);
    console.log(`   📊 Status: ${executionResult.status}`);
    console.log(`   ⏱️  Duration: ${executionResult.total_duration_ms}ms`);
    console.log(`   📸 Screenshots: ${executionResult.screenshots.length}\n`);
    logger.info('Test execution completed', {
      executionId: executionResult.execution_id,
      status: executionResult.status,
      durationMs: executionResult.total_duration_ms
    });

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              WORKFLOW COMPLETED SUCCESSFULLY                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    return {
      testCase,
      executionResult
    };
  }

  /**
   * Generate test cases with automatic page content capture
   * Attempts to capture page content first, then generates tests with context if successful
   */
  async generateTestCasesWithPageCapture(userStory: UserStory, prerequisiteSteps?: PrerequisiteStep[], quickMode?: boolean): Promise<TestCase[]> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'workflow-orchestrator.ts:generateTestCasesWithPageCapture', message: 'QuickMode received in orchestrator', data: { quickMode, quickModeType: typeof quickMode, quickModeUndefined: quickMode === undefined }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(() => { });
    // #endregion
    logger.info('Generating test cases with page capture', {
      websiteUrl: userStory.website_url
    });

    let pageContent: { html: string; screenshot_base64: string; url: string } | null = null;

    // Attempt to capture page content
    try {
      logger.info('Attempting to capture page content', {
        websiteUrl: userStory.website_url
      });
      pageContent = await this.capturePageContent(userStory.website_url, prerequisiteSteps);
      logger.info('Page content captured successfully', {
        url: pageContent.url,
        htmlLength: pageContent.html.length,
        screenshotSize: `${(pageContent.screenshot_base64.length / 1024).toFixed(2)} KB`
      });
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        stack: error.stack,
        ...(error.response && {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        })
      };
      logger.warn('Failed to capture page content, will generate tests without context', {
        websiteUrl: userStory.website_url,
        error: errorDetails
      });
      // Continue without page content - will use fallback method
    }

    // Generate test cases with or without page context
    if (pageContent) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'workflow-orchestrator.ts:pageContent-branch', message: 'Calling generateTestCasesWithPageContext', data: { quickMode, hasPageContent: !!pageContent }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D2' }) }).catch(() => { });
      // #endregion
      try {
        return await this.generateTestCasesWithPageContext(userStory, pageContent, prerequisiteSteps, quickMode);
      } catch (error: any) {
        // CRITICAL FIX: Do NOT make expensive fallback call if:
        // 1. Timeout occurred (already spent time/money)
        // 2. Parsing error (API succeeded but format wrong)
        // Only retry for truly recoverable temporary errors

        if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
          logger.error('Request timed out - NOT making expensive fallback call to avoid double cost', {
            websiteUrl: userStory.website_url,
            error: error.message
          });
          throw error; // Re-throw to fail fast, don't retry
        }

        logger.error('Failed to generate tests with page context', error, {
          websiteUrl: userStory.website_url
        });
        // Only fall back for truly recoverable errors (not timeouts, not parsing errors)
        // But even then, be cautious - this is expensive
        throw error; // Don't automatically retry - let the caller decide
      }
    } else {
      logger.info('Generating test cases without page context (no page content available)');
      return await this.generateTestCases(userStory, quickMode);
    }
  }

  /**
   * Generate test cases using AI service with page context
   */
  async generateTestCasesWithPageContext(
    userStory: UserStory,
    pageContent: { html: string; screenshot_base64: string; url: string },
    prerequisiteSteps?: PrerequisiteStep[],
    quickMode?: boolean
  ): Promise<TestCase[]> {
    try {
      console.log(`   🤖 Using Claude Sonnet 4.5 with page context (HTML + Screenshot)`);
      // #region agent log
      const aiPayload = { ...userStory, screenshot_base64: '[REDACTED]', html: '[REDACTED]', quick_mode: quickMode ?? false };
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'workflow-orchestrator.ts:generateTestCasesWithPageContext', message: 'Payload being sent to AI service', data: { quick_mode_in_payload: quickMode ?? false, quickMode, aiPayloadKeys: Object.keys(aiPayload) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D3' }) }).catch(() => { });
      // #endregion
      const response = await this.aiServiceCircuitBreaker.execute(() =>
        retryWithBackoff(
          () => axios.post(
            `${this.aiServiceUrl}/api/generate-tests`,
            {
              ...userStory,
              screenshot_base64: pageContent.screenshot_base64,
              html: pageContent.html,
              quick_mode: quickMode ?? false
            },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 300000 // 300 second (5 min) timeout for LLM calls with vision and multi-scenario generation
            }
          ),
          {
            maxRetries: 3,
            initialDelayMs: 1000,
            maxDelayMs: 10000,
            retryableErrors: (error: any) => {
              if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
                return true;
              }
              if (error.response?.status >= 500 && error.response?.status < 600) {
                return true;
              }
              return false;
            }
          }
        )
      );
      // Handle new response format with validation
      const responseData = response.data;
      let testCases: TestCase[] = [];
      let validationSummary: any = null;
      let validationResults: any[] = [];

      if (responseData.test_cases) {
        // New format with validation
        // CRITICAL FIX: Ensure test_cases is actually an array before assigning
        if (Array.isArray(responseData.test_cases)) {
          testCases = responseData.test_cases;
        } else {
          logger.error('test_cases is not an array in AI service response', {
            type: typeof responseData.test_cases,
            value: JSON.stringify(responseData.test_cases).substring(0, 500)
          });
          testCases = [];
        }
        validationSummary = responseData.validation_summary;
        validationResults = Array.isArray(responseData.validation_results) ? responseData.validation_results : [];
        logger.debug('Test cases generated with validation', {
          count: testCases.length,
          valid: validationSummary?.valid || 0,
          invalid: validationSummary?.invalid || 0
        });
      } else if (Array.isArray(responseData)) {
        // Legacy format (array of test cases)
        testCases = responseData;
        logger.debug('Test cases generated successfully with page context', { count: testCases.length });
      } else {
        logger.warn('Unexpected response format from AI service', { responseKeys: Object.keys(responseData || {}) });
        testCases = [];
      }

      // Log raw response from AI service for debugging
      if (testCases.length > 0) {
        const firstCase = testCases[0];
        logger.debug('Raw response from AI service', {
          responseKeys: Object.keys(responseData || {}),
          firstStepKeys: firstCase?.steps?.[0] ? Object.keys(firstCase.steps[0]) : [],
          firstStepHasSuggestedSelectors: !!firstCase?.steps?.[0]?.suggested_selectors,
          firstStepSuggestedSelectorsCount: firstCase?.steps?.[0]?.suggested_selectors?.length || 0
        });
      }

      // Log suggested_selectors status for each step after receiving from AI service
      // CRITICAL FIX: Ensure testCases is an array before calling forEach
      if (!Array.isArray(testCases)) {
        logger.error('testCases is not an array before forEach call', {
          type: typeof testCases,
          value: JSON.stringify(testCases).substring(0, 500)
        });
        testCases = [];
      }
      testCases.forEach((testCase, tcIdx) => {
        logger.info(`Test case ${tcIdx + 1} received from AI service`, {
          testCaseId: testCase.id,
          name: testCase.name,
          stepsCount: testCase.steps.length
        });
        testCase.steps.forEach((step, stepIdx) => {
          const hasSuggestedSelectors = !!(step.suggested_selectors && step.suggested_selectors.length > 0);
          const selectorCount = step.suggested_selectors?.length || 0;
          logger.info(`  Step ${stepIdx + 1} suggested_selectors status`, {
            stepId: step.id,
            action: step.action,
            hasSuggestedSelectors,
            selectorCount,
            selectors: hasSuggestedSelectors ? step.suggested_selectors?.slice(0, 2).map(s => `${s.type}="${s.value}"`) : []
          });
        });
      });

      // Prepend prerequisite steps to each test case and renumber
      if (Array.isArray(prerequisiteSteps) && prerequisiteSteps.length > 0) {
        testCases = testCases.map((tc) => {
          const prereqAsTestSteps = prerequisiteSteps.map((p, i) => ({
            id: 'step-prereq-' + (i + 1),
            action: p.action === 'type' ? ActionType.TYPE : ActionType.CLICK,
            target: { text: p.selector },
            value: p.value,
            description: p.action === 'click' ? 'Open form: ' + p.selector : 'Fill: ' + p.selector,
            suggested_selectors: [{ type: 'text' as const, value: p.selector, stability_score: 0.6 }]
          }));
          const combined = [...prereqAsTestSteps, ...(tc.steps || [])];
          const renumbered = combined.map((s, idx) => ({
            ...s,
            id: 'step-' + String(idx + 1).padStart(3, '0')
          }));
          return { ...tc, steps: renumbered };
        });
      }

      return testCases;
    } catch (error: any) {
      const axiosError = error as AxiosError;
      logger.error('Failed to generate test cases with page context', error, {
        websiteUrl: userStory.website_url,
        statusCode: axiosError.response?.status,
        errorCode: axiosError.code
      });

      // CRITICAL FIX: Do NOT make expensive fallback calls for:
      // 1. Timeouts (we've already spent time/money)
      // 2. Parsing errors (API succeeded but response format is wrong)
      // Only retry for recoverable errors (temporary service unavailability)

      // Check if it's a timeout - don't retry if we already timed out
      if (axiosError.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        logger.error('Request timed out - NOT making expensive fallback call', {
          websiteUrl: userStory.website_url,
          timeoutMs: axiosError.config?.timeout
        });
        throw new Error(`Test generation timed out after ${axiosError.config?.timeout || 300000}ms. The AI service is taking too long to generate test cases.`);
      }

      // Check if it's a parsing error (successful response but wrong format)
      // If response exists and is 200, it means API succeeded but parsing failed
      if (axiosError.response?.status === 200) {
        logger.error('API call succeeded but parsing failed - NOT making expensive fallback call', {
          websiteUrl: userStory.website_url,
          responseData: JSON.stringify(axiosError.response?.data).substring(0, 500)
        });
        throw new Error('AI service returned invalid response format. Cannot parse test cases.');
      }

      // Only retry for recoverable errors (5xx errors, network errors that might be temporary)
      // But NOT for timeouts or parsing errors
      if (axiosError.response?.status && axiosError.response.status >= 500 && axiosError.response.status < 600) {
        // Temporary server error - might be recoverable, but still expensive to retry
        logger.warn('Server error received - considering fallback (but this is expensive)', {
          statusCode: axiosError.response.status
        });
        // Still expensive, but at least it's a different type of error
        throw error; // Let the outer catch handle it if needed, but don't automatically retry
      }

      // For other errors, throw instead of making expensive fallback
      throw error;
    }
  }

  /**
   * Generate test cases using AI service (without page context - backward compatibility)
   */
  async generateTestCases(userStory: UserStory, quickMode?: boolean): Promise<TestCase[]> {
    try {
      console.log(`   🤖 Using Claude Sonnet 4.5 (without page context)`);
      const response = await this.aiServiceCircuitBreaker.execute(() =>
        retryWithBackoff(
          () => axios.post(
            `${this.aiServiceUrl}/api/generate-tests`,
            { ...userStory, quick_mode: quickMode ?? false },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 180000 // 180 second (3 min) timeout for LLM calls without page context (multi-scenario can take time)
            }
          ),
          {
            maxRetries: 3,
            initialDelayMs: 1000,
            maxDelayMs: 10000,
            retryableErrors: (error: any) => {
              // Retry on network errors and 5xx errors
              if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
                return true;
              }
              if (error.response?.status >= 500 && error.response?.status < 600) {
                return true;
              }
              return false;
            }
          }
        )
      );
      // Handle new response format with validation (same as with page context)
      const responseData = response.data;

      let testCases: TestCase[] = [];
      if (responseData.test_cases) {
        // New format with validation
        if (Array.isArray(responseData.test_cases)) {
          testCases = responseData.test_cases;
        } else {
          logger.error('test_cases is not an array in generateTestCases response', {
            type: typeof responseData.test_cases
          });
          testCases = [];
        }
      } else if (Array.isArray(responseData)) {
        // Legacy format (array of test cases)
        testCases = responseData;
      } else {
        logger.warn('Unexpected response format in generateTestCases', { responseKeys: Object.keys(responseData || {}) });
        testCases = [];
      }

      logger.debug('Test cases generated successfully', { count: testCases.length });
      return testCases;
    } catch (error: any) {
      const axiosError = error as AxiosError;
      logger.error('Failed to generate test cases', error, {
        websiteUrl: userStory.website_url,
        statusCode: axiosError.response?.status
      });
      let errorMessage = 'Failed to generate test cases';

      if (axiosError.response) {
        errorMessage += `: ${axiosError.response.status} ${axiosError.response.statusText}`;
        if (axiosError.response.data && typeof axiosError.response.data === 'object') {
          const data = axiosError.response.data as any;
          if (data.error || data.message) {
            errorMessage += ` - ${data.error || data.message}`;
          }
        }
      } else if (axiosError.request) {
        errorMessage += ': Service unavailable or timeout';
      } else {
        errorMessage += `: ${error.message || 'Unknown error'}`;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Execute test case using test executor service
   */
  async executeTest(testCase: TestCase, headless: boolean = true): Promise<ExecutionResult> {
    // Log suggested_selectors status for each step before sending to test-executor
    logger.info('Forwarding test case to test-executor', {
      testCaseId: testCase.id,
      stepsCount: testCase.steps.length
    });
    testCase.steps.forEach((step, idx) => {
      const hasSuggestedSelectors = !!(step.suggested_selectors && step.suggested_selectors.length > 0);
      const selectorCount = step.suggested_selectors?.length || 0;
      logger.info(`Step ${idx + 1} suggested_selectors status`, {
        stepId: step.id,
        action: step.action,
        hasSuggestedSelectors,
        selectorCount,
        selectors: hasSuggestedSelectors ? step.suggested_selectors?.slice(0, 2).map(s => `${s.type}="${s.value}"`) : []
      });
    });

    // Log payload before sending to test-executor
    try {
      const payloadString = JSON.stringify(testCase);
      logger.debug('Payload being sent to test-executor', {
        payloadSize: payloadString.length,
        firstStepKeys: testCase.steps[0] ? Object.keys(testCase.steps[0]) : [],
        firstStepHasSuggestedSelectors: !!testCase.steps[0]?.suggested_selectors,
        firstStepSuggestedSelectorsCount: testCase.steps[0]?.suggested_selectors?.length || 0,
        samplePayload: payloadString.substring(0, 500) // First 500 chars
      });
    } catch (payloadError) {
      logger.warn('Failed to serialize payload for logging', { error: payloadError });
    }

    try {
      const response = await this.testExecutorCircuitBreaker.execute(() =>
        retryWithBackoff(
          () => axios.post(
            `${this.testExecutorUrl}/api/execute-test?headless=${headless}`,
            testCase,
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 300000 // 5 minute timeout for test execution
            }
          ),
          {
            maxRetries: 2, // Fewer retries for test execution (longer operations)
            initialDelayMs: 2000,
            maxDelayMs: 15000,
            retryableErrors: (error: any) => {
              // Only retry on network errors, not on test failures
              if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
                return true;
              }
              if (error.response?.status >= 500 && error.response?.status < 600) {
                return true;
              }
              return false;
            }
          }
        )
      );
      logger.debug('Test execution completed', {
        executionId: response.data?.execution_id,
        status: response.data?.status
      });
      return response.data;
    } catch (error: any) {
      const axiosError = error as AxiosError;
      logger.error('Failed to execute test', error, {
        testCaseId: testCase.id,
        statusCode: axiosError.response?.status
      });
      let errorMessage = 'Failed to execute test';

      if (axiosError.response) {
        errorMessage += `: ${axiosError.response.status} ${axiosError.response.statusText}`;
        if (axiosError.response.data && typeof axiosError.response.data === 'object') {
          const data = axiosError.response.data as any;
          if (data.error || data.message) {
            errorMessage += ` - ${data.error || data.message}`;
          }
        }
      } else if (axiosError.request) {
        errorMessage += ': Test executor service unavailable or timeout';
      } else {
        errorMessage += `: ${error.message || 'Unknown error'}`;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Analyze screenshot using AI service
   */
  async analyzeScreenshot(screenshotPath: string): Promise<any> {
    try {
      const FormData = require('form-data');
      const fs = require('fs');
      const formData = new FormData();
      formData.append('file', fs.createReadStream(screenshotPath));

      const response = await this.aiServiceCircuitBreaker.execute(() =>
        retryWithBackoff(
          () => axios.post(
            `${this.aiServiceUrl}/api/analyze-screenshot`,
            formData,
            {
              headers: formData.getHeaders(),
              timeout: 30000
            }
          ),
          {
            maxRetries: 2,
            initialDelayMs: 1000,
            maxDelayMs: 5000
          }
        )
      );
      return response.data;
    } catch (error: any) {
      const axiosError = error as AxiosError;
      let errorMessage = 'Failed to analyze screenshot';

      if (axiosError.response) {
        errorMessage += `: ${axiosError.response.status} ${axiosError.response.statusText}`;
      } else if (axiosError.request) {
        errorMessage += ': AI service unavailable or timeout';
      } else {
        errorMessage += `: ${error.message || 'Unknown error'}`;
      }

      throw new Error(errorMessage);
    }
  }
}

