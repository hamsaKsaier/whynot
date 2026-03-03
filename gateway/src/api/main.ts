import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
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
import { ProjectRepository } from '../../shared/database/repositories/project-repository';
import { UserStoryRepository } from '../../shared/database/repositories/user-story-repository';
import { FolderRepository } from '../../shared/database/repositories/folder-repository';
import { SetupHookRepository } from '../../shared/database/repositories/setup-hook-repository';
import { VisualRegressionRepository } from '../../shared/database/repositories/visual-regression-repository';
import type { TestCaseEntity } from '../../shared/database/repositories/test-case-repository';
import type { ExecutionEntity, StepResultEntity } from '../../shared/database/repositories/execution-repository';
import { ExecutionResult, StepResult } from '../../shared/types';
import { query } from '../../shared/database/connection';
import { requireAuth } from '../middleware/auth';
import * as authService from '../services/auth-service';
import { WorkspaceRepository } from '../../shared/database/repositories/workspace-repository';
import { startCleanupScheduler, runCleanup } from '../services/cleanup-service';

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

/**
 * Transform database entity to frontend ExecutionResult format
 */
function transformExecutionEntity(entity: ExecutionEntity, steps: StepResult[] = []): ExecutionResult {
  return {
    execution_id: entity.id,
    test_case_id: entity.test_case_id,
    status: entity.status as 'running' | 'completed' | 'failed' | 'timeout' | 'paused',
    steps: steps,
    total_duration_ms: entity.total_duration_ms ?? 0,
    screenshots: entity.screenshots || [],
    error: entity.error || undefined,
    started_at: entity.started_at.toISOString(),
    completed_at: entity.completed_at ? entity.completed_at.toISOString() : undefined
  };
}

/**
 * Transform step result entity to StepResult format
 */
function transformStepResultEntity(entity: StepResultEntity): StepResult {
  const stepResult: StepResult = {
    step_id: entity.step_id,
    success: entity.success,
    execution_time_ms: entity.execution_time_ms,
    error: entity.error || undefined,
    screenshot_path: entity.screenshot_path || undefined,
    element_found: entity.element_found ?? undefined
  };

  // Parse JSONB selector_used field
  if (entity.selector_used) {
    if (typeof entity.selector_used === 'string') {
      try {
        stepResult.selector_used = JSON.parse(entity.selector_used);
      } catch {
        // If parsing fails, leave undefined
      }
    } else {
      stepResult.selector_used = entity.selector_used;
    }
  }

  return stepResult;
}

/**
 * Transform execution with steps to ExecutionResult format
 */
function transformExecutionWithSteps(
  execution: ExecutionEntity,
  steps: StepResultEntity[]
): ExecutionResult {
  const transformedSteps = steps.map(transformStepResultEntity);
  return transformExecutionEntity(execution, transformedSteps);
}

const app = express();
const PORT = process.env.PORT || 3000;
const logger = createLogger('gateway');

// Middleware
// #region agent log
const corsOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
try { fs.appendFileSync('/Users/takiacademy/whynot/.cursor/debug.log', JSON.stringify({ location: 'gateway/src/api/main.ts:46', message: 'CORS origin configuration', data: { corsOrigin, frontendUrlEnv: process.env.FRONTEND_URL, defaultUsed: !process.env.FRONTEND_URL }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) + '\n'); } catch (e) { }
// #endregion
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Workspace-ID'],
  exposedHeaders: ['X-Request-ID', 'RateLimit-*']
}));
// #region agent log
app.use((req, res, next) => {
  if (req.path === '/api/projects' || req.path.startsWith('/api/projects')) {
    fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'gateway/src/api/main.ts:57', message: 'Projects request received', data: { method: req.method, path: req.path, origin: req.headers.origin, allowedOrigin: corsOrigin, originMatches: req.headers.origin === corsOrigin, headers: Object.keys(req.headers) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
    if (req.method === 'OPTIONS') {
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'gateway/src/api/main.ts:60', message: 'OPTIONS preflight request', data: { origin: req.headers.origin, allowedOrigin: corsOrigin, accessControlRequestMethod: req.headers['access-control-request-method'] }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(() => { });
    }
  }
  next();
});
// #endregion
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
const projectRepository = new ProjectRepository();
const userStoryRepository = new UserStoryRepository();
const folderRepository = new FolderRepository();
const setupHookRepository = new SetupHookRepository();
const visualRegressionRepository = new VisualRegressionRepository();
const workspaceRepository = new WorkspaceRepository();

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

// ==================== AUTH ROUTES (public — no auth middleware) ====================

app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    throw createError('email, password, and name are required', 400, 'VALIDATION_ERROR');
  }
  const result = await authService.register(String(email), String(password), String(name));
  res.status(201).json({ success: true, ...result });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw createError('email and password are required', 400, 'VALIDATION_ERROR');
  }
  const result = await authService.login(String(email), String(password));
  res.json({ success: true, ...result });
}));

app.post('/api/auth/logout', (_req, res) => {
  // JWT is stateless; client drops the token
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
}));

app.get('/api/auth/github', (_req, res) => {
  try {
    res.redirect(authService.getGithubAuthUrl());
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/github/callback', asyncHandler(async (req, res) => {
  const { code } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (!code || typeof code !== 'string') {
    return res.redirect(`${frontendUrl}/login?error=no_code`);
  }
  try {
    const result = await authService.handleGithubCallback(code);
    res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`);
  } catch (err: any) {
    logger.error('GitHub OAuth callback error', { error: err.message });
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
}));

app.get('/api/auth/google', (_req, res) => {
  try {
    res.redirect(authService.getGoogleAuthUrl());
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/google/callback', asyncHandler(async (req, res) => {
  const { code } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  if (!code || typeof code !== 'string') {
    return res.redirect(`${frontendUrl}/login?error=no_code`);
  }
  try {
    const result = await authService.handleGoogleCallback(code);
    res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`);
  } catch (err: any) {
    logger.error('Google OAuth callback error', { error: err.message });
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
}));

// ==================== WORKSPACE ROUTES (require auth) ====================

app.get('/api/workspaces', requireAuth, asyncHandler(async (req, res) => {
  const workspaces = await workspaceRepository.findAllByUserId(req.user!.id);
  res.json({ success: true, workspaces });
}));

app.post('/api/workspaces', requireAuth, asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError('Workspace name is required', 400, 'VALIDATION_ERROR');
  }
  const workspace = await workspaceRepository.create({ name: name.trim(), owner_id: req.user!.id });
  res.status(201).json({ success: true, workspace });
}));

app.get('/api/workspaces/:id', requireAuth, asyncHandler(async (req, res) => {
  const workspace = await workspaceRepository.findById(req.params.id);
  if (!workspace || workspace.owner_id !== req.user!.id) {
    throw createError('Workspace not found', 404, 'NOT_FOUND');
  }
  res.json({ success: true, workspace });
}));

app.put('/api/workspaces/:id', requireAuth, asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError('Workspace name is required', 400, 'VALIDATION_ERROR');
  }
  const workspace = await workspaceRepository.findById(req.params.id);
  if (!workspace || workspace.owner_id !== req.user!.id) {
    throw createError('Workspace not found', 404, 'NOT_FOUND');
  }
  const updated = await workspaceRepository.update(req.params.id, name.trim());
  res.json({ success: true, workspace: updated });
}));

app.delete('/api/workspaces/:id', requireAuth, asyncHandler(async (req, res) => {
  const workspace = await workspaceRepository.findById(req.params.id);
  if (!workspace || workspace.owner_id !== req.user!.id) {
    throw createError('Workspace not found', 404, 'NOT_FOUND');
  }
  const count = await workspaceRepository.countByUserId(req.user!.id);
  if (count <= 1) {
    throw createError('Cannot delete your only workspace', 400, 'LAST_WORKSPACE');
  }
  await workspaceRepository.delete(req.params.id);
  res.json({ success: true, message: 'Workspace deleted' });
}));

// ─── All routes below this line require a valid JWT ───────────────────────────
app.use('/api', requireAuth);

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
  const { website_url, user_story, additional_context, project_id, user_story_id, prerequisite_steps, quick_mode } = req.body;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'gateway/main.ts:/api/generate-tests', message: 'Request body quick_mode received', data: { quick_mode_raw: quick_mode, quick_mode_type: typeof quick_mode, req_body_keys: Object.keys(req.body) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
  // #endregion

  let sanitizedUrl: string;
  let sanitizedStory: string;
  let sanitizedContext: string | undefined;
  let linkedUserStoryId: string | undefined;

  // If user_story_id is provided, fetch the user story from database
  if (user_story_id) {
    const existingUserStory = await userStoryRepository.findById(user_story_id);
    if (!existingUserStory) {
      throw createError('User story not found', 404, 'NOT_FOUND');
    }

    sanitizedUrl = existingUserStory.website_url || website_url;
    sanitizedStory = existingUserStory.story;
    sanitizedContext = existingUserStory.additional_context || additional_context;
    linkedUserStoryId = user_story_id;

    // Verify project_id matches if provided
    if (project_id && existingUserStory.project_id !== project_id) {
      throw createError('User story does not belong to the specified project', 400, 'VALIDATION_ERROR');
    }
  } else {
    // Use provided values (legacy mode or quick test)
    sanitizedUrl = sanitizeUrl(website_url);
    sanitizedStory = sanitizeText(user_story, 5000);
    sanitizedContext = additional_context ? sanitizeText(additional_context, 2000) : undefined;
  }

  const userStory: UserStory = {
    story: sanitizedStory,
    website_url: sanitizedUrl,
    additional_context: sanitizedContext
  };

  logger.info('Generating test cases', {
    websiteUrl: sanitizedUrl,
    hasAdditionalContext: !!sanitizedContext,
    projectId: project_id,
    userStoryId: linkedUserStoryId,
    quickMode: quick_mode
  });

  // Use method that captures page content first, then generates tests
  // Note: generateTestCasesWithPageCapture returns TestCase[] (array)
  // Validation info is handled internally by the orchestrator
  const quickMode = quick_mode === true || quick_mode === 'true';
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'gateway/main.ts:before-orchestrator', message: 'QuickMode value before orchestrator call', data: { quickMode, quick_mode_raw: quick_mode, quick_mode_comparison_true: quick_mode === true, quick_mode_comparison_string: quick_mode === 'true' }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C2' }) }).catch(() => { });
  // #endregion
  const testCases: TestCase[] = await orchestrator.generateTestCasesWithPageCapture(userStory, prerequisite_steps, quickMode);

  // Persist generated test cases with user_story_id link
  try {
    for (const testCase of testCases) {
      // Create test case with user_story_id if available
      const created = await testCaseRepository.create(testCase);

      // Update the test case to link to user story if we have one
      if (linkedUserStoryId && created) {
        await query(
          'UPDATE test_cases SET user_story_id = $1 WHERE id = $2',
          [linkedUserStoryId, created.id]
        );
      }
    }
    logger.debug('Generated test cases persisted to database', {
      count: testCases.length,
      linkedToUserStory: !!linkedUserStoryId
    });
  } catch (dbError: any) {
    logger.error('Failed to persist test cases to database', dbError);
    // Don't fail the request if DB persistence fails
  }

  // Return test cases (validation info is included in each test case's validation_result field if available)
  res.json({
    test_cases: testCases,
    user_story_id: linkedUserStoryId
  });
}));

// Execute a test case (test case already generated) (with stricter rate limiting)
app.post('/api/execute-test', testExecutionRateLimiter, validate(schemas.executeTest), asyncHandler(async (req, res) => {
  const testCase = req.body;
  const headless = req.query.headless === 'true';

  logger.info('Executing test case', { testCaseId: testCase.id, headless });

  // Ensure test case exists in database before execution
  try {
    const existingTestCase = await testCaseRepository.findById(testCase.id);
    if (!existingTestCase) {
      logger.info('Test case not found in database, persisting it first', { testCaseId: testCase.id });
      await testCaseRepository.create(testCase);
      logger.debug('Test case persisted to database');
    }
  } catch (dbError: any) {
    logger.warn('Failed to check/persist test case to database', { error: dbError.message, testCaseId: testCase.id });
    // Continue execution even if persistence fails
  }

  const executionResult = await orchestrator.executeTest(testCase, headless);
  logger.info('Test execution completed', {
    executionId: executionResult.execution_id,
    status: executionResult.status,
    durationMs: executionResult.total_duration_ms
  });

  // Only persist execution result if it's a final status (not "starting")
  // For non-headless mode, the test-executor will persist the final result asynchronously
  // Check if status is "starting" by checking the message field or status string
  const isStartingStatus = (executionResult as any).status === 'starting' || (executionResult as any).message?.includes('Connect to WebSocket');
  if (!isStartingStatus) {
    try {
      await executionRepository.create(executionResult);
      logger.debug('Execution result persisted to database');
    } catch (dbError: any) {
      logger.error('Failed to persist execution to database', dbError);
      // Don't fail the request if DB persistence fails
    }
  } else {
    logger.debug('Skipping persistence for "starting" status - will be persisted by test-executor when complete');
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

// Debug endpoint to check rate limit configuration
app.get('/api/debug/rate-limits', (req, res) => {
  res.json({
    rate_limits: {
      test_execution_max: process.env.RATE_LIMIT_TEST_EXECUTION_MAX || '10 (default)',
      test_generation_max: process.env.RATE_LIMIT_TEST_GENERATION_MAX || '20 (default)',
      max_requests: process.env.RATE_LIMIT_MAX_REQUESTS || '100 (default)',
    },
    parsed_values: {
      test_execution_max: parseInt(process.env.RATE_LIMIT_TEST_EXECUTION_MAX || '10', 10),
      test_generation_max: parseInt(process.env.RATE_LIMIT_TEST_GENERATION_MAX || '20', 10),
      max_requests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    }
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
  const transformed = transformExecutionWithSteps(result.execution, result.steps);
  res.json(transformed);
}));

// ==================== PROJECT ENDPOINTS ====================

// List all projects
app.get('/api/projects', asyncHandler(async (req, res) => {
  // #region agent log
  try { fs.appendFileSync('/Users/takiacademy/whynot/.cursor/debug.log', JSON.stringify({ location: 'gateway/src/api/main.ts:353', message: 'Projects endpoint handler entry', data: { offset: req.query.offset, limit: req.query.limit, origin: req.headers.origin }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) + '\n'); } catch (e) { }
  // #endregion
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  // #region agent log
  try { fs.appendFileSync('/Users/takiacademy/whynot/.cursor/debug.log', JSON.stringify({ location: 'gateway/src/api/main.ts:356', message: 'Before database query', data: { offset, limit }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) + '\n'); } catch (e) { }
  // #endregion
  const projects = await projectRepository.listWithStats(offset, limit, req.workspaceId);
  const total = await projectRepository.count(req.workspaceId);
  // #region agent log
  try { fs.appendFileSync('/Users/takiacademy/whynot/.cursor/debug.log', JSON.stringify({ location: 'gateway/src/api/main.ts:357', message: 'Projects endpoint handler exit', data: { projectsCount: projects.length, total }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) + '\n'); } catch (e) { }
  // #endregion
  res.json({ projects, offset, limit, total });
}));

// Create a new project
app.post('/api/projects', asyncHandler(async (req, res) => {
  const { name, description, website_url } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError('Project name is required', 400, 'VALIDATION_ERROR');
  }

  logger.info('Creating project', { name });
  const project = await projectRepository.create({
    name: name.trim(),
    description: description?.trim() || undefined,
    website_url: website_url?.trim() || undefined,
    workspace_id: req.workspaceId
  });

  res.status(201).json({ success: true, project });
}));

// Get project by ID
app.get('/api/projects/:id', asyncHandler(async (req, res) => {
  const project = await projectRepository.findByIdWithStats(req.params.id);
  if (!project) {
    throw createError('Project not found', 404, 'NOT_FOUND');
  }
  res.json({ project });
}));

// Update project
app.put('/api/projects/:id', asyncHandler(async (req, res) => {
  const { name, description, website_url } = req.body;

  logger.info('Updating project', { projectId: req.params.id });
  const updated = await projectRepository.update(req.params.id, {
    name: name?.trim(),
    description: description?.trim(),
    website_url: website_url?.trim()
  });

  if (!updated) {
    throw createError('Project not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, project: updated });
}));

// Delete project
app.delete('/api/projects/:id', asyncHandler(async (req, res) => {
  logger.info('Deleting project', { projectId: req.params.id });

  const project = await projectRepository.findById(req.params.id);
  if (!project) {
    throw createError('Project not found', 404, 'NOT_FOUND');
  }

  await projectRepository.delete(req.params.id);
  res.json({ success: true, message: 'Project deleted successfully' });
}));

// ==================== USER STORY ENDPOINTS ====================

// List user stories for a project
app.get('/api/projects/:id/user-stories', asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);

  // Verify project exists
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw createError('Project not found', 404, 'NOT_FOUND');
  }

  const userStories = await userStoryRepository.findByProjectIdWithStats(projectId, offset, limit);
  const total = await userStoryRepository.countByProjectId(projectId);
  res.json({ user_stories: userStories, offset, limit, total });
}));

// Create user story in a project
app.post('/api/projects/:id/user-stories', asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const { story, website_url, additional_context } = req.body;

  // Verify project exists
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw createError('Project not found', 404, 'NOT_FOUND');
  }

  if (!story || typeof story !== 'string' || story.trim().length === 0) {
    throw createError('User story text is required', 400, 'VALIDATION_ERROR');
  }

  logger.info('Creating user story', { projectId, story: story.substring(0, 50) });
  const userStory = await userStoryRepository.create({
    project_id: projectId,
    story: story.trim(),
    website_url: website_url?.trim() || project.website_url || undefined,
    additional_context: additional_context?.trim() || undefined,
    workspace_id: req.workspaceId
  });

  res.status(201).json({ success: true, user_story: userStory });
}));

// Get user story by ID
app.get('/api/user-stories/:id', asyncHandler(async (req, res) => {
  const userStory = await userStoryRepository.findByIdWithStats(req.params.id);
  if (!userStory) {
    throw createError('User story not found', 404, 'NOT_FOUND');
  }
  res.json({ user_story: userStory });
}));

// Update user story
app.put('/api/user-stories/:id', asyncHandler(async (req, res) => {
  const { story, website_url, additional_context } = req.body;

  logger.info('Updating user story', { userStoryId: req.params.id });
  const updated = await userStoryRepository.update(req.params.id, {
    story: story?.trim(),
    website_url: website_url?.trim(),
    additional_context: additional_context?.trim()
  });

  if (!updated) {
    throw createError('User story not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, user_story: updated });
}));

// Delete user story
app.delete('/api/user-stories/:id', asyncHandler(async (req, res) => {
  logger.info('Deleting user story', { userStoryId: req.params.id });

  const userStory = await userStoryRepository.findById(req.params.id);
  if (!userStory) {
    throw createError('User story not found', 404, 'NOT_FOUND');
  }

  await userStoryRepository.delete(req.params.id);
  res.json({ success: true, message: 'User story deleted successfully' });
}));

// Assign user story to folder
app.put('/api/user-stories/:id/folder', asyncHandler(async (req, res) => {
  const { folder_id } = req.body;

  logger.info('Assigning user story to folder', { userStoryId: req.params.id, folderId: folder_id });

  const userStory = await userStoryRepository.findById(req.params.id);
  if (!userStory) {
    throw createError('User story not found', 404, 'NOT_FOUND');
  }

  // Verify folder exists if folder_id is provided
  if (folder_id) {
    const folder = await folderRepository.findById(folder_id);
    if (!folder) {
      throw createError('Folder not found', 404, 'NOT_FOUND');
    }
  }

  await folderRepository.assignUserStoryToFolder(req.params.id, folder_id || null);
  res.json({ success: true, message: 'User story assigned to folder successfully' });
}));

// ==================== SETUP HOOK ENDPOINTS ====================

// List all setup hooks
app.get('/api/setup-hooks', asyncHandler(async (req, res) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const level = req.query.level as 'global' | 'suite' | 'test_case' | undefined;

  let hooks;
  if (level) {
    hooks = await setupHookRepository.findByLevel(level);
  } else {
    hooks = await setupHookRepository.list(offset, limit);
  }

  res.json({ hooks, offset, limit });
}));

// Get setup hook by ID
app.get('/api/setup-hooks/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  const hook = await setupHookRepository.findById(id);

  if (!hook) {
    throw createError('Setup hook not found', 404, 'NOT_FOUND');
  }

  res.json({ hook });
}));

// Create setup hook
app.post('/api/setup-hooks', asyncHandler(async (req, res) => {
  const { name, level, steps, enabled, test_case_id, folder_id } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError('Setup hook name is required', 400, 'VALIDATION_ERROR');
  }

  if (!level || !['global', 'suite', 'test_case'].includes(level)) {
    throw createError('Level must be one of: global, suite, test_case', 400, 'VALIDATION_ERROR');
  }

  if (!Array.isArray(steps)) {
    throw createError('Steps must be an array', 400, 'VALIDATION_ERROR');
  }

  // Validate level-specific constraints
  if (level === 'global' && (test_case_id || folder_id)) {
    throw createError('Global hooks cannot have test_case_id or folder_id', 400, 'VALIDATION_ERROR');
  }
  if (level === 'suite' && (!folder_id || test_case_id)) {
    throw createError('Suite hooks must have folder_id and no test_case_id', 400, 'VALIDATION_ERROR');
  }
  if (level === 'test_case' && (!test_case_id || folder_id)) {
    throw createError('Test case hooks must have test_case_id and no folder_id', 400, 'VALIDATION_ERROR');
  }

  logger.info('Creating setup hook', { name, level });
  const hook = await setupHookRepository.create({
    name: name.trim(),
    level,
    steps,
    enabled: enabled !== undefined ? enabled : true,
    test_case_id: test_case_id || null,
    folder_id: folder_id || null
  });

  res.status(201).json({ success: true, hook });
}));

// Update setup hook
app.put('/api/setup-hooks/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { name, steps, enabled } = req.body;

  const existingHook = await setupHookRepository.findById(id);
  if (!existingHook) {
    throw createError('Setup hook not found', 404, 'NOT_FOUND');
  }

  const updates: any = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw createError('Setup hook name must be a non-empty string', 400, 'VALIDATION_ERROR');
    }
    updates.name = name.trim();
  }
  if (steps !== undefined) {
    if (!Array.isArray(steps)) {
      throw createError('Steps must be an array', 400, 'VALIDATION_ERROR');
    }
    updates.steps = steps;
  }
  if (enabled !== undefined) {
    updates.enabled = Boolean(enabled);
  }

  const hook = await setupHookRepository.update(id, updates);
  res.json({ success: true, hook });
}));

// Delete setup hook
app.delete('/api/setup-hooks/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;

  const existingHook = await setupHookRepository.findById(id);
  if (!existingHook) {
    throw createError('Setup hook not found', 404, 'NOT_FOUND');
  }

  await setupHookRepository.delete(id);
  res.json({ success: true, message: 'Setup hook deleted successfully' });
}));

// Get setup hooks for a test case (includes global, suite, and test_case level)
app.get('/api/test-cases/:testCaseId/setup-hooks', asyncHandler(async (req, res) => {
  const testCaseId = req.params.testCaseId;

  // Verify test case exists
  const testCase = await testCaseRepository.findById(testCaseId);
  if (!testCase) {
    throw createError('Test case not found', 404, 'NOT_FOUND');
  }

  // Get folder_id from test case's user_story if available
  const result = await query<{ folder_id: string | null }>(
    `SELECT us.folder_id 
     FROM test_cases tc
     LEFT JOIN user_stories us ON tc.user_story_id = us.id
     WHERE tc.id = $1`,
    [testCaseId]
  );
  const folderId = result[0]?.folder_id || null;

  const { global, suite, testCase: testCaseHooks } = await setupHookRepository.findAllForTestCase(
    testCaseId,
    folderId
  );

  res.json({ hooks: { global, suite, test_case: testCaseHooks } });
}));

// ==================== FOLDER ENDPOINTS ====================

// List folders for a project
app.get('/api/projects/:projectId/folders', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;

  logger.info('Fetching folders for project', { projectId });

  // Verify project exists
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw createError('Project not found', 404, 'NOT_FOUND');
  }

  const folders = await folderRepository.listByProjectWithStats(projectId);
  res.json({ folders });
}));

// Create folder in a project
app.post('/api/projects/:projectId/folders', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  const { name, color } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError('Folder name is required', 400, 'VALIDATION_ERROR');
  }

  logger.info('Creating folder', { projectId, name });

  // Verify project exists
  const project = await projectRepository.findById(projectId);
  if (!project) {
    throw createError('Project not found', 404, 'NOT_FOUND');
  }

  const folder = await folderRepository.create({
    project_id: projectId,
    name: name.trim(),
    color: color || '#6366f1'
  });

  res.status(201).json({ success: true, folder });
}));

// Get folder by ID
app.get('/api/folders/:id', asyncHandler(async (req, res) => {
  const folder = await folderRepository.findById(req.params.id);

  if (!folder) {
    throw createError('Folder not found', 404, 'NOT_FOUND');
  }

  res.json({ folder });
}));

// Update folder
app.put('/api/folders/:id', asyncHandler(async (req, res) => {
  const { name, color } = req.body;

  logger.info('Updating folder', { folderId: req.params.id });

  const updates: { name?: string; color?: string } = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw createError('Folder name cannot be empty', 400, 'VALIDATION_ERROR');
    }
    updates.name = name.trim();
  }
  if (color !== undefined) {
    updates.color = color;
  }

  const folder = await folderRepository.update(req.params.id, updates);

  if (!folder) {
    throw createError('Folder not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, folder });
}));

// Delete folder
app.delete('/api/folders/:id', asyncHandler(async (req, res) => {
  logger.info('Deleting folder', { folderId: req.params.id });

  const folder = await folderRepository.findById(req.params.id);
  if (!folder) {
    throw createError('Folder not found', 404, 'NOT_FOUND');
  }

  await folderRepository.delete(req.params.id);
  res.json({ success: true, message: 'Folder deleted successfully' });
}));

// ==================== TEST CASE ENDPOINTS ====================

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
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  const filters = (status || search) ? {
    status: status as 'completed' | 'failed' | 'running' | 'timeout' | 'paused' | undefined,
    search: search
  } : undefined;

  const [executions, total] = await Promise.all([
    executionRepository.list(offset, limit, filters),
    executionRepository.count(filters)
  ]);

  const transformedExecutions = executions.map(entity => transformExecutionEntity(entity));

  res.json({
    executions: transformedExecutions,
    total,
    offset,
    limit
  });
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

// Get flow data for visualization
app.get('/api/flow-data', asyncHandler(async (req, res) => {
  logger.info('Fetching flow data for visualization');

  try {
    // Fetch all projects
    const projects = await query<any>(`
      SELECT id, name, description, website_url, created_at, updated_at
      FROM projects
      ORDER BY created_at DESC
    `);

    const flowData: any[] = [];

    for (const project of projects) {
      // Fetch folders for this project
      const folders = await query<any>(`
        SELECT id, project_id, name, color, created_at, updated_at
        FROM user_story_folders
        WHERE project_id = $1
        ORDER BY name ASC
      `, [project.id]);

      // Fetch user stories for this project (including folder_id)
      const userStories = await query<any>(`
        SELECT id, project_id, story, website_url, additional_context, folder_id, created_at, updated_at
        FROM user_stories
        WHERE project_id = $1
        ORDER BY created_at DESC
      `, [project.id]);

      const projectUserStories: any[] = [];

      for (const userStory of userStories) {
        // Fetch test suites for this user story
        const testSuites = await query<any>(`
          SELECT id, user_story_id, name, description, created_at, updated_at
          FROM test_suites
          WHERE user_story_id = $1
          ORDER BY created_at DESC
        `, [userStory.id]);

        const userStoryTestSuites: any[] = [];

        for (const testSuite of testSuites) {
          // Fetch test cases for this test suite
          const testCases = await query<any>(`
            SELECT id, name, description, website_url, user_story, steps, metadata, created_at, updated_at
            FROM test_cases
            WHERE test_suite_id = $1
            ORDER BY created_at DESC
          `, [testSuite.id]);

          const testSuiteTestCases = testCases.map((tc: any) => {
            const steps = typeof tc.steps === 'string' ? JSON.parse(tc.steps) : tc.steps;
            const metadata = typeof tc.metadata === 'string' ? JSON.parse(tc.metadata) : (tc.metadata || {});
            return {
              test_case: transformTestCaseEntity({
                id: tc.id,
                name: tc.name,
                description: tc.description || '',
                website_url: tc.website_url,
                user_story: tc.user_story,
                steps: steps,
                metadata: metadata,
                created_at: tc.created_at,
                updated_at: tc.updated_at
              }),
              steps: steps || []
            };
          });

          userStoryTestSuites.push({
            test_suite: testSuite,
            test_cases: testSuiteTestCases
          });
        }

        // Also fetch test cases directly linked to user story (without test suite)
        const directTestCases = await query<any>(`
          SELECT id, name, description, website_url, user_story, steps, metadata, created_at, updated_at
          FROM test_cases
          WHERE user_story_id = $1 AND test_suite_id IS NULL
          ORDER BY created_at DESC
        `, [userStory.id]);

        const directTestCasesFormatted = directTestCases.map((tc: any) => {
          const steps = typeof tc.steps === 'string' ? JSON.parse(tc.steps) : tc.steps;
          const metadata = typeof tc.metadata === 'string' ? JSON.parse(tc.metadata) : (tc.metadata || {});
          return {
            test_case: transformTestCaseEntity({
              id: tc.id,
              name: tc.name,
              description: tc.description || '',
              website_url: tc.website_url,
              user_story: tc.user_story,
              steps: steps,
              metadata: metadata,
              created_at: tc.created_at,
              updated_at: tc.updated_at
            }),
            steps: steps || []
          };
        });

        projectUserStories.push({
          user_story: userStory,
          test_suites: userStoryTestSuites,
          test_cases: directTestCasesFormatted
        });
      }

      // Also handle test cases with user_story text but no user_story_id (backward compatibility)
      const orphanTestCases = await query<any>(`
        SELECT id, name, description, website_url, user_story, steps, metadata, created_at, updated_at
        FROM test_cases
        WHERE user_story_id IS NULL 
          AND user_story IS NOT NULL 
          AND user_story != ''
          AND website_url = COALESCE($1, website_url)
        ORDER BY created_at DESC
      `, [project.website_url || null]);

      if (orphanTestCases.length > 0) {
        // Group by user_story text
        const groupedByStory: Record<string, any[]> = {};
        for (const tc of orphanTestCases) {
          const storyText = tc.user_story;
          if (!groupedByStory[storyText]) {
            groupedByStory[storyText] = [];
          }
          groupedByStory[storyText].push(tc);
        }

        for (const [storyText, testCases] of Object.entries(groupedByStory)) {
          const orphanUserStory = {
            id: `orphan-${project.id}-${storyText.substring(0, 50)}`,
            project_id: project.id,
            story: storyText,
            website_url: testCases[0].website_url,
            additional_context: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const formattedTestCases = testCases.map((tc: any) => {
            const steps = typeof tc.steps === 'string' ? JSON.parse(tc.steps) : tc.steps;
            const metadata = typeof tc.metadata === 'string' ? JSON.parse(tc.metadata) : (tc.metadata || {});
            return {
              test_case: transformTestCaseEntity({
                id: tc.id,
                name: tc.name,
                description: tc.description || '',
                website_url: tc.website_url,
                user_story: tc.user_story,
                steps: steps,
                metadata: metadata,
                created_at: tc.created_at,
                updated_at: tc.updated_at
              }),
              steps: steps || []
            };
          });

          projectUserStories.push({
            user_story: orphanUserStory,
            test_suites: [],
            test_cases: formattedTestCases
          });
        }
      }

      flowData.push({
        project: project,
        folders: folders,
        user_stories: projectUserStories
      });
    }

    // If no projects exist, create structure from test cases directly (backward compatibility)
    if (flowData.length === 0) {
      const allTestCases = await query<any>(`
        SELECT id, name, description, website_url, user_story, steps, metadata, created_at, updated_at
        FROM test_cases
        WHERE user_story IS NOT NULL AND user_story != ''
        ORDER BY website_url, user_story, created_at DESC
      `);

      if (allTestCases.length > 0) {
        // Group by website_url and user_story
        const grouped: Record<string, Record<string, any[]>> = {};
        for (const tc of allTestCases) {
          const url = tc.website_url || 'default';
          const story = tc.user_story;
          if (!grouped[url]) {
            grouped[url] = {};
          }
          if (!grouped[url][story]) {
            grouped[url][story] = [];
          }
          grouped[url][story].push(tc);
        }

        for (const [websiteUrl, stories] of Object.entries(grouped)) {
          const defaultProject = {
            id: `default-${websiteUrl}`,
            name: `Project: ${websiteUrl}`,
            description: 'Auto-created from test cases',
            website_url: websiteUrl !== 'default' ? websiteUrl : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const projectUserStories: any[] = [];

          for (const [storyText, testCases] of Object.entries(stories)) {
            const userStory = {
              id: `orphan-${defaultProject.id}-${storyText.substring(0, 50)}`,
              project_id: defaultProject.id,
              story: storyText,
              website_url: websiteUrl !== 'default' ? websiteUrl : null,
              additional_context: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            const formattedTestCases = testCases.map((tc: any) => {
              const steps = typeof tc.steps === 'string' ? JSON.parse(tc.steps) : tc.steps;
              const metadata = typeof tc.metadata === 'string' ? JSON.parse(tc.metadata) : (tc.metadata || {});
              return {
                test_case: transformTestCaseEntity({
                  id: tc.id,
                  name: tc.name,
                  description: tc.description || '',
                  website_url: tc.website_url,
                  user_story: tc.user_story,
                  steps: steps,
                  metadata: metadata,
                  created_at: tc.created_at,
                  updated_at: tc.updated_at
                }),
                steps: steps || []
              };
            });

            projectUserStories.push({
              user_story: userStory,
              test_suites: [],
              test_cases: formattedTestCases
            });
          }

          flowData.push({
            project: defaultProject,
            user_stories: projectUserStories
          });
        }
      }
    }

    res.json({ projects: flowData });
  } catch (error: any) {
    logger.error('Error fetching flow data', error);
    throw createError('Failed to fetch flow data', 500, 'INTERNAL_ERROR');
  }
}));

// Chatbot endpoints (proxy to AI service)
const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

app.post('/api/chat/session', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.post(
      `${aiServiceUrl}/api/chat/session`,
      req.body,
      { headers: { 'Content-Type': 'application/json' } }
    );
    res.json(response.data);
  } catch (error: any) {
    logger.error('Chat session creation failed', { error: error.message });
    throw createError('Failed to create chat session', 500, 'INTERNAL_ERROR');
  }
}));

app.post('/api/chat/message', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.post(
      `${aiServiceUrl}/api/chat/message`,
      req.body,
      { headers: { 'Content-Type': 'application/json' } }
    );
    res.json(response.data);
  } catch (error: any) {
    logger.error('Chat message processing failed', { error: error.message });
    throw createError('Failed to process chat message', 500, 'INTERNAL_ERROR');
  }
}));

app.get('/api/chat/session/:id', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get(
      `${aiServiceUrl}/api/chat/session/${req.params.id}`
    );
    res.json(response.data);
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw createError('Chat session not found', 404, 'NOT_FOUND');
    }
    logger.error('Failed to get chat session', { error: error.message });
    throw createError('Failed to get chat session', 500, 'INTERNAL_ERROR');
  }
}));

app.post('/api/chat/generate-test', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.post(
      `${aiServiceUrl}/api/chat/generate-test`,
      req.body,
      { headers: { 'Content-Type': 'application/json' } }
    );
    res.json(response.data);
  } catch (error: any) {
    logger.error('Test generation from chat failed', { error: error.message });
    throw createError('Failed to generate test from chat', 500, 'INTERNAL_ERROR');
  }
}));

app.post('/api/chat/modify-test', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.post(
      `${aiServiceUrl}/api/chat/modify-test`,
      req.body,
      { headers: { 'Content-Type': 'application/json' } }
    );
    res.json(response.data);
  } catch (error: any) {
    logger.error('Test modification from chat failed', { error: error.message });
    throw createError('Failed to modify test from chat', 500, 'INTERNAL_ERROR');
  }
}));

// ==================== VISUAL REGRESSION ENDPOINTS ====================

// Get baselines for a test case
app.get('/api/test-cases/:id/baselines', asyncHandler(async (req, res) => {
  const testCaseId = req.params.id;

  // Verify test case exists
  const testCase = await testCaseRepository.findById(testCaseId);
  if (!testCase) {
    throw createError('Test case not found', 404, 'NOT_FOUND');
  }

  const baselines = await visualRegressionRepository.getBaselinesByTestCase(testCaseId);
  res.json({ baselines });
}));

// Get baseline history for a test case and step
app.get('/api/test-cases/:testCaseId/baselines/:stepId', asyncHandler(async (req, res) => {
  const testCaseId = req.params.testCaseId;
  const stepId = req.params.stepId;

  // Verify test case exists
  const testCase = await testCaseRepository.findById(testCaseId);
  if (!testCase) {
    throw createError('Test case not found', 404, 'NOT_FOUND');
  }

  const baselines = await visualRegressionRepository.getBaselineHistory(testCaseId, stepId);
  res.json({ baselines });
}));

// Create/update baseline (manual)
app.post('/api/test-cases/:testCaseId/baselines', asyncHandler(async (req, res) => {
  const testCaseId = req.params.testCaseId;
  const { step_id, screenshot_path, execution_id } = req.body;

  if (!step_id || !screenshot_path) {
    throw createError('step_id and screenshot_path are required', 400, 'VALIDATION_ERROR');
  }

  // Verify test case exists
  const testCase = await testCaseRepository.findById(testCaseId);
  if (!testCase) {
    throw createError('Test case not found', 404, 'NOT_FOUND');
  }

  // Calculate screenshot hash
  const fs = require('fs');
  const crypto = require('crypto');
  if (!fs.existsSync(screenshot_path)) {
    throw createError('Screenshot file not found', 404, 'NOT_FOUND');
  }
  const screenshotBuffer = fs.readFileSync(screenshot_path);
  const screenshotHash = crypto.createHash('sha256').update(screenshotBuffer).digest('hex');

  // Create baseline
  const baseline = await visualRegressionRepository.createBaseline({
    test_case_id: testCaseId,
    step_id,
    screenshot_path,
    screenshot_hash: screenshotHash,
    execution_id: execution_id || null,
    is_locked: false,
    created_by: 'system'
  });

  res.status(201).json({ success: true, baseline });
}));

// Lock/unlock baseline
app.put('/api/test-cases/:testCaseId/baselines/:baselineId/lock', asyncHandler(async (req, res) => {
  const baselineId = req.params.baselineId;
  const { is_locked } = req.body;

  if (typeof is_locked !== 'boolean') {
    throw createError('is_locked must be a boolean', 400, 'VALIDATION_ERROR');
  }

  const success = await visualRegressionRepository.setBaselineLock(baselineId, is_locked);
  if (!success) {
    throw createError('Baseline not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, message: `Baseline ${is_locked ? 'locked' : 'unlocked'}` });
}));

// Get visual comparisons for an execution
app.get('/api/executions/:id/visual-comparisons', asyncHandler(async (req, res) => {
  const executionId = req.params.id;

  // Verify execution exists
  const execution = await executionRepository.findById(executionId);
  if (!execution) {
    throw createError('Execution not found', 404, 'NOT_FOUND');
  }

  const comparisons = await visualRegressionRepository.getComparisonsByExecution(executionId);
  res.json({ comparisons });
}));

// Get all visual regressions (filtered, paginated)
app.get('/api/visual-regressions', asyncHandler(async (req, res) => {
  const { ignored, severity, limit = 50, offset = 0 } = req.query;

  const options: any = {
    limit: parseInt(limit as string, 10),
    offset: parseInt(offset as string, 10)
  };

  if (ignored !== undefined) {
    options.ignored = ignored === 'true';
  }
  if (severity) {
    options.severity = severity as 'low' | 'medium' | 'high' | 'critical';
  }

  const regressions = await visualRegressionRepository.getRegressions(options);
  res.json({ regressions });
}));

// Ignore/unignore a visual regression
app.put('/api/visual-regressions/:id/ignore', asyncHandler(async (req, res) => {
  const comparisonId = req.params.id;
  const { ignored } = req.body;

  if (typeof ignored !== 'boolean') {
    throw createError('ignored must be a boolean', 400, 'VALIDATION_ERROR');
  }

  const comparison = await visualRegressionRepository.updateComparison(comparisonId, { ignored });
  if (!comparison) {
    throw createError('Visual comparison not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, comparison });
}));

// ==================== QA LOOP ENDPOINTS ====================
// Proxy to qa-loop-executor service

const qaLoopExecutorUrl = process.env.QA_LOOP_EXECUTOR_URL || 'http://localhost:3002';

// Start a new QA Loop session
app.post('/api/qa-loop/sessions', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.post(
      `${qaLoopExecutorUrl}/api/sessions`,
      req.body,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
    res.status(201).json(response.data);
  } catch (error: any) {
    logger.error('Failed to start QA Loop session', { error: error.message });
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      throw createError('Failed to start QA Loop session', 500, 'INTERNAL_ERROR');
    }
  }
}));

// List QA Loop sessions
app.get('/api/qa-loop/sessions', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get(
      `${qaLoopExecutorUrl}/api/sessions`,
      {
        params: req.query,
        timeout: 10000
      }
    );
    res.json(response.data);
  } catch (error: any) {
    const details = error.response?.data?.details || error.response?.data?.error || error.message;
    logger.error('Failed to list QA Loop sessions', { error: error.message, details });
    if (error.response?.status && error.response.status !== 500) {
      res.status(error.response.status).json(error.response.data);
      return;
    }
    throw createError(
      details ? `Failed to list QA Loop sessions: ${details}` : 'Failed to list QA Loop sessions',
      500,
      'INTERNAL_ERROR'
    );
  }
}));

// Get QA Loop session details
app.get('/api/qa-loop/sessions/:id', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get(
      `${qaLoopExecutorUrl}/api/sessions/${req.params.id}`,
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw createError('QA Loop session not found', 404, 'NOT_FOUND');
    }
    logger.error('Failed to get QA Loop session', { error: error.message });
    throw createError('Failed to get QA Loop session', 500, 'INTERNAL_ERROR');
  }
}));

// Pause QA Loop session
app.post('/api/qa-loop/sessions/:id/pause', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.post(
      `${qaLoopExecutorUrl}/api/sessions/${req.params.id}/pause`,
      {},
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw createError('QA Loop session not found or not active', 404, 'NOT_FOUND');
    }
    logger.error('Failed to pause QA Loop session', { error: error.message });
    throw createError('Failed to pause QA Loop session', 500, 'INTERNAL_ERROR');
  }
}));

// Resume QA Loop session
app.post('/api/qa-loop/sessions/:id/resume', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.post(
      `${qaLoopExecutorUrl}/api/sessions/${req.params.id}/resume`,
      {},
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw createError('QA Loop session not found', 404, 'NOT_FOUND');
    }
    logger.error('Failed to resume QA Loop session', { error: error.message });
    throw createError('Failed to resume QA Loop session', 500, 'INTERNAL_ERROR');
  }
}));

// Stop QA Loop session
app.post('/api/qa-loop/sessions/:id/stop', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.post(
      `${qaLoopExecutorUrl}/api/sessions/${req.params.id}/stop`,
      {},
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error: any) {
    logger.error('Failed to stop QA Loop session', { error: error.message });
    throw createError('Failed to stop QA Loop session', 500, 'INTERNAL_ERROR');
  }
}));

// Run retest for a session
app.post('/api/qa-loop/sessions/:id/retest', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.post(
      `${qaLoopExecutorUrl}/api/sessions/${req.params.id}/retest`,
      req.body,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
    res.status(201).json(response.data);
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw createError('QA Loop session not found', 404, 'NOT_FOUND');
    }
    logger.error('Failed to start retest', { error: error.message });
    throw createError('Failed to start retest', 500, 'INTERNAL_ERROR');
  }
}));

// Get test cases for a session
app.get('/api/qa-loop/sessions/:id/test-cases', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get(
      `${qaLoopExecutorUrl}/api/sessions/${req.params.id}/test-cases`,
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error: any) {
    logger.error('Failed to get QA Loop test cases', { error: error.message });
    throw createError('Failed to get test cases', 500, 'INTERNAL_ERROR');
  }
}));

// Get bugs for a session
app.get('/api/qa-loop/sessions/:id/bugs', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get(
      `${qaLoopExecutorUrl}/api/sessions/${req.params.id}/bugs`,
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error: any) {
    logger.error('Failed to get QA Loop bugs', { error: error.message });
    throw createError('Failed to get bugs', 500, 'INTERNAL_ERROR');
  }
}));

// Get explored pages for a session
app.get('/api/qa-loop/sessions/:id/pages', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get(
      `${qaLoopExecutorUrl}/api/sessions/${req.params.id}/pages`,
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error: any) {
    logger.error('Failed to get QA Loop pages', { error: error.message });
    throw createError('Failed to get pages', 500, 'INTERNAL_ERROR');
  }
}));

// Get test runs for a session
app.get('/api/qa-loop/sessions/:id/test-runs', asyncHandler(async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get(
      `${qaLoopExecutorUrl}/api/sessions/${req.params.id}/test-runs`,
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error: any) {
    logger.error('Failed to get QA Loop test runs', { error: error.message });
    throw createError('Failed to get test runs', 500, 'INTERNAL_ERROR');
  }
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
      execute_test: 'POST /api/execute-test',
      chat_session: 'POST /api/chat/session',
      chat_message: 'POST /api/chat/message',
      chat_session_get: 'GET /api/chat/session/:id',
      qa_loop_start: 'POST /api/qa-loop/sessions',
      qa_loop_list: 'GET /api/qa-loop/sessions',
      qa_loop_details: 'GET /api/qa-loop/sessions/:id',
      qa_loop_retest: 'POST /api/qa-loop/sessions/:id/retest'
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

// Manual cleanup trigger (protected by requireAuth middleware applied earlier)
app.post('/api/cleanup/screenshots', requireAuth, asyncHandler(async (_req, res) => {
  const result = runCleanup();
  res.json({ success: true, deleted: result });
}));

// Error handling middleware (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info('Gateway service started', {
    port: PORT,
    aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    testExecutorUrl: process.env.TEST_EXECUTOR_URL || 'http://localhost:3001'
  });

  // Start screenshot cleanup scheduler (runs once on startup + every 24h)
  startCleanupScheduler();
});

