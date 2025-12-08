import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { WorkflowOrchestrator } from '../workflow/workflow-orchestrator';
import { UserStory, TestCase } from '../../shared/types';
import { errorHandler, asyncHandler, createError } from '../middleware/error-handler';
import { requestLogger } from '../middleware/request-logger';
import { validate, schemas, sanitizeUrl, sanitizeText } from '../middleware/validation';
import { apiRateLimiter, testExecutionRateLimiter, testGenerationRateLimiter } from '../middleware/rate-limit';
import { createLogger } from '../../shared/logger/logger';
import { metrics } from '../../shared/utils/metrics';
import { TestCaseRepository } from '../../shared/database/repositories/test-case-repository';
import { ExecutionRepository } from '../../shared/database/repositories/execution-repository';
import type { TestCaseEntity } from '../../shared/database/repositories/test-case-repository';

dotenv.config();

/**
 * Transform database entity to frontend TestCase format
 */
function transformTestCaseEntity(entity: TestCaseEntity): TestCase {
  // Parse JSONB fields
  const steps = typeof entity.steps === 'string' ? JSON.parse(entity.steps) : entity.steps;
  const metadata = typeof entity.metadata === 'string' ? JSON.parse(entity.metadata) : (entity.metadata || {});
  
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description || '',
    website_url: entity.website_url,
    steps: steps,
    metadata: metadata
  };
}

const app = express();
const PORT = process.env.PORT || 3000;
const logger = createLogger('gateway');

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'RateLimit-*']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (before routes)
app.use(requestLogger);

// Apply general rate limiting to all API routes
app.use('/api', apiRateLimiter);

// Serve screenshots (if needed)
app.use('/api/screenshots', express.static(path.join(__dirname, '../../screenshots')));

// Initialize orchestrator
const orchestrator = new WorkflowOrchestrator(
  process.env.AI_SERVICE_URL || 'http://localhost:8000',
  process.env.TEST_EXECUTOR_URL || 'http://localhost:3001'
);

// Initialize repositories
const testCaseRepository = new TestCaseRepository();
const executionRepository = new ExecutionRepository();

// Health check with detailed status
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    dependencies: {
      aiService: {
        url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
        status: 'unknown' // Could check actual connectivity
      },
      testExecutor: {
        url: process.env.TEST_EXECUTOR_URL || 'http://localhost:3001',
        status: 'unknown' // Could check actual connectivity
      }
    }
  };

  // Try to check dependency health (non-blocking)
  try {
    const axios = require('axios');
    const [aiHealth, executorHealth] = await Promise.allSettled([
      axios.get(`${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/health`, { timeout: 2000 }).catch(() => null),
      axios.get(`${process.env.TEST_EXECUTOR_URL || 'http://localhost:3001'}/health`, { timeout: 2000 }).catch(() => null)
    ]);

    if (aiHealth.status === 'fulfilled' && aiHealth.value?.status === 200) {
      health.dependencies.aiService.status = 'healthy';
    } else {
      health.dependencies.aiService.status = 'unhealthy';
      health.status = 'degraded';
    }

    if (executorHealth.status === 'fulfilled' && executorHealth.value?.status === 200) {
      health.dependencies.testExecutor.status = 'healthy';
    } else {
      health.dependencies.testExecutor.status = 'unhealthy';
      health.status = 'degraded';
    }
  } catch (error) {
    // Ignore health check errors
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Main workflow endpoint (with stricter rate limiting)
app.post('/api/run-test', testExecutionRateLimiter, validate(schemas.runTest), asyncHandler(async (req, res) => {
  const { website_url, user_story, headless = false, additional_context } = req.body;

  // Sanitize inputs
  const sanitizedUrl = sanitizeUrl(website_url);
  const sanitizedStory = sanitizeText(user_story, 5000);
  const sanitizedContext = additional_context ? sanitizeText(additional_context, 2000) : undefined;

  const userStory: UserStory = {
    story: sanitizedStory,
    website_url: sanitizedUrl,
    additional_context: sanitizedContext
  };

  logger.info('Starting workflow', { website_url, headless });
  const result = await orchestrator.runCompleteWorkflow(userStory, headless);
  logger.info('Workflow completed', {
    testCaseId: result.testCase.id,
    status: result.executionResult.status,
    durationMs: result.executionResult.total_duration_ms
  });

  // Persist test case and execution
  try {
    await testCaseRepository.create(result.testCase);
    await executionRepository.create(result.executionResult);
    logger.debug('Test case and execution persisted to database');
  } catch (dbError: any) {
    logger.error('Failed to persist to database', dbError);
    // Don't fail the request if DB persistence fails
  }

  // Record metrics
  metrics.increment('workflow_completed', { status: result.executionResult.status });
  metrics.record('workflow_duration', result.executionResult.total_duration_ms, {
    status: result.executionResult.status
  });

  // Handle case where executionResult might not have steps yet (non-headless mode)
  const steps = result.executionResult.steps || [];
  const passedSteps = steps.filter((s: any) => s.success).length;
  const failedSteps = steps.filter((s: any) => !s.success).length;

  res.json({
    success: true,
    test_case: result.testCase,
    execution_result: result.executionResult,
    summary: {
      test_name: result.testCase.name,
      total_steps: result.testCase.steps.length,
      passed_steps: passedSteps,
      failed_steps: failedSteps,
      status: result.executionResult.status,
      duration_ms: result.executionResult.total_duration_ms || 0
    }
  });
}));

// Generate tests only (without execution) (with rate limiting)
app.post('/api/generate-tests', testGenerationRateLimiter, validate(schemas.generateTests), asyncHandler(async (req, res) => {
  const { website_url, user_story, additional_context } = req.body;

  // Sanitize inputs
  const sanitizedUrl = sanitizeUrl(website_url);
  const sanitizedStory = sanitizeText(user_story, 5000);
  const sanitizedContext = additional_context ? sanitizeText(additional_context, 2000) : undefined;

  const userStory: UserStory = {
    story: sanitizedStory,
    website_url: sanitizedUrl,
    additional_context: sanitizedContext
  };

  const testCases = await orchestrator.generateTestCases(userStory);

  // Persist generated test cases
  try {
    for (const testCase of testCases) {
      await testCaseRepository.create(testCase);
    }
    logger.debug('Generated test cases persisted to database', { count: testCases.length });
  } catch (dbError: any) {
    logger.error('Failed to persist test cases to database', dbError);
    // Don't fail the request if DB persistence fails
  }

  res.json({ test_cases: testCases });
}));

// Execute a test case (test case already generated) (with stricter rate limiting)
app.post('/api/execute-test', testExecutionRateLimiter, validate(schemas.executeTest), asyncHandler(async (req, res) => {
  const testCase = req.body;
  const headless = req.query.headless === 'true';

  logger.info('Executing test case', { testCaseId: testCase.id, headless });
  const executionResult = await orchestrator.executeTest(testCase, headless);
  logger.info('Test execution completed', {
    executionId: executionResult.execution_id,
    status: executionResult.status,
    durationMs: executionResult.total_duration_ms
  });

  // Persist execution result
  try {
    await executionRepository.create(executionResult);
    logger.debug('Execution result persisted to database');
  } catch (dbError: any) {
    logger.error('Failed to persist execution to database', dbError);
    // Don't fail the request if DB persistence fails
  }

  res.json(executionResult);
}));

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    service: 'gateway',
    timestamp: new Date().toISOString(),
    ...metrics.getSummary()
  });
});

// Get test case by ID
app.get('/api/test-cases/:id', asyncHandler(async (req, res) => {
  const entity = await testCaseRepository.findById(req.params.id);
  if (!entity) {
    throw createError('Test case not found', 404, 'NOT_FOUND');
  }
  const testCase = transformTestCaseEntity(entity);
  res.json(testCase);
}));

// Get execution by ID with step results
app.get('/api/executions/:id', asyncHandler(async (req, res) => {
  const result = await executionRepository.findByIdWithSteps(req.params.id);
  if (!result) {
    throw createError('Execution not found', 404, 'NOT_FOUND');
  }
  res.json(result);
}));

// List test cases
app.get('/api/test-cases', asyncHandler(async (req, res) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const entities = await testCaseRepository.list(offset, limit);
  const testCases = entities.map(transformTestCaseEntity);
  res.json({ test_cases: testCases, offset, limit });
}));

// List executions
app.get('/api/executions', asyncHandler(async (req, res) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const executions = await executionRepository.list(offset, limit);
  res.json({ executions, offset, limit });
}));

// Update test case
app.put('/api/test-cases/:id', validate(schemas.executeTest), asyncHandler(async (req, res) => {
  const id = req.params.id;
  const updates = req.body;
  
  logger.info('Updating test case', { testCaseId: id });
  const updated = await testCaseRepository.update(id, updates);
  if (!updated) {
    throw createError('Test case not found', 404, 'NOT_FOUND');
  }
  
  const testCase = transformTestCaseEntity(updated);
  res.json({ success: true, test_case: testCase });
}));

// Delete test case
app.delete('/api/test-cases/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  
  logger.info('Deleting test case', { testCaseId: id });
  const deleted = await testCaseRepository.delete(id);
  if (!deleted) {
    throw createError('Test case not found', 404, 'NOT_FOUND');
  }
  
  res.json({ success: true, message: 'Test case deleted successfully' });
}));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Thunder Code POC Gateway',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      run_test: 'POST /api/run-test',
      generate_tests: 'POST /api/generate-tests',
      execute_test: 'POST /api/execute-test'
    },
    example_request: {
      url: '/api/run-test',
      method: 'POST',
      body: {
        website_url: 'https://example.com',
        user_story: 'As a user, I want to login to the website',
        headless: true
      }
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info('Gateway service started', {
    port: PORT,
    aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    testExecutorUrl: process.env.TEST_EXECUTOR_URL || 'http://localhost:3001'
  });
});

