import { Router, Request, Response } from 'express';
import { TestCase, ExecutionResult } from '../domain/models';
import { TestRunner } from '../application/test-runner';
import { runPlaywrightCode } from '../application/playwright-runner';
import { DOMAnalyzer } from '../infrastructure/selectors/dom-analyzer';
import { PlaywrightController } from '../infrastructure/browser/playwright-controller';
import { browserSessionManager } from '../infrastructure/browser/browser-session-manager';
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
    // Support two request formats:
    //  1. Flat:   { id, name, steps, website_url, ... }         — used by the frontend
    //  2. Nested: { testCase: {...}, headless: bool, ... }      — used by qa-loop-executor
    const isNestedFormat = req.body.testCase !== undefined && typeof req.body.testCase === 'object';
    const testCase: TestCase = isNestedFormat ? req.body.testCase : req.body;
    const headless = isNestedFormat ? (req.body.headless === true) : (req.query.headless === 'true');

    // Defensive: normalize steps to always be an array (guards against JSONB double-serialisation
    // or the field being absent entirely when sent by qa-loop-executor)
    if (!Array.isArray(testCase.steps)) {
      const rawSteps = (testCase as any).steps;
      testCase.steps = typeof rawSteps === 'string'
        ? (() => { try { return JSON.parse(rawSteps); } catch { return []; } })()
        : [];
      logger.warn('Normalized testCase.steps to array', {
        testCaseId: testCase.id,
        originalType: typeof rawSteps,
        resultLength: testCase.steps.length
      });
    }

    // Ensure every step has a UUID id (required by step_results DB constraint),
    // every navigate step has a URL, and string targets are converted to
    // structured selectors (QA loop saves targets as plain strings like "#email").
    const websiteUrlFallback = testCase.website_url || '';
    testCase.steps = testCase.steps.map((step: any) => {
      const fixed = { ...step };
      // Add missing step id — step_results.step_id is NOT NULL
      if (!fixed.id || !validateUUID(fixed.id)) {
        fixed.id = uuidv4();
      }

      // Navigate steps: move URL-string targets to value
      if (fixed.action === 'navigate') {
        if (typeof fixed.target === 'string' && fixed.target.startsWith('http')) {
          fixed.value = fixed.value || fixed.target;
          fixed.target = undefined;
        }
        if (!fixed.value && !fixed.target?.attributes?.href && websiteUrlFallback) {
          fixed.value = websiteUrlFallback;
          logger.debug('Patched navigate step with website_url fallback', {
            testCaseId: testCase.id, websiteUrl: websiteUrlFallback
          });
        }
      }

      // Auto-convert old generic 'assert' to smart assertion types
      if (fixed.action === 'assert') {
        const val = (fixed.value || '').toLowerCase();
        const tgt = typeof fixed.target === 'string' ? fixed.target.toLowerCase() : '';
        const combinedCtx = `${tgt} ${val} ${(fixed.expected_outcome || '').toLowerCase()}`;

        if (combinedCtx.includes('url') && (fixed.value || tgt)) {
          // URL assertion
          fixed.action = 'assert_url_contains';
          fixed.value = fixed.value || (typeof fixed.target === 'string' ? fixed.target : '');
        } else if (combinedCtx.includes('not') && (combinedCtx.includes('exist') || combinedCtx.includes('visible') || combinedCtx.includes('hidden'))) {
          // Element should not exist
          fixed.action = 'assert_element_not_exists';
        } else if (combinedCtx.includes('console') || combinedCtx.includes('error') && combinedCtx.includes('no ')) {
          // No console errors
          fixed.action = 'assert_no_console_errors';
        } else if (fixed.value && !tgt) {
          // Has value but no meaningful target → text visibility check
          fixed.action = 'assert_text_visible';
        } else if (typeof fixed.target === 'string' && !fixed.target.startsWith('#') && !fixed.target.startsWith('.') && !fixed.target.startsWith('[') && !fixed.target.startsWith('//') && fixed.target.length > 3) {
          // Plain text target → check if text is visible on page
          fixed.action = 'assert_text_visible';
          fixed.value = fixed.value || fixed.target;
        } else {
          // Default: check element exists
          fixed.action = 'assert_element_exists';
        }
        logger.info('Auto-converted generic assert', {
          originalTarget: typeof fixed.target === 'string' ? fixed.target : 'object',
          originalValue: fixed.value,
          convertedAction: fixed.action,
        });
      }

      // Smart assertion actions that don't need selector conversion
      const assertionActions = [
        'assert_url_contains', 'assert_url_equals', 'assert_text_visible',
        'assert_no_console_errors', 'assert_input_value',
        'assert_element_exists', 'assert_element_not_exists'
      ];

      // Convert string targets to structured selectors for non-navigate, non-assertion steps
      if (typeof fixed.target === 'string' && fixed.action !== 'navigate' && !assertionActions.includes(fixed.action)) {
        const rawTarget = fixed.target;
        const selectors: any[] = [];

        if (rawTarget.startsWith('#')) {
          selectors.push({ type: 'css', value: rawTarget, stability_score: 0.9 });
          selectors.push({ type: 'id', value: rawTarget, stability_score: 0.9 });
        } else if (rawTarget.startsWith('.') || rawTarget.startsWith('[')) {
          selectors.push({ type: 'css', value: rawTarget, stability_score: 0.8 });
        } else if (rawTarget.startsWith('//') || rawTarget.startsWith('xpath=')) {
          selectors.push({ type: 'xpath', value: rawTarget, stability_score: 0.6 });
        } else {
          selectors.push({ type: 'text', value: `text="${rawTarget}"`, stability_score: 0.7 });
          selectors.push({ type: 'css', value: `button:has-text("${rawTarget}")`, stability_score: 0.6 });
          selectors.push({ type: 'css', value: `a:has-text("${rawTarget}")`, stability_score: 0.5 });
        }

        fixed.target = { text: rawTarget };
        if (!fixed.suggested_selectors || fixed.suggested_selectors.length === 0) {
          fixed.suggested_selectors = selectors;
        }
      }

      return fixed;
    });

    // Log raw request body for debugging
    try {
      const rawBody = JSON.stringify(testCase);
      logger.debug('Raw request body received', {
        bodySize: rawBody.length,
        isNestedFormat,
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
    // Accept both 'url' and 'website_url' for backward compatibility (Phase 1)
    const { website_url, url, prerequisite_steps, contextId, captureCurrentPage, includeScreenshot } = req.body;
    const targetUrl = url || website_url;

    // If contextId is provided, use persistent session (for QA Loop)
    if (contextId) {
      try {
        if (captureCurrentPage) {
          // Just capture current state without navigating
          const result = await browserSessionManager.captureState(contextId);
          if (result.error) {
            return res.status(400).json({ error: result.error });
          }
          return res.json({
            html: result.html,
            screenshot: result.screenshot,
            url: result.url,
            title: result.title
          });
        } else if (targetUrl) {
          // Navigate to URL in existing session
          const result = await browserSessionManager.navigate(contextId, targetUrl);
          return res.json({
            html: result.html,
            screenshot: result.screenshot,
            url: result.url,
            title: result.title
          });
        } else {
          return res.status(400).json({ error: 'url is required when contextId is provided and captureCurrentPage is false' });
        }
      } catch (sessionError: any) {
        logger.error('Session-based capture failed', { contextId, error: sessionError.message });
        return res.status(500).json({ error: sessionError.message });
      }
    }

    // Legacy behavior: create temporary browser for capture
    if (!targetUrl) {
      return res.status(400).json({ error: 'url or website_url is required' });
    }

    const steps: Array<{ action: string; selector: string; value?: string }> =
      Array.isArray(prerequisite_steps) ? prerequisite_steps : [];

    logger.info('Capturing page content', { targetUrl, prerequisiteStepsCount: steps.length });

    // Create a temporary browser controller for page capture
    const screenshotsDir = process.env.SCREENSHOTS_DIR || './screenshots';
    const browserController = new PlaywrightController(screenshotsDir);

    try {
      // Initialize browser (headless for page capture)
      await browserController.initialize(true);

      // Navigate to website
      await browserController.navigate(targetUrl);

      // Wait a bit for page to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Run prerequisite steps to open the create/edit dialog
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        try {
          if (step.action === 'click') {
            await browserController.click(step.selector);
          } else if (step.action === 'type') {
            await browserController.type(step.selector, step.value ?? '');
          }
          await new Promise((r) => setTimeout(r, 400));
        } catch (stepErr: any) {
          logger.warn('Prerequisite step failed', { index: i, step, error: stepErr.message });
          throw new Error(`Prerequisite step ${i + 1} failed: ${stepErr.message}`);
        }
      }

      // If we ran steps, wait for dialog/form to be visible
      if (steps.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Get HTML
      const html = await browserController.getPageHTML();

      // Take screenshot and convert to base64
      const screenshotPath = await browserController.takeScreenshot();
      const fs = require('fs');
      const screenshotBuffer = fs.readFileSync(screenshotPath);
      const screenshotBase64 = screenshotBuffer.toString('base64');

      // Get current URL and title
      const page = browserController.getPage();
      const currentUrl = page ? page.url() : targetUrl;
      const pageTitle = page ? await page.title() : '';

      // Clean up screenshot file
      try {
        fs.unlinkSync(screenshotPath);
      } catch (e) {
        // Ignore cleanup errors
      }

      // Close browser
      await browserController.close();

      logger.info('Page content captured successfully', { url: currentUrl, title: pageTitle, htmlLength: html.length });

      // Return screenshot (not screenshot_base64) for compatibility with browser-tools (Phase 1)
      res.json({
        html,
        screenshot: screenshotBase64,
        screenshot_base64: screenshotBase64, // Keep for backward compatibility
        url: currentUrl,
        title: pageTitle
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
    logger.error('Failed to capture page content', error, { url: req.body?.url || req.body?.website_url });
    res.status(500).json({ error: error.message || 'Failed to capture page content' });
  }
});

router.post('/api/detect-elements', async (req: Request, res: Response) => {
  try {
    const { html, screenshot_path, target_description, contextId } = req.body;

    // If contextId is provided, detect elements from live page
    if (contextId) {
      const elements = await browserSessionManager.detectElements(contextId);
      if (elements.error) {
        return res.status(400).json({ error: elements.error });
      }
      return res.json(elements);
    }

    // Legacy: analyze from HTML string
    const domAnalyzer = new DOMAnalyzer();
    const selectors = domAnalyzer.analyzeHTML(html, target_description);

    res.json({ selectors });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Element detection failed' });
  }
});

// Stop a running execution
router.post('/api/executions/:executionId/stop', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;

    if (!executionId || !validateUUID(executionId)) {
      return res.status(400).json({ error: 'Invalid execution ID' });
    }

    // Check if execution exists and is running
    const execution = await executionRepository.findById(executionId);
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    if (execution.status !== 'running') {
      return res.status(400).json({
        error: `Execution is not running (current status: ${execution.status})`
      });
    }

    // Stop the execution
    await testRunner.stopExecution(executionId);

    // Update execution status in database
    await executionRepository.updateStatus(
      executionId,
      'cancelled',
      new Date(),
      'Test execution was cancelled by user'
    );

    logger.info('Execution stopped', { executionId });
    res.json({
      success: true,
      message: 'Execution stopped successfully',
      execution_id: executionId
    });
  } catch (error: any) {
    logger.error('Failed to stop execution', error, {
      executionId: req.params.executionId
    });
    res.status(500).json({ error: error.message || 'Failed to stop execution' });
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

// ============================================================================
// QA Loop Browser Session Endpoints
// These endpoints maintain persistent browser sessions for login/exploration
// ============================================================================

/**
 * Create or get a browser context for persistent session
 */
router.post('/api/context/create', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    logger.info('Creating browser context', { sessionId });

    await browserSessionManager.getOrCreateSession(sessionId);

    res.json({
      success: true,
      contextId: sessionId,
      message: 'Browser context created'
    });
  } catch (error: any) {
    logger.error('Failed to create browser context', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Close a browser context
 */
router.post('/api/context/close', async (req: Request, res: Response) => {
  try {
    const { contextId } = req.body;

    if (!contextId) {
      return res.status(400).json({ error: 'contextId is required' });
    }

    logger.info('Closing browser context', { contextId });

    await browserSessionManager.closeSession(contextId);

    res.json({
      success: true,
      message: 'Browser context closed'
    });
  } catch (error: any) {
    logger.error('Failed to close browser context', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Perform browser actions (click, type, scroll, goBack, screenshot)
 * This is the main endpoint for QA Loop browser interactions
 */
router.post('/api/action', async (req: Request, res: Response) => {
  try {
    const { action, contextId, selector, value, direction, amount, clearFirst } = req.body;

    if (!contextId) {
      return res.status(400).json({ error: 'contextId is required' });
    }

    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    logger.info('Executing browser action', { action, contextId, selector });

    let result: any;

    switch (action) {
      case 'click':
        if (!selector) {
          return res.status(400).json({ error: 'selector is required for click action' });
        }
        result = await browserSessionManager.click(contextId, selector);
        break;

      case 'type':
        if (!selector) {
          return res.status(400).json({ error: 'selector is required for type action' });
        }
        result = await browserSessionManager.type(contextId, selector, value || '', clearFirst !== false);
        break;

      case 'scroll':
        result = await browserSessionManager.scroll(contextId, direction || 'down', amount || 500);
        break;

      case 'goBack':
        result = await browserSessionManager.goBack(contextId);
        break;

      case 'screenshot':
        result = await browserSessionManager.getScreenshot(contextId);
        break;

      case 'captureState':
        result = await browserSessionManager.captureState(contextId);
        break;

      case 'detectElements':
        result = await browserSessionManager.detectElements(contextId);
        break;

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    if (result.error) {
      logger.warn('Browser action failed', { action, contextId, error: result.error });
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error: any) {
    logger.error('Browser action error', { error: error.message, action: req.body?.action });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Enhanced capture-page that works with persistent sessions
 * Supports both new browser (no contextId) and existing session (with contextId)
 */
router.post('/api/capture-page-session', async (req: Request, res: Response) => {
  try {
    const { url, contextId, includeScreenshot } = req.body;

    if (!url && !contextId) {
      return res.status(400).json({ error: 'url or contextId is required' });
    }

    // If contextId provided, use existing session
    if (contextId) {
      if (url) {
        // Navigate to URL in existing session
        const result = await browserSessionManager.navigate(contextId, url);
        res.json({
          ...result,
          contextId
        });
      } else {
        // Just capture current state
        const result = await browserSessionManager.captureState(contextId);
        res.json({
          ...result,
          contextId
        });
      }
    } else {
      // Create temporary session, navigate, and return
      const tempSessionId = `temp-${Date.now()}`;
      try {
        const result = await browserSessionManager.navigate(tempSessionId, url);
        res.json(result);
      } finally {
        // Clean up temporary session
        await browserSessionManager.closeSession(tempSessionId);
      }
    }
  } catch (error: any) {
    logger.error('Failed to capture page with session', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ── Run raw Playwright code ──────────────────────────────────────────────────
router.post('/api/run-playwright', async (req: Request, res: Response) => {
  try {
    const { playwrightCode, timeoutMs, timeout, env } = req.body;

    if (!playwrightCode || typeof playwrightCode !== 'string') {
      return res.status(400).json({ error: 'playwrightCode (string) is required' });
    }

    // Accept both `timeoutMs` and `timeout` from request body
    const effectiveTimeout = timeoutMs ?? timeout ?? 30_000;

    const result = await runPlaywrightCode(playwrightCode, {
      timeoutMs: effectiveTimeout,
      env: env ?? {},
    });

    res.json({
      status: result.passed ? 'passed' : 'failed',
      passed: result.passed,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      screenshots: result.screenshots,
      duration: result.duration,
      error: result.error,
      humanError: result.humanError,
      retryCount: result.retryCount,
    });
  } catch (error: any) {
    logger.error('Failed to run Playwright code', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;

