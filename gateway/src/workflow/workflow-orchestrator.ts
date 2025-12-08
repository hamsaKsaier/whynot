import axios, { AxiosError } from 'axios';
import { TestCase, ExecutionResult, UserStory } from '../../shared/types';
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
  async capturePageContent(websiteUrl: string): Promise<{
    html: string;
    screenshot_base64: string;
    url: string;
  }> {
    try {
      logger.info('Capturing page content', { websiteUrl });
      const response = await this.testExecutorCircuitBreaker.execute(() =>
        retryWithBackoff(
          () => axios.post(
            `${this.testExecutorUrl}/api/capture-page`,
            { website_url: websiteUrl },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 30000 // 30 second timeout for page capture
            }
          ),
          {
            maxRetries: 2,
            initialDelayMs: 1000,
            maxDelayMs: 5000,
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
      logger.debug('Page content captured successfully', { url: response.data?.url });
      return response.data;
    } catch (error: any) {
      const axiosError = error as AxiosError;
      logger.error('Failed to capture page content', error, {
        websiteUrl,
        statusCode: axiosError.response?.status
      });
      throw new Error(`Failed to capture page content: ${error.message || 'Unknown error'}`);
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
      console.log(`   ⚠️  Failed to capture page content: ${error.message}`);
      console.log(`   ℹ️  Continuing without page context...\n`);
      logger.warn('Failed to capture page content, proceeding without it', error);
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

    // For POC, use the first test case
    const testCase = testCases[0];
    console.log(`   ✅ Generated ${testCases.length} test case(s)`);
    console.log(`   📋 Selected test case: "${testCase.name}"`);
    console.log(`   📊 Test steps: ${testCase.steps.length}\n`);
    logger.info('Generated test case', {
      testCaseId: testCase.id,
      name: testCase.name,
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
   * Generate test cases using AI service with page context
   */
  async generateTestCasesWithPageContext(
    userStory: UserStory,
    pageContent: { html: string; screenshot_base64: string; url: string }
  ): Promise<TestCase[]> {
    try {
      console.log(`   🤖 Using Claude Sonnet 4.5 with page context (HTML + Screenshot)`);
      const response = await this.aiServiceCircuitBreaker.execute(() =>
        retryWithBackoff(
          () => axios.post(
            `${this.aiServiceUrl}/api/generate-tests`,
            {
              ...userStory,
              screenshot_base64: pageContent.screenshot_base64,
              html: pageContent.html
            },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 120000 // 120 second timeout for LLM calls with vision
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
      logger.debug('Test cases generated successfully with page context', { count: response.data?.length || 0 });
      return response.data;
    } catch (error: any) {
      const axiosError = error as AxiosError;
      logger.error('Failed to generate test cases with page context', error, {
        websiteUrl: userStory.website_url,
        statusCode: axiosError.response?.status
      });
      // Fallback to old method
      logger.info('Falling back to test generation without page context');
      return this.generateTestCases(userStory);
    }
  }

  /**
   * Generate test cases using AI service (without page context - backward compatibility)
   */
  async generateTestCases(userStory: UserStory): Promise<TestCase[]> {
    try {
      console.log(`   🤖 Using Claude Sonnet 4.5 (without page context)`);
      const response = await this.aiServiceCircuitBreaker.execute(() =>
        retryWithBackoff(
          () => axios.post(
            `${this.aiServiceUrl}/api/generate-tests`,
            userStory,
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 60000 // 60 second timeout for LLM calls
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
      logger.debug('Test cases generated successfully', { count: response.data?.length || 0 });
      return response.data;
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

