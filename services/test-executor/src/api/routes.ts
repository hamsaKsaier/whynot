import { Router, Request, Response } from 'express';
import { TestCase, ExecutionResult } from '../domain/models';
import { TestRunner } from '../application/test-runner';
import { DOMAnalyzer } from '../infrastructure/selectors/dom-analyzer';
import { PlaywrightController } from '../infrastructure/browser/playwright-controller';
import { createLogger } from '../../shared/logger/logger';
import { ExecutionRepository } from '../../shared/database/repositories/execution-repository';
import { TestCaseRepository } from '../../shared/database/repositories/test-case-repository';
import { v4 as uuidv4, validate as validateUUID } from 'uuid';

const router = Router();
const logger = createLogger('test-executor-routes');
const testRunner = new TestRunner(
  process.env.AI_SERVICE_URL || 'http://localhost:8000',
  process.env.SCREENSHOTS_DIR || './screenshots',
  true // Enable browser pool
);
const executionRepository = new ExecutionRepository();
const testCaseRepository = new TestCaseRepository();

// Warm up browser pool on startup (async, non-blocking)
testRunner.warmUp().then(() => {
  logger.info('Browser pool warmed up and ready');
}).catch((err) => {
  logger.warn('Failed to warm up browser pool', { error: err.message });
});

router.get('/health', async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    service: 'test-executor',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    dependencies: {
      aiService: {
        url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
        status: 'unknown'
      },
      playwright: {
        status: 'available' // Playwright is bundled
      }
    }
  };

  // Check AI service health (non-blocking)
  try {
    const axios = require('axios');
    const aiHealth = await axios.get(
      `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/health`,
      { timeout: 2000 }
    ).catch(() => null);

    if (aiHealth?.status === 200) {
      health.dependencies.aiService.status = 'healthy';
    } else {
      health.dependencies.aiService.status = 'unhealthy';
      health.status = 'degraded';
    }
  } catch (error) {
    health.dependencies.aiService.status = 'unhealthy';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

router.post('/api/execute-test', async (req: Request, res: Response) => {
  try {
    const testCase: TestCase = req.body;
    const headless = req.query.headless === 'true';

    // Log raw request body for debugging
    try {
      const rawBody = JSON.stringify(testCase);
      logger.debug('Raw request body received', {
        bodySize: rawBody.length,
        firstStepKeys: testCase.steps[0] ? Object.keys(testCase.steps[0]) : [],
        firstStepHasSuggestedSelectors: !!testCase.steps[0]?.suggested_selectors,
        firstStepSuggestedSelectorsCount: testCase.steps[0]?.suggested_selectors?.length || 0,
        sampleBody: rawBody.substring(0, 500) // First 500 chars
      });
    } catch (bodyError) {
      logger.warn('Failed to serialize request body for logging', { error: bodyError });
    }

    // Log test case received and suggested_selectors status for each step
    logger.info('Received test case from API', {
      testCaseId: testCase.id,
      name: testCase.name,
      stepsCount: testCase.steps.length
    });

    testCase.steps.forEach((step, idx) => {
      const hasSuggestedSelectors = !!(step.suggested_selectors && step.suggested_selectors.length > 0);
      const selectorCount = step.suggested_selectors?.length || 0;
      const selectorTypes = hasSuggestedSelectors
        ? step.suggested_selectors?.map(s => s.type).join(', ')
        : 'none';

      logger.info(`Step ${idx + 1} received in API route`, {
        stepId: step.id,
        action: step.action,
        hasSuggestedSelectors,
        suggestedSelectorsCount: selectorCount,
        selectorTypes,
        selectors: hasSuggestedSelectors
          ? step.suggested_selectors?.slice(0, 2).map(s => ({ type: s.type, value: s.value, stability: s.stability_score }))
          : []
      });
    });

    // Validate and fix test case ID if needed
    if (!validateUUID(testCase.id)) {
      logger.warn('Invalid test case ID format detected, generating new UUID', {
        originalId: testCase.id,
        testCaseName: testCase.name
      });
      testCase.id = uuidv4();
      logger.info('Generated new UUID for test case', { newId: testCase.id });
    }

    // Generate execution ID immediately (BEFORE test starts)
    // This allows frontend to connect to WebSocket early
    const executionId = uuidv4();

    logger.info('Test execution starting', {
      executionId,
      testCaseId: testCase.id,
      stepsCount: testCase.steps.length,
      headless
    });

    // For non-headless mode: return executionId immediately for WebSocket connection
    // For headless mode: run synchronously (no WebSocket needed)
    if (!headless) {
      // Return executionId immediately so frontend can connect to WebSocket
      res.json({
        execution_id: executionId,
        status: 'starting',
        message: 'Test execution started. Connect to WebSocket for live preview.',
        test_case_id: testCase.id,
        website_url: testCase.website_url
      });

      // Run test asynchronously (don't await - let it run in background)
      // Default to isolated=true for test isolation (fresh context per test)
      const isolate = req.query.isolate !== 'false'; // Default true unless explicitly false
      testRunner.runTest(testCase, headless, executionId, isolate)
        .then(async (result) => {
          const duration = Date.now() - Date.parse(result.started_at);

          logger.info('Test execution completed', {
            executionId: result.execution_id,
            status: result.status,
            durationMs: duration,
            stepsPassed: result.steps.filter(s => s.success).length,
            stepsFailed: result.steps.filter(s => !s.success).length
          });

          // Ensure test case exists in database before persisting execution
          try {
            const existingTestCase = await testCaseRepository.findById(result.test_case_id);
            if (!existingTestCase) {
              logger.warn('Test case not found in database, attempting to create it', {
                testCaseId: result.test_case_id,
                executionId: result.execution_id
              });
              // Try to create test case from the original testCase object
              // Note: This might not have all fields, but it's better than failing
              try {
                await testCaseRepository.create(testCase);
                logger.info('Test case created in database', { testCaseId: testCase.id });
              } catch (createError: any) {
                logger.error('Failed to create test case in database', {
                  error: createError.message,
                  testCaseId: testCase.id
                });
              }
            }
          } catch (checkError: any) {
            logger.warn('Failed to check test case existence', {
              error: checkError.message,
              testCaseId: result.test_case_id
            });
          }

          // Persist execution result
          try {
            await executionRepository.create(result);
            logger.debug('Execution result persisted to database');
          } catch (dbError: any) {
            // Check if it's a foreign key constraint error
            if (dbError.code === '23503') {
              logger.error('Failed to persist execution: test case does not exist in database', {
                executionId: result.execution_id,
                testCaseId: result.test_case_id,
                error: dbError.message
              });
            } else {
              logger.error('Failed to persist execution to database', {
                executionId: result.execution_id,
                error: dbError.message,
                code: dbError.code
              });
            }
          }
        })
        .catch((error: any) => {
          logger.error('Test execution failed', error, {
            executionId,
            testCaseId: testCase.id
          });
        });
    } else {
      // For headless mode, run synchronously (no WebSocket needed)
      // Default to isolated=true for test isolation (fresh context per test)
      const isolate = req.query.isolate !== 'false'; // Default true unless explicitly false
      const startTime = Date.now();
      const result = await testRunner.runTest(testCase, headless, executionId, isolate);
      const duration = Date.now() - startTime;

      logger.info('Test execution completed', {
        executionId: result.execution_id,
        status: result.status,
        durationMs: duration,
        stepsPassed: result.steps.filter(s => s.success).length,
        stepsFailed: result.steps.filter(s => !s.success).length
      });

      // Ensure test case exists in database before persisting execution
      try {
        const existingTestCase = await testCaseRepository.findById(result.test_case_id);
        if (!existingTestCase) {
          logger.warn('Test case not found in database, attempting to create it', {
            testCaseId: result.test_case_id,
            executionId: result.execution_id
          });
          try {
            await testCaseRepository.create(testCase);
            logger.info('Test case created in database', { testCaseId: testCase.id });
          } catch (createError: any) {
            logger.error('Failed to create test case in database', {
              error: createError.message,
              testCaseId: testCase.id
            });
          }
        }
      } catch (checkError: any) {
        logger.warn('Failed to check test case existence', {
          error: checkError.message,
          testCaseId: result.test_case_id
        });
      }

      // Persist execution result
      try {
        await executionRepository.create(result);
        logger.debug('Execution result persisted to database');
      } catch (dbError: any) {
        // Check if it's a foreign key constraint error
        if (dbError.code === '23503') {
          logger.error('Failed to persist execution: test case does not exist in database', {
            executionId: result.execution_id,
            testCaseId: result.test_case_id,
            error: dbError.message
          });
        } else {
          logger.error('Failed to persist execution to database', {
            executionId: result.execution_id,
            error: dbError.message,
            code: dbError.code
          });
        }
      }

      res.json(result);
    }
  } catch (error: any) {
    logger.error('Test execution failed', error, {
      testCaseId: req.body?.id
    });
    res.status(500).json({ error: error.message || 'Test execution failed' });
  }
});

router.post('/api/capture-page', async (req: Request, res: Response) => {
  try {
    const { website_url } = req.body;

    if (!website_url) {
      return res.status(400).json({ error: 'website_url is required' });
    }

    logger.info('Capturing page content', { website_url });

    // Create a temporary browser controller for page capture
    const screenshotsDir = process.env.SCREENSHOTS_DIR || './screenshots';
    const browserController = new PlaywrightController(screenshotsDir);

    try {
      // Initialize browser (headless for page capture)
      await browserController.initialize(true);

      // Navigate to website
      await browserController.navigate(website_url);

      // Wait a bit for page to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get HTML
      const html = await browserController.getPageHTML();

      // Take screenshot and convert to base64
      const screenshotPath = await browserController.takeScreenshot();
      const fs = require('fs');
      const screenshotBuffer = fs.readFileSync(screenshotPath);
      const screenshotBase64 = screenshotBuffer.toString('base64');

      // Get current URL
      const page = browserController.getPage();
      const url = page ? page.url() : website_url;

      // Clean up screenshot file
      try {
        fs.unlinkSync(screenshotPath);
      } catch (e) {
        // Ignore cleanup errors
      }

      // Close browser
      await browserController.close();

      logger.info('Page content captured successfully', { url, htmlLength: html.length });

      res.json({
        html,
        screenshot_base64: screenshotBase64,
        url
      });
    } catch (error: any) {
      // Ensure browser is closed on error
      try {
        await browserController.close();
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  } catch (error: any) {
    logger.error('Failed to capture page content', error, { website_url: req.body?.website_url });
    res.status(500).json({ error: error.message || 'Failed to capture page content' });
  }
});

router.post('/api/detect-elements', async (req: Request, res: Response) => {
  try {
    const { html, screenshot_path, target_description } = req.body;

    const domAnalyzer = new DOMAnalyzer();
    const selectors = domAnalyzer.analyzeHTML(html, target_description);

    res.json({ selectors });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Element detection failed' });
  }
});

router.get('/api/results/:id', async (req: Request, res: Response) => {
  try {
    const result = await executionRepository.findByIdWithSteps(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to fetch execution results', error);
    res.status(500).json({ error: error.message || 'Failed to fetch results' });
  }
});

export default router;

