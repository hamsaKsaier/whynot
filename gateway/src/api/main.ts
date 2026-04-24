import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from '../config/env';
import { WorkflowOrchestrator } from '../workflow/workflow-orchestrator';
import { UserStory, TestCase } from '../../shared/types';
import { errorHandler, asyncHandler, createError } from '../middleware/error-handler';
import { requestLogger } from '../middleware/request-logger';
import { validate, schemas, sanitizeUrl, sanitizeText } from '../middleware/validation';
import { apiRateLimiter, testExecutionRateLimiter, testGenerationRateLimiter, qaLoopSessionRateLimiter, loginRateLimiter, registerRateLimiter, publicEndpointRateLimiter } from '../middleware/rate-limit';
import { buildCorsOrigins } from '../utils/cors-origins';
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
import { requireSuperAdmin } from '../middleware/admin-auth';
import * as authService from '../services/auth-service';
import { WorkspaceRepository } from '../../shared/database/repositories/workspace-repository';
import { PlanRepository } from '../../shared/database/repositories/plan-repository';
import { SubscriptionRepository } from '../../shared/database/repositories/subscription-repository';
import { CreditRepository } from '../../shared/database/repositories/credit-repository';
import { PaymentService } from '../payments/payment-service';
import { InvoiceRepository } from '../../shared/database/repositories/invoice-repository';
import { UserRepository } from '../../shared/database/repositories/user-repository';
import { startCleanupScheduler, runCleanup } from '../services/cleanup-service';
import { seedAdminUser } from '../../shared/database/seeds/admin-user';
import { seedFeatureFlags } from '../../shared/database/seeds/feature-flags';
import { requireCredits, deductCredits } from '../middleware/credit-gate';
import { recordUsageEvent } from '../utils/usage-tracker';
import { requireFeature, requireFeatureLimit } from '../middleware/feature-gate';
import { requireActiveSubscription } from '../middleware/subscription-check';
import { AuditRepository } from '../../shared/database/repositories/audit-repository';
import { SystemSettingsRepository } from '../../shared/database/repositories/system-settings-repository';
import { AnnouncementRepository } from '../../shared/database/repositories/announcement-repository';
import { i18nMiddleware } from '../middleware/i18n';
import { FeatureFlagRepository } from '../../shared/database/repositories/feature-flag-repository';
import { BillingConfigRepository } from '../../shared/database/repositories/billing-config-repository';
import { isValidFeatureKey } from '../../shared/constants/platform-features';
import { invalidateFlag, invalidateOrg, resolveAllFlags } from '../utils/feature-flags';
import { stripeWebhookRouter } from './webhooks/stripe';
import { generateText } from 'ai';
import { PlatformAiConfigRepository } from '../../shared/database/repositories/platform-ai-config-repository';
import { DecryptionKeyMismatchError } from '../utils/crypto/secret-cipher';
import { platformKeyCache } from '../utils/ai/platform-key-cache';
import { selectAIProvider } from '../utils/ai/select-ai-provider';
import { providerBaseUrl } from '../utils/ai/provider-base-url';
import type { AIProviderName } from '../utils/ai/detect-provider';
import { requireInternalNetwork } from '../middleware/internal-network';
import { getAllPlatformConfigs } from '../utils/ai/get-platform-ai-model';
import { meBillingRouter } from './me/billing';
import { meUsageRouter } from './me/usage';
import { PLANS, isPlanSlug } from '../../shared/constants/pricing';
import meProfileRouter from './me/profile';
import mePasswordRouter from './me/password';
import meOrganizationRouter from './me/organization';
import meApiKeysRouter from './me/api-keys';
import meLanguageRouter from './me/language';
import meNotificationsRouter from './me/notifications';
import meAccountRouter from './me/account';

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
const PORT = env.PORT;
const logger = createLogger('gateway');

// Trust the first proxy (Railway's reverse proxy) so express-rate-limit
// can read the real client IP from X-Forwarded-For.
app.set('trust proxy', 1);

// Middleware

// Security headers (Helmet.js)
// Sets: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection,
//       Strict-Transport-Security, X-DNS-Prefetch-Control, etc.
app.use(helmet({
  contentSecurityPolicy: false,  // API-only service — CSP handled by frontends
  crossOriginEmbedderPolicy: false,  // Allow embedding for preview/testing features
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

const corsOrigins = buildCorsOrigins();
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Workspace-ID'],
  exposedHeaders: ['X-Request-ID', 'RateLimit-*']
}));
// Stripe webhook needs raw body for signature verification — must be before express.json()
app.use(stripeWebhookRouter);

app.use(express.json({ limit: '12mb' })); // Allow document uploads (base64 encoded files)
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Request logging middleware (before routes)
app.use(requestLogger);

// i18n middleware — sets req.lang and req.t() based on Accept-Language header
app.use(i18nMiddleware);

// Apply general rate limiting to all API routes
app.use('/api', apiRateLimiter);

// Serve screenshots (if needed)
app.use('/api/screenshots', express.static(path.join(__dirname, '../../screenshots')));

// Serve video recordings (v2)
const videoDir = env.VIDEO_DIR;
app.use('/api/videos', express.static(videoDir));

// Initialize orchestrator
const orchestrator = new WorkflowOrchestrator(
  env.AI_SERVICE_URL,
  env.TEST_EXECUTOR_URL
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
const planRepository = new PlanRepository();
const subscriptionRepository = new SubscriptionRepository();
const creditRepository = new CreditRepository();
// PaymentService is static — no instantiation needed
const invoiceRepository = new InvoiceRepository();
const adminUserRepository = new UserRepository();
const auditRepository = new AuditRepository();
const systemSettingsRepository = new SystemSettingsRepository();
const announcementRepository = new AnnouncementRepository();
const featureFlagRepository = new FeatureFlagRepository();
const billingConfigRepository = new BillingConfigRepository();
const platformAiConfigRepository = new PlatformAiConfigRepository();

/** Fire-and-forget audit logging helper */
function auditLog(req: Express.Request, action: string, targetType?: string, targetId?: string, details?: Record<string, any>) {
  auditRepository.log({
    actor_id: req.user?.id,
    actor_email: req.user?.email || undefined,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
    ip_address: (req as any).ip,
    user_agent: (req as any).headers?.['user-agent'],
  }).catch(() => {});
}

// Health check with detailed status
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    version: '1.0.0',
    dependencies: {
      aiService: {
        url: env.AI_SERVICE_URL,
        status: 'unknown' // Could check actual connectivity
      },
      testExecutor: {
        url: env.TEST_EXECUTOR_URL,
        status: 'unknown' // Could check actual connectivity
      }
    }
  };

  // Try to check dependency health (non-blocking)
  try {
    const axios = require('axios');
    const [aiHealth, executorHealth] = await Promise.allSettled([
      axios.get(`${env.AI_SERVICE_URL}/health`, { timeout: 2000 }).catch(() => null),
      axios.get(`${env.TEST_EXECUTOR_URL}/health`, { timeout: 2000 }).catch(() => null)
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

app.post('/api/auth/register', registerRateLimiter, validate(schemas.register), asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  const result = await authService.register(String(email), String(password), String(name));
  res.status(201).json({ success: true, ...result });
}));

app.post('/api/auth/login', loginRateLimiter, validate(schemas.login), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(String(email), String(password));
  if (result.user.role === 'super_admin') {
    auditLog(req as any, 'superadmin.login', 'user', result.user.id, { email: result.user.email });
  }
  res.json({ success: true, ...result });
}));

app.post('/api/auth/logout', (req, res) => {
  // JWT is stateless; client drops the token
  res.json({ success: true, message: (req as any).t('success:auth.loggedOut') });
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
  const frontendUrl = env.FRONTEND_URL;
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
  const frontendUrl = env.FRONTEND_URL;
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

// ==================== FORGOT / RESET PASSWORD (public) ====================

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sendPasswordResetEmail } from '../services/email-service';

app.post('/api/auth/forgot-password', loginRateLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.json({ success: true, message: (req as any).t('success:auth.resetEmailSent') });
  }
  const users = await query<{ id: string; email: string }>('SELECT id, email FROM users WHERE email = $1', [email.trim().toLowerCase()]);
  if (users.length > 0) {
    const user = users[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [resetToken, expires, user.id]);
    sendPasswordResetEmail(email.trim().toLowerCase(), resetToken).catch(() => {});
  }
  res.json({ success: true, message: (req as any).t('success:auth.resetEmailSent') });
}));

app.post('/api/auth/reset-password', loginRateLimiter, asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || typeof token !== 'string' || !newPassword || typeof newPassword !== 'string') {
    throw createError((req as any).t('errors:auth.tokenRequired'), 400, 'VALIDATION_ERROR');
  }
  if (newPassword.length < 8) {
    throw createError((req as any).t('errors:auth.passwordMinLength'), 400, 'VALIDATION_ERROR');
  }
  const rows = await query<{ id: string }>('SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()', [token]);
  if (rows.length === 0) {
    throw createError((req as any).t('errors:auth.invalidResetToken'), 400, 'INVALID_TOKEN');
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [passwordHash, rows[0].id]);
  res.json({ success: true });
}));

// ==================== WORKSPACE ROUTES (require auth) ====================

app.get('/api/workspaces', requireAuth, asyncHandler(async (req, res) => {
  const workspaces = await workspaceRepository.findAllByUserId(req.user!.id);
  res.json({ success: true, workspaces });
}));

app.post('/api/workspaces', requireAuth, validate(schemas.createWorkspace), asyncHandler(async (req, res) => {
  const { name } = req.body;
  const workspace = await workspaceRepository.create({ name: name.trim(), owner_id: req.user!.id });
  res.status(201).json({ success: true, workspace });
}));

app.get('/api/workspaces/:id', requireAuth, asyncHandler(async (req, res) => {
  const workspace = await workspaceRepository.findById(req.params.id);
  if (!workspace || workspace.owner_id !== req.user!.id) {
    throw createError((req as any).t('errors:resource.workspaceNotFound'), 404, 'NOT_FOUND');
  }
  res.json({ success: true, workspace });
}));

app.put('/api/workspaces/:id', requireAuth, asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError((req as any).t('errors:validation.workspaceNameRequired'), 400, 'VALIDATION_ERROR');
  }
  const workspace = await workspaceRepository.findById(req.params.id);
  if (!workspace || workspace.owner_id !== req.user!.id) {
    throw createError((req as any).t('errors:resource.workspaceNotFound'), 404, 'NOT_FOUND');
  }
  const updated = await workspaceRepository.update(req.params.id, name.trim());
  res.json({ success: true, workspace: updated });
}));

app.delete('/api/workspaces/:id', requireAuth, asyncHandler(async (req, res) => {
  const workspace = await workspaceRepository.findById(req.params.id);
  if (!workspace || workspace.owner_id !== req.user!.id) {
    throw createError((req as any).t('errors:resource.workspaceNotFound'), 404, 'NOT_FOUND');
  }
  const count = await workspaceRepository.countByUserId(req.user!.id);
  if (count <= 1) {
    throw createError((req as any).t('errors:business.lastWorkspace'), 400, 'LAST_WORKSPACE');
  }
  await workspaceRepository.delete(req.params.id);
  res.json({ success: true, message: (req as any).t('success:workspace.deleted') });
}));

// ─── Public routes (no auth required, with dedicated rate limiting) ──────────
import { publicRouter } from './public-router';
app.use('/api/public', publicEndpointRateLimiter, publicRouter);

// ─── Landing lead capture (public, own rate limiter) ────────────────────────
import { landingLeadsRouter } from './landing-leads-router';
app.use('/api/landing', landingLeadsRouter);

// ─── CI routes (API key auth — must be before requireAuth blanket) ───────────
import { ciRouter } from './ci-router';
app.use('/api/ci', ciRouter);

// ─── Internal notification endpoint (no auth — called by qa-loop-executor) ──
import { sendScanCompleteEmail, sendCriticalBugEmail } from '../services/email-service';
app.post('/api/internal/notifications', asyncHandler(async (req, res) => {
  const { type, workspaceId, data } = req.body;
  if (!type || !workspaceId) return res.json({ ok: true }); // silently skip
  try {
    const members = await query<{ user_id: string }>(
      'SELECT user_id FROM workspace_members WHERE workspace_id = $1',
      [workspaceId],
    );
    const frontendUrl = env.FRONTEND_URL;
    for (const m of members) {
      if (type === 'scan_complete') {
        sendScanCompleteEmail(m.user_id, {
          projectName: data.projectName || data.targetUrl || 'QA Session',
          bugCount: data.bugCount || 0,
          criticalCount: data.criticalCount || 0,
          scanUrl: `${frontendUrl}/qa-loop?session=${data.sessionId || ''}`,
        }).catch(() => {});
      } else if (type === 'critical_bug') {
        sendCriticalBugEmail(m.user_id, {
          projectName: data.projectName || data.targetUrl || 'QA Session',
          bugTitle: data.bugTitle || 'Critical bug',
          severity: data.severity || 'critical',
          bugUrl: `${frontendUrl}/qa-loop?session=${data.sessionId || ''}`,
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    // Non-critical — log and move on
  }
  res.json({ ok: true });
}));

// ─── Internal: AI Config (Docker-network only, no auth) ──────────────────────
// Must be registered BEFORE the `/api` auth boundary below. Without this,
// requireAuth (line below) returns 401 to internal services like
// qa-loop-executor before `requireInternalNetwork` even runs.
app.get('/api/internal/ai-config',
  requireInternalNetwork,
  asyncHandler(async (_req, res) => {
    const configs = await getAllPlatformConfigs();
    const billingConfigRepo = new BillingConfigRepository();
    const defaultProvider = await billingConfigRepo.getDefaultAiProvider();
    const fallbackOrder = await billingConfigRepo.getAiFallbackOrder();
    const reconModels = await billingConfigRepo.getAllReconModels();

    res.json({
      success: true,
      providers: configs,
      defaultProvider,
      fallbackOrder,
      reconModels,
    });
  })
);

// ─── All routes below this line require a valid JWT ───────────────────────────
app.use('/api', requireAuth);

// ─── Monitor routes (requires auth) ──────────────────────────────────────────
import { monitorRouter } from './monitor-router';
app.use('/api/monitors', monitorRouter);

// ─── Performance testing routes (requires auth) ──────────────────────────────
import { perfRouter } from './perf-router';
app.use('/api/perf', perfRouter);

// ─── Recon scans (feature-flagged + plan-gated) ──────────────────────────────
import { reconRouter } from './recon';
app.use('/api/recon', reconRouter);

// ─── Bug Reporting + ClickUp/GitHub integration routes ──────────────────────
import { integrationsRouter, bugReportRouter } from './integrations-router';
app.use('/api/integrations', integrationsRouter);
app.use('/api', bugReportRouter);

// ─── Project credentials + notification preferences ─────────────────────────
import { credentialsRouter } from './credentials-router';
app.use('/api', credentialsRouter);

// ─── User AI config (BYO keys) ─────────────────────────────────────────────
import { aiConfigRouter } from './me/ai-config';
app.use('/api/me/ai-config', aiConfigRouter);

// ─── User settings routes ─────────────────────────────────────────────────
app.use('/api/me/profile', meProfileRouter);
app.use('/api/me/password', mePasswordRouter);
app.use('/api/me/organization', meOrganizationRouter);
app.use('/api/me/api-keys', meApiKeysRouter);
app.use('/api/me/language', meLanguageRouter);
app.use('/api/me/notifications', meNotificationsRouter);
app.use('/api/me', meAccountRouter);

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

  // Persist test case and execution (scoped to the requesting workspace)
  try {
    await testCaseRepository.create(result.testCase, req.workspaceId);
    await executionRepository.create(result.executionResult, req.workspaceId);
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
app.post('/api/generate-tests', testGenerationRateLimiter, requireActiveSubscription, requireCredits('TEST_GENERATION'), validate(schemas.generateTests), asyncHandler(async (req, res) => {
  const { website_url, user_story, additional_context, project_id, user_story_id, prerequisite_steps, quick_mode } = req.body;

  let sanitizedUrl: string;
  let sanitizedStory: string;
  let sanitizedContext: string | undefined;
  let linkedUserStoryId: string | undefined;

  // If user_story_id is provided, fetch the user story from database
  if (user_story_id) {
    const existingUserStory = await userStoryRepository.findById(user_story_id);
    if (!existingUserStory) {
      throw createError((req as any).t('errors:resource.userStoryNotFound'), 404, 'NOT_FOUND');
    }

    sanitizedUrl = existingUserStory.website_url || website_url;
    sanitizedStory = existingUserStory.story;
    sanitizedContext = existingUserStory.additional_context || additional_context;
    linkedUserStoryId = user_story_id;

    // Verify project_id matches if provided
    if (project_id && existingUserStory.project_id !== project_id) {
      throw createError((req as any).t('errors:validation.userStoryNotInProject'), 400, 'VALIDATION_ERROR');
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
  const testCases: TestCase[] = await orchestrator.generateTestCasesWithPageCapture(userStory, prerequisite_steps, quickMode);

  // Persist generated test cases with user_story_id link (scoped to workspace)
  try {
    for (const testCase of testCases) {
      // Create test case with user_story_id if available
      const created = await testCaseRepository.create(testCase, req.workspaceId);

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

  // Deduct credits after successful generation
  if (req.workspaceId) {
    await deductCredits(req.workspaceId, 'TEST_GENERATION', `Generated ${testCases.length} test case(s)`).catch(() => {});
    recordUsageEvent({
      workspaceId: req.workspaceId,
      userId: req.user?.id,
      eventType: 'test_generation',
      quantity: testCases.length,
      metadata: { testCaseCount: testCases.length },
    });
  }

  // Return test cases (validation info is included in each test case's validation_result field if available)
  res.json({
    test_cases: testCases,
    user_story_id: linkedUserStoryId
  });
}));

// Execute a test case (test case already generated) (with stricter rate limiting)
app.post('/api/execute-test', testExecutionRateLimiter, requireActiveSubscription, requireCredits('TEST_EXECUTION'), validate(schemas.executeTest), asyncHandler(async (req, res) => {
  const testCase = req.body;
  const headless = req.query.headless === 'true';

  logger.info('Executing test case', { testCaseId: testCase.id, headless });

  // Ensure test case exists in database before execution
  try {
    const existingTestCase = await testCaseRepository.findById(testCase.id, req.workspaceId);
    if (!existingTestCase) {
      logger.info('Test case not found in database, persisting it first', { testCaseId: testCase.id });
      await testCaseRepository.create(testCase, req.workspaceId);
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

  // Deduct credits after successful execution
  if (req.workspaceId) {
    await deductCredits(req.workspaceId, 'TEST_EXECUTION', `Executed test ${testCase.id}`).catch(() => {});
    recordUsageEvent({
      workspaceId: req.workspaceId,
      userId: req.user?.id,
      eventType: 'test_execution',
      metadata: { testCaseId: testCase.id },
    });
  }

  // Only persist execution result if it's a final status (not "starting")
  // For non-headless mode, the test-executor will persist the final result asynchronously
  // Check if status is "starting" by checking the message field or status string
  const isStartingStatus = (executionResult as any).status === 'starting' || (executionResult as any).message?.includes('Connect to WebSocket');
  if (!isStartingStatus) {
    try {
      await executionRepository.create(executionResult, req.workspaceId);
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

// Metrics endpoint (requires auth — exposes internal operational data)
app.get('/metrics', requireAuth, (req, res) => {
  res.json({
    service: 'gateway',
    timestamp: new Date().toISOString(),
    ...metrics.getSummary()
  });
});

// Get test case by ID
app.get('/api/test-cases/:id', asyncHandler(async (req, res) => {
  const entity = await testCaseRepository.findById(req.params.id, req.workspaceId);
  if (!entity) {
    throw createError((req as any).t('errors:resource.testCaseNotFound'), 404, 'NOT_FOUND');
  }
  const testCase = transformTestCaseEntity(entity);
  res.json(testCase);
}));

// Get execution by ID with step results (scoped to the authenticated workspace)
app.get('/api/executions/:id', asyncHandler(async (req, res) => {
  const execution = await executionRepository.findById(req.params.id, req.workspaceId);
  if (!execution) {
    throw createError((req as any).t('errors:resource.executionNotFound'), 404, 'NOT_FOUND');
  }
  const steps = await executionRepository.findStepResults(req.params.id);
  const transformed = transformExecutionWithSteps(execution, steps);
  res.json(transformed);
}));

// ==================== PROJECT ENDPOINTS ====================

// List all projects
app.get('/api/projects', asyncHandler(async (req, res) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const projects = await projectRepository.listWithStats(offset, limit, req.workspaceId);
  const total = await projectRepository.count(req.workspaceId);
  res.json({ projects, offset, limit, total });
}));

// Create a new project (with plan limit check)
app.post('/api/projects', requireFeatureLimit('max_projects', async (req) => {
  return await projectRepository.count(req.workspaceId);
}), validate(schemas.createProject), asyncHandler(async (req, res) => {
  const { name, description, website_url } = req.body;

  logger.info('Creating project', { name });
  const project = await projectRepository.create({
    name: name.trim(),
    description: description?.trim() || undefined,
    website_url: website_url?.trim() || undefined,
    workspace_id: req.workspaceId
  });

  res.status(201).json({ success: true, project });
}));

// Get project by ID (scoped to workspace)
app.get('/api/projects/:id', asyncHandler(async (req, res) => {
  const project = await projectRepository.findByIdWithStats(req.params.id, req.workspaceId);
  if (!project) {
    throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');
  }
  res.json({ project });
}));

// Update project (verify ownership)
app.put('/api/projects/:id', asyncHandler(async (req, res) => {
  const { name, description, website_url } = req.body;

  // Verify ownership
  const existing = await projectRepository.findByIdForWorkspace(req.params.id, req.workspaceId!);
  if (!existing) {
    throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');
  }

  logger.info('Updating project', { projectId: req.params.id });
  const updated = await projectRepository.update(req.params.id, {
    name: name?.trim(),
    description: description?.trim(),
    website_url: website_url?.trim()
  });

  if (!updated) {
    throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');
  }

  res.json({ success: true, project: updated });
}));

// Delete project (verify ownership)
app.delete('/api/projects/:id', asyncHandler(async (req, res) => {
  logger.info('Deleting project', { projectId: req.params.id });

  const project = await projectRepository.findByIdForWorkspace(req.params.id, req.workspaceId!);
  if (!project) {
    throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');
  }

  await projectRepository.delete(req.params.id);
  res.json({ success: true, message: (req as any).t('success:project.deleted') });
}));

// ==================== PROJECT CONTEXT ENDPOINTS (Feature 9) ====================

// Get project context (verify ownership)
app.get('/api/projects/:id/context', asyncHandler(async (req, res) => {
  const project = await projectRepository.findByIdForWorkspace(req.params.id, req.workspaceId!);
  if (!project) {
    throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');
  }
  res.json({
    context: (project as any).context || {},
    user_prd: (project as any).user_prd || '',
  });
}));

// Update project PRD (verify ownership)
app.put('/api/projects/:id/prd', asyncHandler(async (req, res) => {
  const project = await projectRepository.findByIdForWorkspace(req.params.id, req.workspaceId!);
  if (!project) {
    throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');
  }
  const { user_prd } = req.body;
  await projectRepository.update(req.params.id, { user_prd: user_prd || '' } as any);
  res.json({ success: true });
}));

// Reset project context (verify ownership)
app.delete('/api/projects/:id/context', asyncHandler(async (req, res) => {
  const project = await projectRepository.findByIdForWorkspace(req.params.id, req.workspaceId!);
  if (!project) {
    throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');
  }
  await projectRepository.update(req.params.id, { context: {} } as any);
  res.json({ success: true });
}));

// ==================== USER STORY ENDPOINTS ====================

// List user stories for a project (verify ownership)
app.get('/api/projects/:id/user-stories', asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);

  // Verify project ownership
  const project = await projectRepository.findByIdForWorkspace(projectId, req.workspaceId!);
  if (!project) {
    throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');
  }

  const userStories = await userStoryRepository.findByProjectIdWithStats(projectId, offset, limit);
  const total = await userStoryRepository.countByProjectId(projectId);
  res.json({ user_stories: userStories, offset, limit, total });
}));

// Create user story in a project (verify ownership)
app.post('/api/projects/:id/user-stories', validate(schemas.createUserStory), asyncHandler(async (req, res) => {
  const projectId = req.params.id;
  const { story, website_url, additional_context } = req.body;

  // Verify project ownership
  const project = await projectRepository.findByIdForWorkspace(projectId, req.workspaceId!);
  if (!project) {
    throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');
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
    throw createError((req as any).t('errors:resource.userStoryNotFound'), 404, 'NOT_FOUND');
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
    throw createError((req as any).t('errors:resource.userStoryNotFound'), 404, 'NOT_FOUND');
  }

  res.json({ success: true, user_story: updated });
}));

// Delete user story
app.delete('/api/user-stories/:id', asyncHandler(async (req, res) => {
  logger.info('Deleting user story', { userStoryId: req.params.id });

  const userStory = await userStoryRepository.findById(req.params.id);
  if (!userStory) {
    throw createError((req as any).t('errors:resource.userStoryNotFound'), 404, 'NOT_FOUND');
  }

  await userStoryRepository.delete(req.params.id);
  res.json({ success: true, message: (req as any).t('success:userStory.deleted') });
}));

// Assign user story to folder
app.put('/api/user-stories/:id/folder', asyncHandler(async (req, res) => {
  const { folder_id } = req.body;

  logger.info('Assigning user story to folder', { userStoryId: req.params.id, folderId: folder_id });

  const userStory = await userStoryRepository.findById(req.params.id);
  if (!userStory) {
    throw createError((req as any).t('errors:resource.userStoryNotFound'), 404, 'NOT_FOUND');
  }

  // Verify folder exists if folder_id is provided
  if (folder_id) {
    const folder = await folderRepository.findById(folder_id);
    if (!folder) {
      throw createError((req as any).t('errors:resource.folderNotFound'), 404, 'NOT_FOUND');
    }
  }

  await folderRepository.assignUserStoryToFolder(req.params.id, folder_id || null);
  res.json({ success: true, message: (req as any).t('success:userStory.assignedToFolder') });
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
    throw createError((req as any).t('errors:resource.setupHookNotFound'), 404, 'NOT_FOUND');
  }

  res.json({ hook });
}));

// Create setup hook
app.post('/api/setup-hooks', asyncHandler(async (req, res) => {
  const { name, level, steps, enabled, test_case_id, folder_id } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError((req as any).t('errors:validation.setupHookNameRequired'), 400, 'VALIDATION_ERROR');
  }

  if (!level || !['global', 'suite', 'test_case'].includes(level)) {
    throw createError((req as any).t('errors:validation.levelInvalid'), 400, 'VALIDATION_ERROR');
  }

  if (!Array.isArray(steps)) {
    throw createError((req as any).t('errors:validation.stepsMustBeArray'), 400, 'VALIDATION_ERROR');
  }

  // Validate level-specific constraints
  if (level === 'global' && (test_case_id || folder_id)) {
    throw createError((req as any).t('errors:validation.globalHookNoIds'), 400, 'VALIDATION_ERROR');
  }
  if (level === 'suite' && (!folder_id || test_case_id)) {
    throw createError((req as any).t('errors:validation.suiteHookNeedsFolderId'), 400, 'VALIDATION_ERROR');
  }
  if (level === 'test_case' && (!test_case_id || folder_id)) {
    throw createError((req as any).t('errors:validation.testCaseHookNeedsTestCaseId'), 400, 'VALIDATION_ERROR');
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
    throw createError((req as any).t('errors:resource.setupHookNotFound'), 404, 'NOT_FOUND');
  }

  const updates: any = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw createError((req as any).t('errors:validation.setupHookNameNonEmpty'), 400, 'VALIDATION_ERROR');
    }
    updates.name = name.trim();
  }
  if (steps !== undefined) {
    if (!Array.isArray(steps)) {
      throw createError((req as any).t('errors:validation.stepsMustBeArray'), 400, 'VALIDATION_ERROR');
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
    throw createError((req as any).t('errors:resource.setupHookNotFound'), 404, 'NOT_FOUND');
  }

  await setupHookRepository.delete(id);
  res.json({ success: true, message: (req as any).t('success:setupHook.deleted') });
}));

// Get setup hooks for a test case (includes global, suite, and test_case level)
app.get('/api/test-cases/:testCaseId/setup-hooks', asyncHandler(async (req, res) => {
  const testCaseId = req.params.testCaseId;

  // Verify test case exists within this workspace
  const testCase = await testCaseRepository.findById(testCaseId, req.workspaceId);
  if (!testCase) {
    throw createError((req as any).t('errors:resource.testCaseNotFound'), 404, 'NOT_FOUND');
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

  // Verify project ownership
  const project = await projectRepository.findByIdForWorkspace(projectId, req.workspaceId!);
  if (!project) {
    throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');
  }

  const folders = await folderRepository.listByProjectWithStats(projectId);
  res.json({ folders });
}));

// Create folder in a project
app.post('/api/projects/:projectId/folders', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  const { name, color } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw createError((req as any).t('errors:validation.folderNameRequired'), 400, 'VALIDATION_ERROR');
  }

  logger.info('Creating folder', { projectId, name });

  // Verify project ownership
  const project = await projectRepository.findByIdForWorkspace(projectId, req.workspaceId!);
  if (!project) {
    throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');
  }

  const folder = await folderRepository.create({
    project_id: projectId,
    name: name.trim(),
    color: color || '#0284c7'
  });

  res.status(201).json({ success: true, folder });
}));

// Get folder by ID
app.get('/api/folders/:id', asyncHandler(async (req, res) => {
  const folder = await folderRepository.findById(req.params.id);

  if (!folder) {
    throw createError((req as any).t('errors:resource.folderNotFound'), 404, 'NOT_FOUND');
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
      throw createError((req as any).t('errors:validation.folderNameNonEmpty'), 400, 'VALIDATION_ERROR');
    }
    updates.name = name.trim();
  }
  if (color !== undefined) {
    updates.color = color;
  }

  const folder = await folderRepository.update(req.params.id, updates);

  if (!folder) {
    throw createError((req as any).t('errors:resource.folderNotFound'), 404, 'NOT_FOUND');
  }

  res.json({ success: true, folder });
}));

// Delete folder
app.delete('/api/folders/:id', asyncHandler(async (req, res) => {
  logger.info('Deleting folder', { folderId: req.params.id });

  const folder = await folderRepository.findById(req.params.id);
  if (!folder) {
    throw createError((req as any).t('errors:resource.folderNotFound'), 404, 'NOT_FOUND');
  }

  await folderRepository.delete(req.params.id);
  res.json({ success: true, message: (req as any).t('success:folder.deleted') });
}));

// ==================== TEST CASE ENDPOINTS ====================

// List test cases (scoped to the authenticated workspace)
app.get('/api/test-cases', asyncHandler(async (req, res) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const entities = await testCaseRepository.list(offset, limit, req.workspaceId);
  const testCases = entities.map(transformTestCaseEntity);
  res.json({ test_cases: testCases, offset, limit });
}));

// List executions (scoped to the authenticated workspace)
app.get('/api/executions', asyncHandler(async (req, res) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  const filters = {
    status: status as 'completed' | 'failed' | 'running' | 'timeout' | 'paused' | undefined,
    search,
    workspaceId: req.workspaceId
  };

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

// Update test case (verify workspace ownership first)
app.put('/api/test-cases/:id', validate(schemas.executeTest), asyncHandler(async (req, res) => {
  const id = req.params.id;
  const updates = req.body;

  // Verify the test case belongs to this workspace before mutating
  const existing = await testCaseRepository.findById(id, req.workspaceId);
  if (!existing) {
    throw createError((req as any).t('errors:resource.testCaseNotFound'), 404, 'NOT_FOUND');
  }

  logger.info('Updating test case', { testCaseId: id });
  const updated = await testCaseRepository.update(id, updates);
  if (!updated) {
    throw createError((req as any).t('errors:resource.testCaseNotFound'), 404, 'NOT_FOUND');
  }

  const testCase = transformTestCaseEntity(updated);
  res.json({ success: true, test_case: testCase });
}));

// Delete test case (verify workspace ownership first)
app.delete('/api/test-cases/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;

  // Verify the test case belongs to this workspace before deleting
  const existing = await testCaseRepository.findById(id, req.workspaceId);
  if (!existing) {
    throw createError((req as any).t('errors:resource.testCaseNotFound'), 404, 'NOT_FOUND');
  }

  logger.info('Deleting test case', { testCaseId: id });
  const deleted = await testCaseRepository.delete(id);
  if (!deleted) {
    throw createError((req as any).t('errors:resource.testCaseNotFound'), 404, 'NOT_FOUND');
  }

  res.json({ success: true, message: (req as any).t('success:testCase.deleted') });
}));

// Get flow data for visualization
app.get('/api/flow-data', asyncHandler(async (req, res) => {
  logger.info('Fetching flow data for visualization');

  try {
    // ── Batch fetch everything in 5 queries instead of N*M queries (4.5) ──────

    // 1. All projects (scoped to workspace)
    const projects = await query<any>(`
      SELECT id, name, description, website_url, created_at, updated_at
      FROM projects
      WHERE workspace_id = $1
      ORDER BY created_at DESC
    `, [req.workspaceId]);

    const flowData: any[] = [];

    if (projects.length > 0) {
      const projectIds = projects.map((p: any) => p.id);

      // 2. All folders for all projects in one query
      const allFolders = await query<any>(`
        SELECT id, project_id, name, color, created_at, updated_at
        FROM user_story_folders
        WHERE project_id = ANY($1)
        ORDER BY name ASC
      `, [projectIds]);

      // 3. All user stories for all projects in one query
      const allUserStories = await query<any>(`
        SELECT id, project_id, story, website_url, additional_context, folder_id, created_at, updated_at
        FROM user_stories
        WHERE project_id = ANY($1)
        ORDER BY created_at DESC
      `, [projectIds]);

      const userStoryIds = allUserStories.map((s: any) => s.id);

      // 4 & 5. All test suites + their test cases in two queries
      const allTestSuites = userStoryIds.length > 0 ? await query<any>(`
        SELECT id, user_story_id, name, description, created_at, updated_at
        FROM test_suites
        WHERE user_story_id = ANY($1)
        ORDER BY created_at DESC
      `, [userStoryIds]) : [];

      const testSuiteIds = allTestSuites.map((ts: any) => ts.id);

      const allTestCaseRows = (testSuiteIds.length > 0 || userStoryIds.length > 0) ? await query<any>(`
        SELECT id, name, description, website_url, user_story, steps, metadata,
               test_suite_id, user_story_id, created_at, updated_at
        FROM test_cases
        WHERE test_suite_id = ANY($1::uuid[]) OR (user_story_id = ANY($2::uuid[]) AND test_suite_id IS NULL)
        ORDER BY created_at DESC
      `, [testSuiteIds.length ? testSuiteIds : [], userStoryIds.length ? userStoryIds : []]) : [];

      // 6. Orphan test cases (backward compatibility — per-project website_url filter)
      const projectWebsiteUrls = projects.map((p: any) => p.website_url).filter(Boolean);
      const allOrphanTestCases = projectWebsiteUrls.length > 0 ? await query<any>(`
        SELECT id, name, description, website_url, user_story, steps, metadata, created_at, updated_at
        FROM test_cases
        WHERE user_story_id IS NULL
          AND user_story IS NOT NULL
          AND user_story != ''
          AND website_url = ANY($1)
        ORDER BY created_at DESC
      `, [projectWebsiteUrls]) : [];

      // ── Build in-memory maps for O(1) grouping ────────────────────────────

      // folders by project_id
      const foldersByProject = new Map<string, any[]>();
      for (const f of allFolders) {
        if (!foldersByProject.has(f.project_id)) foldersByProject.set(f.project_id, []);
        foldersByProject.get(f.project_id)!.push(f);
      }

      // user stories by project_id
      const storiesByProject = new Map<string, any[]>();
      for (const s of allUserStories) {
        if (!storiesByProject.has(s.project_id)) storiesByProject.set(s.project_id, []);
        storiesByProject.get(s.project_id)!.push(s);
      }

      // test suites by user_story_id
      const suitesByStory = new Map<string, any[]>();
      for (const ts of allTestSuites) {
        if (!suitesByStory.has(ts.user_story_id)) suitesByStory.set(ts.user_story_id, []);
        suitesByStory.get(ts.user_story_id)!.push(ts);
      }

      // test cases by test_suite_id and by user_story_id (direct, no suite)
      const casesBySuite = new Map<string, any[]>();
      const directCasesByStory = new Map<string, any[]>();
      for (const tc of allTestCaseRows) {
        if (tc.test_suite_id) {
          if (!casesBySuite.has(tc.test_suite_id)) casesBySuite.set(tc.test_suite_id, []);
          casesBySuite.get(tc.test_suite_id)!.push(tc);
        } else if (tc.user_story_id) {
          if (!directCasesByStory.has(tc.user_story_id)) directCasesByStory.set(tc.user_story_id, []);
          directCasesByStory.get(tc.user_story_id)!.push(tc);
        }
      }

      // orphan test cases by website_url
      const orphansByUrl = new Map<string, any[]>();
      for (const tc of allOrphanTestCases) {
        const url = tc.website_url || '';
        if (!orphansByUrl.has(url)) orphansByUrl.set(url, []);
        orphansByUrl.get(url)!.push(tc);
      }

      // Helper to map a raw tc row → { test_case, steps }
      const formatTc = (tc: any) => {
        const steps = typeof tc.steps === 'string' ? JSON.parse(tc.steps) : tc.steps;
        const metadata = typeof tc.metadata === 'string' ? JSON.parse(tc.metadata) : (tc.metadata || {});
        return {
          test_case: transformTestCaseEntity({
            id: tc.id, name: tc.name, description: tc.description || '',
            website_url: tc.website_url, user_story: tc.user_story,
            steps, metadata, workspace_id: tc.workspace_id || null,
            created_at: tc.created_at, updated_at: tc.updated_at
          }),
          steps: steps || []
        };
      };

      // ── Assemble response ─────────────────────────────────────────────────

      for (const project of projects) {
        const folders = foldersByProject.get(project.id) || [];
        const userStories = storiesByProject.get(project.id) || [];
        const projectUserStories: any[] = [];

        for (const userStory of userStories) {
          const suites = suitesByStory.get(userStory.id) || [];
          const userStoryTestSuites = suites.map((ts: any) => ({
            test_suite: ts,
            test_cases: (casesBySuite.get(ts.id) || []).map(formatTc)
          }));

          const directTestCases = (directCasesByStory.get(userStory.id) || []).map(formatTc);

          projectUserStories.push({
            user_story: userStory,
            test_suites: userStoryTestSuites,
            test_cases: directTestCases
          });
        }

        // Orphan test cases for this project's website_url
        const projectOrphans = project.website_url ? (orphansByUrl.get(project.website_url) || []) : [];
        const groupedByStory: Record<string, any[]> = {};
        for (const tc of projectOrphans) {
          const key = tc.user_story;
          if (!groupedByStory[key]) groupedByStory[key] = [];
          groupedByStory[key].push(tc);
        }
        for (const [storyText, tcs] of Object.entries(groupedByStory)) {
          projectUserStories.push({
            user_story: {
              id: `orphan-${project.id}-${storyText.substring(0, 50)}`,
              project_id: project.id,
              story: storyText,
              website_url: tcs[0].website_url,
              additional_context: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            test_suites: [],
            test_cases: tcs.map(formatTc)
          });
        }

        flowData.push({ project, folders, user_stories: projectUserStories });
      }
    }

    // If no projects exist, build from test cases directly (backward compatibility)
    if (flowData.length === 0) {
      const allTestCases = await query<any>(`
        SELECT id, name, description, website_url, user_story, steps, metadata, created_at, updated_at
        FROM test_cases
        WHERE user_story IS NOT NULL AND user_story != ''
        ORDER BY website_url, user_story, created_at DESC
      `);

      if (allTestCases.length > 0) {
        const grouped: Record<string, Record<string, any[]>> = {};
        for (const tc of allTestCases) {
          const url = tc.website_url || 'default';
          const story = tc.user_story;
          if (!grouped[url]) grouped[url] = {};
          if (!grouped[url][story]) grouped[url][story] = [];
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
            const steps0 = typeof testCases[0].steps === 'string' ? JSON.parse(testCases[0].steps) : testCases[0].steps;
            projectUserStories.push({
              user_story: {
                id: `orphan-${defaultProject.id}-${storyText.substring(0, 50)}`,
                project_id: defaultProject.id,
                story: storyText,
                website_url: websiteUrl !== 'default' ? websiteUrl : null,
                additional_context: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              test_suites: [],
              test_cases: testCases.map((tc: any) => {
                const steps = typeof tc.steps === 'string' ? JSON.parse(tc.steps) : tc.steps;
                const metadata = typeof tc.metadata === 'string' ? JSON.parse(tc.metadata) : (tc.metadata || {});
                return {
                  test_case: transformTestCaseEntity({
                    id: tc.id, name: tc.name, description: tc.description || '',
                    website_url: tc.website_url, user_story: tc.user_story,
                    steps, metadata, workspace_id: tc.workspace_id || null,
                    created_at: tc.created_at, updated_at: tc.updated_at
                  }),
                  steps: steps || []
                };
              })
            });
          }

          flowData.push({ project: defaultProject, user_stories: projectUserStories });
        }
      }
    }

    res.json({ projects: flowData });
  } catch (error: any) {
    logger.error('Error fetching flow data', error);
    throw createError((req as any).t('errors:business.fetchFlowFailed'), 500, 'INTERNAL_ERROR');
  }
}));

// ==================== PROJECT TEST CASES BY CATEGORY ====================

// Get test cases grouped by feature category for a project
app.get('/api/projects/:projectId/test-cases-by-category', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;

  // Verify project ownership
  const project = await projectRepository.findByIdForWorkspace(projectId, req.workspaceId!);
  if (!project) {
    throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');
  }

  // Get all test cases for this project (from test_cases table linked via test_suite → user_story → project)
  const testCases = await query<any>(`
    SELECT tc.id, tc.name, tc.description, tc.steps, tc.metadata, tc.playwright_code,
           COALESCE(tc.feature_category, 'General') as feature_category,
           COALESCE(tc.requires_auth, false) as requires_auth,
           tc.created_at, tc.updated_at,
           COALESCE(e.status, qlr.run_status) as last_run_status,
           COALESCE(e.total_duration_ms, qlr.run_duration_ms) as last_run_duration,
           COALESCE(e.completed_at, qlr.run_completed_at) as last_run_at,
           COALESCE(e.error, qlr.run_failure_reason) as last_run_error,
           q.observed_result
    FROM test_cases tc
    LEFT JOIN LATERAL (
      SELECT status, total_duration_ms, completed_at, error
      FROM executions
      WHERE test_case_id = tc.id
      ORDER BY started_at DESC
      LIMIT 1
    ) e ON true
    LEFT JOIN qa_loop_test_cases q ON q.standard_test_case_id = tc.id
    LEFT JOIN LATERAL (
      SELECT r.status as run_status, r.duration_ms as run_duration_ms, r.executed_at as run_completed_at, r.failure_reason as run_failure_reason
      FROM qa_loop_test_runs r
      WHERE r.test_case_id = q.id
      ORDER BY r.executed_at DESC
      LIMIT 1
    ) qlr ON true
    WHERE (
      tc.user_story_id IN (
        SELECT us.id FROM user_stories us WHERE us.project_id = $1
      )
      OR tc.test_suite_id IN (
        SELECT ts.id FROM test_suites ts WHERE ts.project_id = $1
      )
    )
    ORDER BY tc.feature_category, tc.name
  `, [projectId]);

  // Also get QA loop test cases directly linked to this project's sessions
  const qaTestCases = await query<any>(`
    SELECT q.id, q.name, q.description, q.steps, q.playwright_code,
           COALESCE(q.feature_category, 'General') as feature_category,
           COALESCE(q.requires_auth, false) as requires_auth,
           q.last_run_status, q.observed_result,
           q.created_at, q.updated_at,
           q.standard_test_case_id
    FROM qa_loop_test_cases q
    JOIN qa_loop_sessions s ON q.session_id = s.id
    WHERE s.project_id = $1
    AND q.standard_test_case_id IS NULL
    ORDER BY q.feature_category, q.name
  `, [projectId]);

  // Get bugs linked to this project
  const bugs = await query<any>(`
    SELECT b.id, b.title, b.description, b.severity, b.category, b.page_url,
           b.verification_status, b.regression_test_id, b.discovered_by_test_case_id,
           b.created_at, b.evidence_screenshots
    FROM qa_loop_bugs b
    JOIN qa_loop_sessions s ON b.session_id = s.id
    WHERE s.project_id = $1
    ORDER BY b.created_at DESC
  `, [projectId]);

  // Get scan history
  const scanHistory = await query<any>(`
    SELECT id, target_url, status, pages_explored, tests_generated, bugs_found,
           quality_score, created_at, completed_at
    FROM qa_loop_sessions
    WHERE project_id = $1
    ORDER BY created_at DESC
    LIMIT 20
  `, [projectId]);

  // Combine test cases and group by category
  const allTests = [
    ...testCases.map((tc: any) => ({
      ...tc,
      source: 'test_cases',
      steps: typeof tc.steps === 'string' ? JSON.parse(tc.steps) : tc.steps,
      metadata: typeof tc.metadata === 'string' ? JSON.parse(tc.metadata) : (tc.metadata || {}),
    })),
    ...qaTestCases.map((tc: any) => ({
      ...tc,
      source: 'qa_loop',
      steps: typeof tc.steps === 'string' ? JSON.parse(tc.steps) : tc.steps,
    })),
  ];

  // Infer category from test name when feature_category is null or 'General'
  function inferCategory(name: string, featureCategory: string | null): string {
    if (featureCategory && featureCategory !== 'General') return featureCategory;
    const n = name.toLowerCase();
    if (n.startsWith('login') || n.includes('auth') || n.includes('credentials') || n.includes('password') || n.includes('forgot password') || n.includes('reset password')) return 'Authentication';
    if (n.startsWith('dashboard') || n.includes('dashboard')) return 'Dashboard';
    if (n.startsWith('nav') || n.includes('navigation') || n.includes('menu')) return 'Navigation';
    if (n.startsWith('search') || n.includes('search')) return 'Search';
    if (n.startsWith('setting') || n.includes('settings') || n.includes('profile')) return 'Settings';
    if (n.startsWith('checkout') || n.includes('cart') || n.includes('payment')) return 'Checkout';
    if (n.startsWith('form') || n.includes('form') || n.includes('input') || n.includes('validation')) return 'Forms';
    return featureCategory || 'General';
  }

  // Group by feature_category
  const categoryMap: Record<string, { testCases: any[]; stats: { passed: number; failed: number; review: number; skipped: number } }> = {};
  for (const tc of allTests) {
    const cat = inferCategory(tc.name, tc.feature_category);
    if (!categoryMap[cat]) {
      categoryMap[cat] = { testCases: [], stats: { passed: 0, failed: 0, review: 0, skipped: 0 } };
    }
    categoryMap[cat].testCases.push(tc);

    const status = tc.last_run_status || tc.observed_result || 'review';
    if (status === 'completed' || status === 'pass' || status === 'passed' || status === 'confirmed') categoryMap[cat].stats.passed++;
    else if (status === 'failed' || status === 'fail' || status === 'error') categoryMap[cat].stats.failed++;
    else if (status === 'skipped') categoryMap[cat].stats.skipped++;
    else if (status === 'mismatch') categoryMap[cat].stats.review++;
    else categoryMap[cat].stats.review++;
  }

  const categories = Object.entries(categoryMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ categories, bugs, scanHistory });
}));

// Run all tests for a project
app.post('/api/projects/:projectId/run-all-tests', asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  const project = await projectRepository.findByIdForWorkspace(projectId, req.workspaceId!);
  if (!project) throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');

  // Fetch all test cases for this project
  const testCases = await query<any>(`
    SELECT tc.id, tc.name, tc.playwright_code, tc.steps, tc.requires_auth
    FROM test_cases tc
    WHERE tc.user_story_id IN (SELECT us.id FROM user_stories us WHERE us.project_id = $1)
    ORDER BY tc.name
  `, [projectId]);

  if (testCases.length === 0) {
    return res.json({ success: true, results: [], message: (req as any).t('success:testCase.noTestCases') });
  }

  // Queue execution through the test executor service
  const testExecutorUrl = env.TEST_EXECUTOR_URL;
  const results: any[] = [];

  for (const tc of testCases) {
    try {
      if (tc.playwright_code) {
        const response = await fetch(`${testExecutorUrl}/api/run-playwright`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playwrightCode: tc.playwright_code, timeoutMs: 30000 }),
        });
        const data: any = await response.json();
        results.push({ testCaseId: tc.id, name: tc.name, status: data.passed ? 'passed' : 'failed', error: data.error });
      } else {
        const steps = typeof tc.steps === 'string' ? JSON.parse(tc.steps) : tc.steps;
        const response = await fetch(`${testExecutorUrl}/api/execute-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testCase: { id: tc.id, name: tc.name, steps }, headless: true }),
        });
        const data: any = await response.json();
        results.push({ testCaseId: tc.id, name: tc.name, status: data.status === 'completed' && data.allStepsPassed ? 'passed' : 'failed', error: data.error });
      }
    } catch (err: any) {
      results.push({ testCaseId: tc.id, name: tc.name, status: 'error', error: err.message });
    }
  }

  res.json({ success: true, results });
}));

// Run tests for a specific category in a project
app.post('/api/projects/:projectId/run-category/:category', asyncHandler(async (req, res) => {
  const { projectId, category } = req.params;
  const project = await projectRepository.findByIdForWorkspace(projectId, req.workspaceId!);
  if (!project) throw createError((req as any).t('errors:resource.projectNotFound'), 404, 'NOT_FOUND');

  const testCases = await query<any>(`
    SELECT tc.id, tc.name, tc.playwright_code, tc.steps, tc.requires_auth
    FROM test_cases tc
    WHERE tc.user_story_id IN (SELECT us.id FROM user_stories us WHERE us.project_id = $1)
    AND COALESCE(tc.feature_category, 'General') = $2
    ORDER BY tc.name
  `, [projectId, category]);

  if (testCases.length === 0) {
    return res.json({ success: true, results: [], message: (req as any).t('success:testCase.noCategoryTests') });
  }

  const testExecutorUrl = env.TEST_EXECUTOR_URL;
  const results: any[] = [];

  for (const tc of testCases) {
    try {
      if (tc.playwright_code) {
        const response = await fetch(`${testExecutorUrl}/api/run-playwright`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playwrightCode: tc.playwright_code, timeoutMs: 30000 }),
        });
        const data: any = await response.json();
        results.push({ testCaseId: tc.id, name: tc.name, status: data.passed ? 'passed' : 'failed', error: data.error });
      } else {
        const steps = typeof tc.steps === 'string' ? JSON.parse(tc.steps) : tc.steps;
        const response = await fetch(`${testExecutorUrl}/api/execute-test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testCase: { id: tc.id, name: tc.name, steps }, headless: true }),
        });
        const data: any = await response.json();
        results.push({ testCaseId: tc.id, name: tc.name, status: data.status === 'completed' && data.allStepsPassed ? 'passed' : 'failed', error: data.error });
      }
    } catch (err: any) {
      results.push({ testCaseId: tc.id, name: tc.name, status: 'error', error: err.message });
    }
  }

  res.json({ success: true, results });
}));

// ==================== VISUAL REGRESSION ENDPOINTS ====================

// Get baselines for a test case
app.get('/api/test-cases/:id/baselines', asyncHandler(async (req, res) => {
  const testCaseId = req.params.id;

  // Verify test case exists within this workspace
  const testCase = await testCaseRepository.findById(testCaseId, req.workspaceId);
  if (!testCase) {
    throw createError((req as any).t('errors:resource.testCaseNotFound'), 404, 'NOT_FOUND');
  }

  const baselines = await visualRegressionRepository.getBaselinesByTestCase(testCaseId);
  res.json({ baselines });
}));

// Get baseline history for a test case and step
app.get('/api/test-cases/:testCaseId/baselines/:stepId', asyncHandler(async (req, res) => {
  const testCaseId = req.params.testCaseId;
  const stepId = req.params.stepId;

  // Verify test case exists within this workspace
  const testCase = await testCaseRepository.findById(testCaseId, req.workspaceId);
  if (!testCase) {
    throw createError((req as any).t('errors:resource.testCaseNotFound'), 404, 'NOT_FOUND');
  }

  const baselines = await visualRegressionRepository.getBaselineHistory(testCaseId, stepId);
  res.json({ baselines });
}));

// Create/update baseline (manual)
app.post('/api/test-cases/:testCaseId/baselines', asyncHandler(async (req, res) => {
  const testCaseId = req.params.testCaseId;
  const { step_id, screenshot_path, execution_id } = req.body;

  if (!step_id || !screenshot_path) {
    throw createError((req as any).t('errors:validation.stepIdAndScreenshotRequired'), 400, 'VALIDATION_ERROR');
  }

  // Verify test case exists within this workspace
  const testCase = await testCaseRepository.findById(testCaseId, req.workspaceId);
  if (!testCase) {
    throw createError((req as any).t('errors:resource.testCaseNotFound'), 404, 'NOT_FOUND');
  }

  // Calculate screenshot hash
  const fs = require('fs');
  const crypto = require('crypto');
  if (!fs.existsSync(screenshot_path)) {
    throw createError((req as any).t('errors:resource.screenshotNotFound'), 404, 'NOT_FOUND');
  }
  const screenshotBuffer = fs.readFileSync(screenshot_path);
  const screenshotHash = crypto.createHash('sha256').update(screenshotBuffer).digest('hex');

  // Create baseline (non-critical — wrap in try/catch)
  try {
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
  } catch (baselineErr: any) {
    logger.warn('Failed to create visual baseline (non-critical)', { error: baselineErr.message });
    res.status(201).json({ success: true, baseline: null, warning: (req as any).t('errors:service.baselineNonCritical') });
  }
}));

// Lock/unlock baseline
app.put('/api/test-cases/:testCaseId/baselines/:baselineId/lock', asyncHandler(async (req, res) => {
  const baselineId = req.params.baselineId;
  const { is_locked } = req.body;

  if (typeof is_locked !== 'boolean') {
    throw createError((req as any).t('errors:validation.isLockedMustBeBoolean'), 400, 'VALIDATION_ERROR');
  }

  const success = await visualRegressionRepository.setBaselineLock(baselineId, is_locked);
  if (!success) {
    throw createError((req as any).t('errors:resource.baselineNotFound'), 404, 'NOT_FOUND');
  }

  res.json({ success: true, message: (req as any).t(is_locked ? 'success:baseline.locked' : 'success:baseline.unlocked') });
}));

// Get visual comparisons for an execution
app.get('/api/executions/:id/visual-comparisons', asyncHandler(async (req, res) => {
  const executionId = req.params.id;

  // Verify execution exists within this workspace
  const execution = await executionRepository.findById(executionId, req.workspaceId);
  if (!execution) {
    throw createError((req as any).t('errors:resource.executionNotFound'), 404, 'NOT_FOUND');
  }

  const comparisons = await visualRegressionRepository.getComparisonsByExecution(executionId);
  res.json({ comparisons });
}));

// Get all visual regressions (filtered, paginated) — requires feature
app.get('/api/visual-regressions', requireFeature('visual_regression'), asyncHandler(async (req, res) => {
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
    throw createError((req as any).t('errors:validation.ignoredMustBeBoolean'), 400, 'VALIDATION_ERROR');
  }

  const comparison = await visualRegressionRepository.updateComparison(comparisonId, { ignored });
  if (!comparison) {
    throw createError((req as any).t('errors:resource.visualComparisonNotFound'), 404, 'NOT_FOUND');
  }

  res.json({ success: true, comparison });
}));

// ==================== DASHBOARD STATS API ====================

app.get('/api/dashboard/stats', requireAuth, asyncHandler(async (req, res) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: (req as any).t('errors:validation.workspaceRequired') });

  // Run all queries in parallel for speed
  const [testCaseRows, executionRows, qaSessionRows, bugRows, recentSessionRows] = await Promise.all([
    // Total test cases
    query('SELECT COUNT(*) as count FROM test_cases WHERE workspace_id = $1', [workspaceId]),
    // Execution stats (success rate)
    query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM executions WHERE workspace_id = $1`,
      [workspaceId]
    ),
    // QA Loop sessions count
    query('SELECT COUNT(*) as count FROM qa_loop_sessions WHERE workspace_id = $1', [workspaceId]),
    // Bugs found
    query(
      `SELECT COUNT(*) as count FROM qa_loop_bugs b
       JOIN qa_loop_sessions s ON b.session_id = s.id
       WHERE s.workspace_id = $1`,
      [workspaceId]
    ),
    // Recent QA Loop sessions (last 5)
    query(
      `SELECT id, target_url, status, quality_score, tests_generated, bugs_found, pages_explored, created_at, completed_at
       FROM qa_loop_sessions
       WHERE workspace_id = $1
       ORDER BY created_at DESC LIMIT 5`,
      [workspaceId]
    ),
  ]);

  const totalExecutions = parseInt(executionRows[0]?.total || '0');
  const completedExecutions = parseInt(executionRows[0]?.completed || '0');

  res.json({
    totalTestCases: parseInt(testCaseRows[0]?.count || '0'),
    totalQASessions: parseInt(qaSessionRows[0]?.count || '0'),
    totalBugsFound: parseInt(bugRows[0]?.count || '0'),
    successRate: totalExecutions > 0 ? Math.round((completedExecutions / totalExecutions) * 100) : 0,
    totalExecutions,
    recentSessions: recentSessionRows,
  });
}));

// ==================== ENVIRONMENTS API ====================

app.get('/api/environments', requireAuth, asyncHandler(async (req, res) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: (req as any).t('errors:validation.workspaceRequired') });

  const rows = await query(
    'SELECT * FROM saved_environments WHERE workspace_id = $1 ORDER BY name ASC',
    [workspaceId]
  );
  res.json({ environments: rows });
}));

app.post('/api/environments', requireAuth, asyncHandler(async (req, res) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: (req as any).t('errors:validation.workspaceRequired') });

  const { name, url, description } = req.body;
  if (!name || !url) return res.status(400).json({ error: (req as any).t('errors:validation.nameAndUrlRequired') });

  const rows = await query(
    'INSERT INTO saved_environments (workspace_id, name, url, description) VALUES ($1, $2, $3, $4) RETURNING *',
    [workspaceId, name, url, description || null]
  );
  res.status(201).json({ success: true, environment: rows[0] });
}));

app.put('/api/environments/:id', requireAuth, asyncHandler(async (req, res) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: (req as any).t('errors:validation.workspaceRequired') });

  const { id } = req.params;
  const { name, url, description } = req.body;

  const rows = await query(
    `UPDATE saved_environments SET
       name = COALESCE($1, name),
       url = COALESCE($2, url),
       description = COALESCE($3, description)
     WHERE id = $4 AND workspace_id = $5
     RETURNING *`,
    [name, url, description, id, workspaceId]
  );

  if (rows.length === 0) return res.status(404).json({ error: (req as any).t('errors:resource.environmentNotFound') });
  res.json({ success: true, environment: rows[0] });
}));

app.delete('/api/environments/:id', requireAuth, asyncHandler(async (req, res) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: (req as any).t('errors:validation.workspaceRequired') });

  const { id } = req.params;
  const rows = await query(
    'DELETE FROM saved_environments WHERE id = $1 AND workspace_id = $2 RETURNING id',
    [id, workspaceId]
  );

  if (rows.length === 0) return res.status(404).json({ error: (req as any).t('errors:resource.environmentNotFound') });
  res.json({ success: true });
}));

// ==================== QA LOOP ENDPOINTS ====================
// All routes are in a dedicated router for cleaner separation (5.2).

import { qaLoopRouter } from './qa-loop-router';
app.use('/api/qa-loop', qaLoopRouter);

// All QA Loop helpers, circuit-breaker, and 18 route handlers have been
// moved into gateway/src/api/qa-loop-router.ts (5.2 + 5.3).

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'WhyNot Gateway',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      run_test: 'POST /api/run-test',
      generate_tests: 'POST /api/generate-tests',
      execute_test: 'POST /api/execute-test',
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

// ── Integration Routes (Phase 3) ──────────────────────────────────────────────

import { IntegrationService } from '../services/integration-service';
const integrationService = new IntegrationService();

// List integrations for a workspace
app.get('/api/integrations', requireAuth, asyncHandler(async (req: any, res) => {
  const workspaceId = req.query.workspace_id as string;
  if (!workspaceId) {
    return res.status(400).json({ error: (req as any).t('errors:validation.workspaceIdRequired') });
  }
  const integrations = await integrationService.getIntegrations(workspaceId);
  // Strip sensitive config fields from response
  const safe = integrations.map(i => ({
    ...i,
    config: {
      ...i.config,
      apiToken: i.config.apiToken ? '••••' + String(i.config.apiToken).slice(-4) : undefined,
      apiKey: i.config.apiKey ? '••••' + String(i.config.apiKey).slice(-4) : undefined,
    }
  }));
  res.json(safe);
}));

// Create a new integration
app.post('/api/integrations', requireAuth, asyncHandler(async (req: any, res) => {
  const { workspace_id, type, name, config } = req.body;
  if (!workspace_id || !type || !name || !config) {
    return res.status(400).json({ error: (req as any).t('errors:validation.integrationFieldsRequired') });
  }
  if (!['jira', 'clickup', 'linear'].includes(type)) {
    return res.status(400).json({ error: (req as any).t('errors:validation.integrationTypeInvalid') });
  }
  const integration = await integrationService.createIntegration({ workspace_id, type, name, config });
  res.status(201).json(integration);
}));

// Test integration connection
app.post('/api/integrations/:id/test', requireAuth, asyncHandler(async (req: any, res) => {
  const integration = await integrationService.getIntegration(req.params.id);
  if (!integration) {
    return res.status(404).json({ error: (req as any).t('errors:resource.integrationNotFound') });
  }
  const result = await integrationService.testConnection(integration);
  res.json(result);
}));

// Update integration
app.patch('/api/integrations/:id', requireAuth, asyncHandler(async (req: any, res) => {
  const updated = await integrationService.updateIntegration(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: (req as any).t('errors:resource.integrationNotFound') });
  }
  res.json(updated);
}));

// Delete integration
app.delete('/api/integrations/:id', requireAuth, asyncHandler(async (req: any, res) => {
  const deleted = await integrationService.deleteIntegration(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: (req as any).t('errors:resource.integrationNotFound') });
  }
  res.json({ success: true });
}));

// Create task from bug
app.post('/api/bugs/:bugId/create-task', requireAuth, asyncHandler(async (req: any, res) => {
  const { bugId } = req.params;
  const { integration_id, priority, labels } = req.body;
  if (!integration_id) {
    return res.status(400).json({ error: (req as any).t('errors:validation.integrationIdRequired') });
  }
  try {
    const task = await integrationService.createTaskFromBug(bugId, integration_id, { priority, labels });
    res.status(201).json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}));

// Get tasks linked to a bug
app.get('/api/bugs/:bugId/tasks', requireAuth, asyncHandler(async (req: any, res) => {
  const tasks = await integrationService.getBugTasks(req.params.bugId);
  res.json(tasks);
}));

// ── Auto-Fix Routes (Phase 4) ─────────────────────────────────────────────────

import { AutoFixService } from '../services/auto-fix-service';
const autoFixService = new AutoFixService();

// List GitHub repos for workspace
app.get('/api/github-repos', requireAuth, asyncHandler(async (req: any, res) => {
  if (!autoFixService) return res.status(503).json({ error: (req as any).t('errors:service.autoFixUnavailable') });
  const workspaceId = req.query.workspace_id as string;
  if (!workspaceId) return res.status(400).json({ error: (req as any).t('errors:validation.workspaceIdBodyRequired') });
  const repos = await autoFixService.getRepos(workspaceId);
  // Strip access tokens from response
  const safe = repos.map(r => ({ ...r, access_token: r.access_token ? '••••' : null }));
  res.json(safe);
}));

// Connect a GitHub repo
app.post('/api/github-repos', requireAuth, asyncHandler(async (req: any, res) => {
  if (!autoFixService) return res.status(503).json({ error: (req as any).t('errors:service.autoFixUnavailable') });
  const { workspace_id, owner, repo, default_branch, access_token } = req.body;
  if (!workspace_id || !owner || !repo || !access_token) {
    return res.status(400).json({ error: (req as any).t('errors:validation.githubRepoFieldsRequired') });
  }
  const result = await autoFixService.createRepo({ workspace_id, owner, repo, default_branch, access_token });
  res.status(201).json({ ...result, access_token: '••••' });
}));

// Test GitHub repo connection
app.post('/api/github-repos/:id/test', requireAuth, asyncHandler(async (req: any, res) => {
  if (!autoFixService) return res.status(503).json({ error: (req as any).t('errors:service.autoFixUnavailable') });
  const result = await autoFixService.testRepoConnection(req.params.id);
  res.json(result);
}));

// Delete GitHub repo
app.delete('/api/github-repos/:id', requireAuth, asyncHandler(async (req: any, res) => {
  if (!autoFixService) return res.status(503).json({ error: (req as any).t('errors:service.autoFixUnavailable') });
  const deleted = await autoFixService.deleteRepo(req.params.id);
  if (!deleted) return res.status(404).json({ error: (req as any).t('errors:resource.repoNotFound') });
  res.json({ success: true });
}));

// Start auto-fix for a bug (async)
app.post('/api/bugs/:bugId/auto-fix', requireAuth, asyncHandler(async (req: any, res) => {
  if (!autoFixService) return res.status(503).json({ error: (req as any).t('errors:service.autoFixUnavailable') });
  const { bugId } = req.params;
  const { github_repo_id } = req.body;
  if (!github_repo_id) return res.status(400).json({ error: (req as any).t('errors:validation.githubRepoIdRequired') });
  const attempt = await autoFixService.startAutoFix(bugId, github_repo_id);
  res.status(202).json(attempt);
}));

// Get auto-fix attempt status
app.get('/api/auto-fix/:attemptId', requireAuth, asyncHandler(async (req: any, res) => {
  if (!autoFixService) return res.status(503).json({ error: (req as any).t('errors:service.autoFixUnavailable') });
  const attempt = await autoFixService.getAttempt(req.params.attemptId);
  if (!attempt) return res.status(404).json({ error: (req as any).t('errors:resource.attemptNotFound') });
  res.json(attempt);
}));

// Get all auto-fix attempts for a bug
app.get('/api/bugs/:bugId/auto-fix', requireAuth, asyncHandler(async (req: any, res) => {
  if (!autoFixService) return res.status(503).json({ error: (req as any).t('errors:service.autoFixUnavailable') });
  const attempts = await autoFixService.getAttemptsForBug(req.params.bugId);
  res.json(attempts);
}));

// Start auto-fix + retest loop (the killer feature)
// Fix code → Create PR → Retest → Iterate until quality target hit
app.post('/api/bugs/:bugId/auto-fix-loop', requireAuth, asyncHandler(async (req: any, res) => {
  if (!autoFixService) return res.status(503).json({ error: (req as any).t('errors:service.autoFixUnavailable') });
  const { bugId } = req.params;
  const { github_repo_id, max_iterations, quality_threshold, auto_merge } = req.body;
  if (!github_repo_id) return res.status(400).json({ error: (req as any).t('errors:validation.githubRepoIdRequired') });

  const attempt = await autoFixService.startAutoFixLoop(bugId, github_repo_id, {
    maxIterations: max_iterations || 3,
    qualityThreshold: quality_threshold || 80,
    workspaceId: req.workspaceId,
    autoMerge: auto_merge !== false, // default true
  });

  res.status(202).json({
    ...attempt,
    message: auto_merge !== false
      ? 'Auto-fix loop started. The system will fix code, create a PR, auto-merge, retest, and iterate until quality target is met.'
      : 'Auto-fix loop started. The system will fix code, create a PR, retest, and iterate until quality target is met.',
  });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC PLAN ROUTES (no auth required — for pricing page)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/plans', asyncHandler(async (_req, res) => {
  const plans = await planRepository.findPublicPlans();
  const plansWithFeatures = await Promise.all(
    plans.map(async (plan) => {
      const features = await planRepository.getFeatures(plan.id);
      const featureMap: Record<string, string> = {};
      features.forEach(f => { featureMap[f.feature_key] = f.feature_value; });
      return { ...plan, features: featureMap };
    })
  );
  res.json({ success: true, plans: plansWithFeatures });
}));

app.get('/api/plans/:slug', asyncHandler(async (req, res) => {
  const plan = await planRepository.findBySlug(req.params.slug);
  if (!plan || plan.is_archived) {
    throw createError((req as any).t('errors:resource.planNotFound'), 404, 'PLAN_NOT_FOUND');
  }
  const features = await planRepository.getFeatures(plan.id);
  const featureMap: Record<string, string> = {};
  features.forEach(f => { featureMap[f.feature_key] = f.feature_value; });
  res.json({ success: true, plan: { ...plan, features: featureMap } });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ME BILLING ROUTES (subscription lifecycle + PAYG)
// ═══════════════════════════════════════════════════════════════════════════════
app.use('/api/me/billing', requireAuth, meBillingRouter);
app.use('/api/me/usage', requireAuth, meUsageRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING ROUTES (authenticated — for workspace billing page)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/billing/subscription', requireAuth, asyncHandler(async (req: any, res) => {
  const data = await PaymentService.getWorkspaceSubscription(req.workspaceId);
  if (!data) {
    return res.json({ success: true, subscription: null, plan: null, features: {} });
  }
  res.json({ success: true, ...data });
}));

app.get('/api/billing/credits', requireAuth, asyncHandler(async (req: any, res) => {
  const balance = await creditRepository.getBalance(req.workspaceId);
  res.json({ success: true, balance: balance || { balance: 0, lifetime_credits_used: 0, lifetime_credits_granted: 0, lifetime_credits_purchased: 0 } });
}));

app.get('/api/billing/credits/history', requireAuth, asyncHandler(async (req: any, res) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const type = req.query.type as string | undefined;
  const result = await creditRepository.getTransactions(req.workspaceId, { offset, limit, type });
  res.json({ success: true, ...result });
}));

app.get('/api/billing/usage', requireAuth, asyncHandler(async (req: any, res) => {
  const usage = await PaymentService.getUsageSummary(req.workspaceId);
  res.json({ success: true, usage });
}));

app.post('/api/billing/checkout', requireAuth, asyncHandler(async (req: any, res) => {
  const { plan_id } = req.body;
  if (!plan_id) throw createError((req as any).t('errors:validation.planIdRequired'), 400, 'MISSING_PLAN_ID');
  const plan = await planRepository.findById(plan_id);
  if (!plan) throw createError((req as any).t('billing:plan.notFound'), 404, 'PLAN_NOT_FOUND');
  const session = await PaymentService.createCheckoutSession(
    {
      orgId: req.workspaceId,
      plan: plan.slug,
      tier: plan.slug,
      successUrl: env.STRIPE_SUCCESS_URL,
      cancelUrl: env.STRIPE_CANCEL_URL,
    },
    { userId: req.user!.id, orgId: req.workspaceId },
  );
  res.json({ success: true, sessionId: session.sessionId, url: session.url });
}));

app.post('/api/billing/portal', requireAuth, asyncHandler(async (req: any, res) => {
  const result = await PaymentService.createPortalSession(req.workspaceId);
  res.json({ success: true, ...result });
}));

app.get('/api/billing/invoices', requireAuth, asyncHandler(async (req: any, res) => {
  const invoices = await invoiceRepository.findByWorkspaceId(req.workspaceId);
  res.json({ success: true, invoices });
}));

app.post('/api/billing/cancel', requireAuth, asyncHandler(async (req: any, res) => {
  const immediate = req.body.immediate === true;
  await PaymentService.cancelSubscription(req.workspaceId, immediate);
  res.json({ success: true, message: immediate ? (req as any).t('success:subscription.canceledImmediately') : (req as any).t('success:subscription.cancelAtPeriodEnd') });
}));

app.post('/api/billing/reactivate', requireAuth, asyncHandler(async (req: any, res) => {
  await PaymentService.reactivateSubscription(req.workspaceId);
  res.json({ success: true, message: (req as any).t('success:subscription.reactivated') });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES (requireAuth + requireSuperAdmin)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Admin: Plan Management ─────────────────────────────────────────────────

app.get('/api/admin/plans', requireAuth, requireSuperAdmin, asyncHandler(async (_req, res) => {
  const plans = await planRepository.findAllWithFeatures();
  const plansWithCounts = await Promise.all(
    plans.map(async (plan) => ({
      ...plan,
      subscriber_count: await planRepository.countSubscribers(plan.id),
    }))
  );
  res.json({ success: true, plans: plansWithCounts });
}));

app.post('/api/admin/plans', requireAuth, requireSuperAdmin, validate(schemas.createPlan), asyncHandler(async (req: any, res) => {
  const existing = await planRepository.findBySlug(req.body.slug);
  if (existing) {
    throw createError((req as any).t('errors:business.planSlugExists'), 409, 'SLUG_EXISTS');
  }
  const plan = await planRepository.create(req.body);
  auditLog(req, 'plan.create', 'plan', plan.id, { name: plan.name, slug: plan.slug });
  res.status(201).json({ success: true, plan });
}));

app.get('/api/admin/plans/:id', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const plan = await planRepository.findById(req.params.id);
  if (!plan) throw createError((req as any).t('errors:resource.planNotFound'), 404, 'PLAN_NOT_FOUND');
  const features = await planRepository.getFeatures(plan.id);
  const subscriberCount = await planRepository.countSubscribers(plan.id);
  res.json({ success: true, plan: { ...plan, features, subscriber_count: subscriberCount } });
}));

app.put('/api/admin/plans/:id', requireAuth, requireSuperAdmin, validate(schemas.updatePlan), asyncHandler(async (req, res) => {
  const before = await planRepository.findById(req.params.id);
  const plan = await planRepository.update(req.params.id, req.body);
  if (!plan) throw createError((req as any).t('errors:resource.planNotFound'), 404, 'PLAN_NOT_FOUND');
  auditLog(req as any, 'plan.update', 'plan', req.params.id, { before: { name: before?.name, price_cents: before?.price_cents, trial_days: before?.trial_days }, after: { name: plan.name, price_cents: plan.price_cents, trial_days: plan.trial_days } });
  res.json({ success: true, plan });
}));

app.post('/api/admin/plans/:id/archive', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const plan = await planRepository.archive(req.params.id);
  if (!plan) throw createError((req as any).t('errors:resource.planNotFound'), 404, 'PLAN_NOT_FOUND');
  auditLog(req as any, 'plan.archive', 'plan', req.params.id, { name: plan.name });
  res.json({ success: true, plan });
}));

app.post('/api/admin/plans/:id/restore', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const plan = await planRepository.restore(req.params.id);
  if (!plan) throw createError((req as any).t('errors:resource.planNotFound'), 404, 'PLAN_NOT_FOUND');
  auditLog(req as any, 'plan.restore', 'plan', req.params.id, { name: plan.name });
  res.json({ success: true, plan });
}));

app.post('/api/admin/plans/:id/features', requireAuth, requireSuperAdmin, validate(schemas.setPlanFeatures), asyncHandler(async (req, res) => {
  const plan = await planRepository.findById(req.params.id);
  if (!plan) throw createError((req as any).t('errors:resource.planNotFound'), 404, 'PLAN_NOT_FOUND');
  const features = await planRepository.setFeatures(plan.id, req.body.features);
  res.json({ success: true, features });
}));

app.delete('/api/admin/plans/:id/features/:key', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  await planRepository.removeFeature(req.params.id, req.params.key);
  res.json({ success: true });
}));

app.post('/api/admin/plans/:id/sync-stripe', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const result = await PaymentService.syncPlanToStripe(req.params.id);
  res.json({ success: true, ...result });
}));

// ─── Admin: User Management ─────────────────────────────────────────────────

app.get('/api/admin/users', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const search = req.query.search as string | undefined;
  const role = req.query.role as string | undefined;
  const result = await adminUserRepository.findAllPaginated(offset, limit, { search, role });

  // Enrich with subscription/plan info
  const usersWithPlans = await Promise.all(
    result.users.map(async (user) => {
      const workspaces = await workspaceRepository.findAllByUserId(user.id);
      const primaryWorkspace = workspaces[0];
      let planName = null;
      let credits = 0;
      if (primaryWorkspace) {
        const sub = await subscriptionRepository.findByWorkspaceId(primaryWorkspace.id);
        if (sub) {
          const plan = await planRepository.findById(sub.plan_id);
          planName = plan?.name || null;
        }
        const balance = await creditRepository.getBalance(primaryWorkspace.id);
        credits = balance?.balance || 0;
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
        created_at: user.created_at,
        plan_name: planName,
        credits,
        workspace_count: workspaces.length,
      };
    })
  );

  res.json({ success: true, users: usersWithPlans, total: result.total });
}));

app.get('/api/admin/users/:id', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const user = await adminUserRepository.findById(req.params.id);
  if (!user) throw createError((req as any).t('errors:resource.userNotFound'), 404, 'USER_NOT_FOUND');

  const workspaces = await workspaceRepository.findAllByUserId(user.id);
  const workspacesWithSubs = await Promise.all(
    workspaces.map(async (ws) => {
      const sub = await subscriptionRepository.findByWorkspaceId(ws.id);
      const balance = await creditRepository.getBalance(ws.id);
      let planName = null;
      if (sub) {
        const plan = await planRepository.findById(sub.plan_id);
        planName = plan?.name || null;
      }
      return {
        ...ws,
        subscription: sub,
        plan_name: planName,
        credits: balance?.balance || 0,
      };
    })
  );

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      role: user.role,
      github_id: user.github_id,
      google_id: user.google_id,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    workspaces: workspacesWithSubs,
  });
}));

app.put('/api/admin/users/:id/role', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin', 'super_admin'].includes(role)) {
    throw createError((req as any).t('errors:business.invalidRole'), 400, 'INVALID_ROLE');
  }
  const user = await adminUserRepository.updateRole(req.params.id, role);
  if (!user) throw createError((req as any).t('errors:resource.userNotFound'), 404, 'USER_NOT_FOUND');
  auditLog(req as any, 'user.role_change', 'user', req.params.id, { new_role: role });
  res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}));

// ─── Admin: Credit Management ───────────────────────────────────────────────

app.get('/api/admin/workspaces/:wsId/credits', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const balance = await creditRepository.getBalance(req.params.wsId);
  res.json({ success: true, balance });
}));

app.post('/api/admin/workspaces/:wsId/credits/grant', requireAuth, requireSuperAdmin, validate(schemas.grantCredits), asyncHandler(async (req: any, res) => {
  await PaymentService.grantCredits(
    req.params.wsId,
    req.body.amount,
    req.body.description,
    req.user!.id,
  );
  auditLog(req, 'credits.grant', 'workspace', req.params.wsId, { amount: req.body.amount });
  res.json({ success: true });
}));

app.post('/api/admin/workspaces/:wsId/credits/revoke', requireAuth, requireSuperAdmin, validate(schemas.revokeCredits), asyncHandler(async (req: any, res) => {
  try {
    await PaymentService.revokeCredits(
      req.params.wsId,
      req.body.amount,
      req.body.description,
      req.user!.id,
    );
    auditLog(req, 'credits.revoke', 'workspace', req.params.wsId, { amount: req.body.amount });
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'Insufficient credits') {
      throw createError((req as any).t('errors:business.insufficientCredits'), 400, 'INSUFFICIENT_CREDITS');
    }
    throw err;
  }
}));

app.get('/api/admin/workspaces/:wsId/credits/history', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const result = await creditRepository.getTransactions(req.params.wsId, { offset, limit });
  res.json({ success: true, ...result });
}));

// ─── Admin: Subscription Management ─────────────────────────────────────────

app.get('/api/admin/subscriptions', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const status = req.query.status as string | undefined;
  const plan_id = req.query.plan_id as string | undefined;
  const result = await subscriptionRepository.findAllPaginated(offset, limit, { status, plan_id });

  // Enrich with workspace and plan info
  const enriched = await Promise.all(
    result.subscriptions.map(async (sub) => {
      const workspace = await workspaceRepository.findById(sub.workspace_id);
      const plan = await planRepository.findById(sub.plan_id);
      const balance = await creditRepository.getBalance(sub.workspace_id);
      let ownerName = null;
      if (workspace?.owner_id) {
        const owner = await adminUserRepository.findById(workspace.owner_id);
        ownerName = owner?.name || null;
      }
      return {
        ...sub,
        workspace_name: workspace?.name || null,
        owner_name: ownerName,
        plan_name: plan?.name || null,
        credits_remaining: balance?.balance || 0,
      };
    })
  );

  res.json({ success: true, subscriptions: enriched, total: result.total });
}));

app.get('/api/admin/workspaces/:wsId/subscription', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const data = await PaymentService.getWorkspaceSubscription(req.params.wsId);
  if (!data) throw createError((req as any).t('errors:resource.subscriptionNotFound'), 404, 'NO_SUBSCRIPTION');
  res.json({ success: true, ...data });
}));

app.put('/api/admin/workspaces/:wsId/subscription', requireAuth, requireSuperAdmin, validate(schemas.adminUpdateSubscription), asyncHandler(async (req, res) => {
  const sub = await subscriptionRepository.findByWorkspaceId(req.params.wsId);
  if (!sub) throw createError((req as any).t('errors:resource.subscriptionNotFound'), 404, 'NO_SUBSCRIPTION');

  const updates: any = {};
  if (req.body.plan_id) updates.plan_id = req.body.plan_id;
  if (req.body.status) updates.status = req.body.status;

  const updated = await subscriptionRepository.update(sub.id, updates);
  res.json({ success: true, subscription: updated });
}));

// ─── Admin: Overview Stats ──────────────────────────────────────────────────

app.get('/api/admin/stats/overview', requireAuth, requireSuperAdmin, asyncHandler(async (_req, res) => {
  const totalUsers = await adminUserRepository.countAll();
  const subscriptionsByPlan = await subscriptionRepository.countByPlan();

  // Calculate MRR from active paid subscriptions
  let mrr = 0;
  for (const { plan_id, count } of subscriptionsByPlan) {
    const plan = await planRepository.findById(plan_id);
    if (plan && plan.price_cents > 0) {
      mrr += plan.price_cents * count;
    }
  }

  res.json({
    success: true,
    stats: {
      total_users: totalUsers,
      subscriptions_by_plan: subscriptionsByPlan,
      mrr_cents: mrr,
    },
  });
}));

// ==================== PHASE 6: ADVANCED ADMIN FEATURES ====================

// --- Analytics ---

app.get('/api/admin/analytics/overview', requireAuth, requireSuperAdmin, asyncHandler(async (_req, res) => {
  const totalUsers = await adminUserRepository.countAll();
  const subscriptionsByPlan = await subscriptionRepository.countByPlan();

  let mrr = 0;
  let activeSubscriptions = 0;
  for (const { plan_id, count } of subscriptionsByPlan) {
    const plan = await planRepository.findById(plan_id);
    if (plan && plan.price_cents > 0) {
      mrr += plan.price_cents * count;
    }
    activeSubscriptions += count;
  }

  const dauRows = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT id) as count FROM users WHERE last_login_at >= NOW() - INTERVAL '1 day'`
  ).catch(() => [{ count: '0' }]);
  const mauRows = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT id) as count FROM users WHERE last_login_at >= NOW() - INTERVAL '30 days'`
  ).catch(() => [{ count: '0' }]);
  const churnRows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM workspace_subscriptions WHERE canceled_at IS NOT NULL AND canceled_at >= NOW() - INTERVAL '30 days'`
  ).catch(() => [{ count: '0' }]);

  res.json({
    success: true,
    overview: {
      total_users: totalUsers,
      active_subscriptions: activeSubscriptions,
      mrr_cents: mrr,
      arr_cents: mrr * 12,
      dau: parseInt(dauRows[0]?.count || '0', 10),
      mau: parseInt(mauRows[0]?.count || '0', 10),
      churn_30d: parseInt(churnRows[0]?.count || '0', 10),
      subscriptions_by_plan: subscriptionsByPlan,
    },
  });
}));

app.get('/api/admin/analytics/signups', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days as string) || 30;
  const result = await query<{ date: string; count: string }>(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM users
     WHERE created_at >= NOW() - INTERVAL '1 day' * $1
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [days]
  );
  res.json({ success: true, signups: result.map(r => ({ date: r.date, count: parseInt(r.count, 10) })) });
}));

app.get('/api/admin/analytics/revenue', requireAuth, requireSuperAdmin, asyncHandler(async (_req, res) => {
  const result = await query<{ plan_name: string; subscriber_count: string; mrr_cents: string }>(
    `SELECT p.name as plan_name, COUNT(ws.id) as subscriber_count, p.price_cents * COUNT(ws.id) as mrr_cents
     FROM workspace_subscriptions ws
     JOIN plans p ON ws.plan_id = p.id
     WHERE ws.status IN ('active', 'trialing')
     GROUP BY p.id, p.name, p.price_cents
     ORDER BY mrr_cents DESC`
  );
  res.json({
    success: true,
    revenue: result.map(r => ({
      plan_name: r.plan_name,
      subscriber_count: parseInt(r.subscriber_count, 10),
      mrr_cents: parseInt(r.mrr_cents, 10),
    })),
  });
}));

app.get('/api/admin/analytics/usage', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days as string) || 30;
  const result = await query<{ date: string; credits_used: string }>(
    `SELECT DATE(created_at) as date, ABS(SUM(amount)) as credits_used
     FROM credit_transactions
     WHERE type = 'usage' AND created_at >= NOW() - INTERVAL '1 day' * $1
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [days]
  );
  res.json({ success: true, usage: result.map(r => ({ date: r.date, credits_used: parseInt(r.credits_used, 10) })) });
}));

app.get('/api/admin/analytics/churn', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days as string) || 90;
  const result = await query<{ date: string; cancellations: string }>(
    `SELECT DATE(canceled_at) as date, COUNT(*) as cancellations
     FROM workspace_subscriptions
     WHERE canceled_at IS NOT NULL AND canceled_at >= NOW() - INTERVAL '1 day' * $1
     GROUP BY DATE(canceled_at)
     ORDER BY date`,
    [days]
  );
  res.json({ success: true, churn: result.map(r => ({ date: r.date, cancellations: parseInt(r.cancellations, 10) })) });
}));

// --- User Management (extended) ---

app.post('/api/admin/users/:id/suspend', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const user = await adminUserRepository.findById(req.params.id);
  if (!user) throw createError((req as any).t('errors:resource.userNotFound'), 404, 'NOT_FOUND');

  await adminUserRepository.updateRole(req.params.id, 'user'); // keep role but mark suspended via subscription
  // Suspend by deactivating subscription
  const workspaces = await workspaceRepository.findAllByUserId(req.params.id);
  for (const ws of workspaces) {
    await subscriptionRepository.updateByWorkspaceId(ws.id, { status: 'canceled' });
  }

  auditLog(req as any, 'user.suspend', 'user', req.params.id);
  res.json({ success: true, message: (req as any).t('success:user.suspended') });
}));

app.post('/api/admin/users/:id/unsuspend', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const user = await adminUserRepository.findById(req.params.id);
  if (!user) throw createError((req as any).t('errors:resource.userNotFound'), 404, 'NOT_FOUND');

  const workspaces = await workspaceRepository.findAllByUserId(req.params.id);
  for (const ws of workspaces) {
    await subscriptionRepository.updateByWorkspaceId(ws.id, { status: 'active' });
  }

  auditLog(req as any, 'user.unsuspend', 'user', req.params.id);
  res.json({ success: true, message: (req as any).t('success:user.unsuspended') });
}));

app.post('/api/admin/users/:id/impersonate', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const targetUser = await adminUserRepository.findById(req.params.id);
  if (!targetUser) throw createError((req as any).t('errors:resource.userNotFound'), 404, 'NOT_FOUND');

  // Generate short-lived token (1 hour) for impersonation
  const jwt = await import('jsonwebtoken');
  const secret = env.JWT_SECRET;
  if (!secret) throw createError((req as any).t('errors:auth.jwtNotConfigured'), 500, 'CONFIG_ERROR');

  const token = jwt.default.sign(
    { id: targetUser.id, email: targetUser.email, name: targetUser.name, role: targetUser.role },
    secret,
    { expiresIn: '1h' }
  );

  auditLog(req as any, 'user.impersonate', 'user', req.params.id);
  res.json({ success: true, token, user: { id: targetUser.id, name: targetUser.name, email: targetUser.email } });
}));

// --- Admin: Reset Password ---

app.post('/api/admin/users/:id/reset-password', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const user = await adminUserRepository.findById(req.params.id);
  if (!user) throw createError((req as any).t('errors:resource.userNotFound'), 404, 'USER_NOT_FOUND');
  if (!user.email) throw createError((req as any).t('errors:auth.noEmailAddress'), 400, 'NO_EMAIL');

  const crypto = await import('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

  await query(
    `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
    [resetToken, resetExpiry, req.params.id]
  );

  auditLog(req, 'user.reset_password', 'user', req.params.id, { email: user.email });
  res.json({ success: true, message: (req as any).t('success:admin.passwordResetInitiated'), resetToken });
}));

// --- Admin: Move User to Organization ---

app.patch('/api/admin/users/:id/organization', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { workspaceId } = req.body;
  if (!workspaceId) throw createError((req as any).t('errors:validation.workspaceIdBodyRequired'), 400, 'VALIDATION_ERROR');

  const user = await adminUserRepository.findById(req.params.id);
  if (!user) throw createError((req as any).t('errors:resource.userNotFound'), 404, 'USER_NOT_FOUND');

  const targetWorkspace = await workspaceRepository.findById(workspaceId);
  if (!targetWorkspace) throw createError((req as any).t('errors:resource.workspaceNotFound'), 404, 'WORKSPACE_NOT_FOUND');

  const previousWorkspaces = await workspaceRepository.findAllByUserId(user.id);
  const previousIds = previousWorkspaces.map(w => w.id);

  await query(
    `UPDATE workspaces SET owner_id = $1 WHERE owner_id = $2`,
    [targetWorkspace.owner_id, user.id]
  );
  await query(
    `UPDATE workspaces SET owner_id = $1 WHERE id = $2`,
    [user.id, workspaceId]
  );

  auditLog(req, 'user.move_organization', 'user', req.params.id, {
    before: { workspaceIds: previousIds },
    after: { workspaceId },
  });

  res.json({ success: true, message: (req as any).t('success:admin.userMovedToOrganization') });
}));

// --- Admin: Force Set Plan ---

app.patch('/api/admin/users/:id/plan', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { planId } = req.body;
  if (!planId) throw createError((req as any).t('errors:validation.planIdRequired'), 400, 'VALIDATION_ERROR');

  const user = await adminUserRepository.findById(req.params.id);
  if (!user) throw createError((req as any).t('errors:resource.userNotFound'), 404, 'USER_NOT_FOUND');

  const plan = await planRepository.findById(planId);
  if (!plan) throw createError((req as any).t('errors:resource.planNotFound'), 404, 'PLAN_NOT_FOUND');

  const workspaces = await workspaceRepository.findAllByUserId(user.id);
  if (workspaces.length === 0) throw createError((req as any).t('errors:workspace.noWorkspace'), 400, 'NO_WORKSPACE');

  const primaryWs = workspaces[0];
  const existingSub = await subscriptionRepository.findByWorkspaceId(primaryWs.id);
  const beforePlanId = existingSub?.plan_id || null;

  if (existingSub) {
    await subscriptionRepository.update(existingSub.id, { plan_id: planId, status: 'active' });
  } else {
    await subscriptionRepository.create({ workspace_id: primaryWs.id, plan_id: planId, status: 'active' });
  }

  auditLog(req, 'user.force_plan', 'user', req.params.id, {
    before: { planId: beforePlanId },
    after: { planId },
    planName: plan.name,
  });

  res.json({ success: true, message: (req as any).t('success:admin.planUpdated', { planName: plan.name }) });
}));

// --- Admin: Organizations (Workspaces) ---

app.get('/api/admin/organizations', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const search = req.query.q as string || req.query.search as string || undefined;

  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (search) {
    conditions.push(`(w.name ILIKE $${paramIndex})`);
    values.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM workspaces w ${whereClause}`,
    values
  );
  const total = parseInt(countResult[0]?.count || '0', 10);

  values.push(limit, offset);
  const orgs = await query<any>(
    `SELECT w.*, u.name as owner_name, u.email as owner_email
     FROM workspaces w
     LEFT JOIN users u ON u.id = w.owner_id
     ${whereClause}
     ORDER BY w.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  const enriched = await Promise.all(
    orgs.map(async (org: any) => {
      const sub = await subscriptionRepository.findByWorkspaceId(org.id);
      let planName = null;
      if (sub) {
        const plan = await planRepository.findById(sub.plan_id);
        planName = plan?.name || null;
      }
      const balance = await creditRepository.getBalance(org.id);
      const memberCount = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM workspaces WHERE owner_id = $1`,
        [org.owner_id]
      );
      return {
        id: org.id,
        name: org.name,
        ownerId: org.owner_id,
        ownerName: org.owner_name,
        ownerEmail: org.owner_email,
        planName,
        status: sub?.status || 'none',
        credits: balance?.balance || 0,
        memberCount: parseInt(memberCount[0]?.count || '1', 10),
        createdAt: org.created_at,
      };
    })
  );

  res.json({ success: true, organizations: enriched, total });
}));

app.get('/api/admin/organizations/:id', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const org = await workspaceRepository.findById(req.params.id);
  if (!org) throw createError((req as any).t('errors:resource.organizationNotFound'), 404, 'ORG_NOT_FOUND');

  const owner = await adminUserRepository.findById(org.owner_id);
  const sub = await subscriptionRepository.findByWorkspaceId(org.id);
  const balance = await creditRepository.getBalance(org.id);
  let plan = null;
  if (sub) {
    plan = await planRepository.findById(sub.plan_id);
  }

  const members = await query<any>(
    `SELECT u.id, u.name, u.email, u.role, u.created_at
     FROM users u
     JOIN workspaces w ON w.owner_id = u.id
     WHERE w.id = $1
     ORDER BY u.created_at ASC`,
    [org.id]
  );

  const auditEntries = await auditRepository.findAll({
    target_id: org.id,
    limit: 20,
  });

  const rawOverrides = await featureFlagRepository.listOrgOverrides(org.id);
  const flagOverrides = rawOverrides.map(o => ({ key: o.flag_key, enabled: o.enabled }));

  res.json({
    success: true,
    organization: {
      id: org.id,
      name: org.name,
      ownerId: org.owner_id,
      ownerName: owner?.name || null,
      ownerEmail: owner?.email || null,
      createdAt: org.created_at,
    },
    subscription: sub ? {
      id: sub.id,
      planId: sub.plan_id,
      planName: plan?.name || null,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      trialEnd: sub.trial_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    } : null,
    credits: balance?.balance || 0,
    members,
    flagOverrides: flagOverrides || [],
    auditLog: auditEntries.entries || [],
  });
}));

app.patch('/api/admin/organizations/:id', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const org = await workspaceRepository.findById(req.params.id);
  if (!org) throw createError((req as any).t('errors:resource.organizationNotFound'), 404, 'ORG_NOT_FOUND');

  const before: Record<string, any> = { name: org.name };
  const after: Record<string, any> = {};

  if (req.body.name && req.body.name !== org.name) {
    await workspaceRepository.update(org.id, req.body.name);
    after.name = req.body.name;
  }

  if (req.body.status) {
    const sub = await subscriptionRepository.findByWorkspaceId(org.id);
    if (sub) {
      before.status = sub.status;
      await subscriptionRepository.update(sub.id, { status: req.body.status });
      after.status = req.body.status;
    }
  }

  if (req.body.planId) {
    const plan = await planRepository.findById(req.body.planId);
    if (!plan) throw createError((req as any).t('errors:resource.planNotFound'), 404, 'PLAN_NOT_FOUND');
    const sub = await subscriptionRepository.findByWorkspaceId(org.id);
    if (sub) {
      before.planId = sub.plan_id;
      await subscriptionRepository.update(sub.id, { plan_id: req.body.planId });
      after.planId = req.body.planId;
      after.planName = plan.name;
    } else {
      await subscriptionRepository.create({ workspace_id: org.id, plan_id: req.body.planId, status: 'active' });
      after.planId = req.body.planId;
      after.planName = plan.name;
    }
  }

  auditLog(req, 'organization.update', 'organization', org.id, { before, after });
  res.json({ success: true, message: (req as any).t('success:admin.organizationUpdated') });
}));

app.post('/api/admin/organizations/:id/flags/:key', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { id: orgId, key } = req.params;
  const { enabled } = req.body;

  if (!isValidFeatureKey(key)) {
    throw createError((req as any).t('errors:flags.unknownKey'), 400, 'UNKNOWN_FLAG_KEY');
  }

  const org = await workspaceRepository.findById(orgId);
  if (!org) throw createError((req as any).t('errors:resource.organizationNotFound'), 404, 'ORG_NOT_FOUND');

  const before = await featureFlagRepository.getOrgOverride(orgId, key);
  await featureFlagRepository.upsertOverride(orgId, key, enabled, req.user?.id || '');
  invalidateFlag(orgId, key as any);

  auditLog(req, 'organization.flag_override', 'organization', orgId, {
    flag_key: key,
    before: before ? before.enabled : null,
    after: enabled,
  });

  res.json({ success: true });
}));

// --- System Settings ---

app.get('/api/admin/settings', requireAuth, requireSuperAdmin, asyncHandler(async (_req, res) => {
  const settings = await systemSettingsRepository.getAll();
  res.json({ success: true, settings });
}));

app.put('/api/admin/settings/:key', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { value } = req.body;
  if (value === undefined || value === null) throw createError((req as any).t('errors:validation.valueRequired'), 400, 'VALIDATION_ERROR');

  const setting = await systemSettingsRepository.set(req.params.key, String(value), req.user!.id);
  auditLog(req as any, 'settings.update', 'setting', req.params.key, { value });
  res.json({ success: true, setting });
}));

// --- Announcements ---

app.get('/api/announcements/active', asyncHandler(async (_req, res) => {
  const announcements = await announcementRepository.findActive();
  res.json({ success: true, announcements });
}));

app.get('/api/admin/announcements', requireAuth, requireSuperAdmin, asyncHandler(async (_req, res) => {
  const announcements = await announcementRepository.findAll();
  res.json({ success: true, announcements });
}));

app.post('/api/admin/announcements', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { title, body, type, is_active, starts_at, ends_at } = req.body;
  if (!title) throw createError((req as any).t('errors:validation.titleRequired'), 400, 'VALIDATION_ERROR');

  const announcement = await announcementRepository.create({
    title,
    body,
    type,
    is_active,
    starts_at: starts_at ? new Date(starts_at) : undefined,
    ends_at: ends_at ? new Date(ends_at) : undefined,
    created_by: req.user!.id,
  });

  auditLog(req as any, 'announcement.create', 'announcement', announcement.id, { title });
  res.status(201).json({ success: true, announcement });
}));

app.put('/api/admin/announcements/:id', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { title, body, type, is_active, starts_at, ends_at } = req.body;
  const announcement = await announcementRepository.update(req.params.id, {
    title,
    body,
    type,
    is_active,
    starts_at: starts_at ? new Date(starts_at) : starts_at === null ? null : undefined,
    ends_at: ends_at ? new Date(ends_at) : ends_at === null ? null : undefined,
  });

  if (!announcement) throw createError((req as any).t('errors:resource.announcementNotFound'), 404, 'NOT_FOUND');
  auditLog(req as any, 'announcement.update', 'announcement', req.params.id);
  res.json({ success: true, announcement });
}));

app.delete('/api/admin/announcements/:id', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const deleted = await announcementRepository.delete(req.params.id);
  if (!deleted) throw createError((req as any).t('errors:resource.announcementNotFound'), 404, 'NOT_FOUND');
  auditLog(req as any, 'announcement.delete', 'announcement', req.params.id);
  res.json({ success: true });
}));

// --- Audit Log ---

app.get('/api/admin/audit-log', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { cursor, actor_id, action, target_type, target_id, from, to } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  const result = await auditRepository.findCursorPaginated({
    cursor: cursor || undefined,
    limit,
    actor_id: actor_id || undefined,
    action: action || undefined,
    target_type: target_type || undefined,
    target_id: target_id || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  res.json({ success: true, ...result });
}));

// ─── Admin: Usage Tracking ─────────────────────────────────────────────────

app.get('/api/admin/usage', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { cursor, org_id, from, to } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [ts, id] = decoded.split('|');
        conditions.push(`(created_at, id) < ($${paramIndex}, $${paramIndex + 1})`);
        params.push(ts, id);
        paramIndex += 2;
      } catch { /* invalid cursor */ }
    }

    if (org_id) { conditions.push(`workspace_id = $${paramIndex++}`); params.push(org_id); }
    if (from) { conditions.push(`created_at >= $${paramIndex++}`); params.push(from); }
    if (to) { conditions.push(`created_at <= $${paramIndex++}`); params.push(to); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query<any>(
      `SELECT * FROM usage_events ${where} ORDER BY created_at DESC, id DESC LIMIT $${paramIndex}`,
      [...params, limit + 1]
    );

    const hasMore = rows.length > limit;
    const entries = hasMore ? rows.slice(0, limit) : rows;
    let nextCursor: string | null = null;
    if (hasMore && entries.length > 0) {
      const last = entries[entries.length - 1];
      const ts = last.created_at instanceof Date ? last.created_at.toISOString() : String(last.created_at);
      nextCursor = Buffer.from(`${ts}|${last.id}`).toString('base64');
    }

    res.json({ success: true, entries, nextCursor });
  } catch (err: any) {
    if (err?.code === '42P01') {
      res.json({ success: true, entries: [], nextCursor: null });
      return;
    }
    throw err;
  }
}));

app.get('/api/admin/usage/summary', requireAuth, requireSuperAdmin, asyncHandler(async (_req, res) => {
  try {
    const byOrg = await query<{ workspace_id: string; event_count: string; total_credits: string }>(
      `SELECT workspace_id, COUNT(*) as event_count, COALESCE(SUM(credits_consumed), 0) as total_credits
       FROM usage_events
       GROUP BY workspace_id
       ORDER BY total_credits DESC
       LIMIT 50`
    );
    const byType = await query<{ event_type: string; event_count: string; total_credits: string }>(
      `SELECT event_type, COUNT(*) as event_count, COALESCE(SUM(credits_consumed), 0) as total_credits
       FROM usage_events
       GROUP BY event_type
       ORDER BY total_credits DESC`
    );
    const daily = await query<{ date: string; event_count: string; total_credits: string }>(
      `SELECT DATE(created_at) as date, COUNT(*) as event_count, COALESCE(SUM(credits_consumed), 0) as total_credits
       FROM usage_events
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date`
    );
    res.json({
      success: true,
      byOrg: byOrg.map(r => ({ workspaceId: r.workspace_id, eventCount: parseInt(r.event_count, 10), totalCredits: parseInt(r.total_credits, 10) })),
      byType: byType.map(r => ({ eventType: r.event_type, eventCount: parseInt(r.event_count, 10), totalCredits: parseInt(r.total_credits, 10) })),
      daily: daily.map(r => ({ date: r.date, eventCount: parseInt(r.event_count, 10), totalCredits: parseInt(r.total_credits, 10) })),
    });
  } catch (err: any) {
    if (err?.code === '42P01') {
      res.json({ success: true, byOrg: [], byType: [], daily: [] });
      return;
    }
    throw err;
  }
}));

// ─── Admin: Feature Flags ───────────────────────────────────────────────────

app.get('/api/admin/feature-flags', requireAuth, requireSuperAdmin, asyncHandler(async (_req, res) => {
  const flags = await featureFlagRepository.listFlags();
  res.json({ success: true, flags });
}));

app.get('/api/admin/feature-flags/:orgId', requireAuth, requireSuperAdmin, asyncHandler(async (req, res) => {
  const rows = await featureFlagRepository.listAllOrgOverridesWithFlags(req.params.orgId);
  res.json({ success: true, flags: rows });
}));

app.put('/api/admin/feature-flags/:orgId/:key', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { orgId, key } = req.params;
  const t = (req as any).t;

  if (!isValidFeatureKey(key)) {
    throw createError(t('errors:flags.unknownKey'), 400, 'UNKNOWN_FLAG_KEY');
  }

  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    throw createError((req as any).t('errors:validation.enabledMustBeBoolean'), 400, 'INVALID_BODY');
  }

  const before = await featureFlagRepository.getOrgOverride(orgId, key);
  const override = await featureFlagRepository.upsertOverride(orgId, key, enabled, req.user.id);
  invalidateFlag(orgId, key as any);

  auditLog(req, 'feature_flag.override_set', 'feature_flag', key, {
    target_org_id: orgId,
    flag_key: key,
    before: before ? before.enabled : null,
    after: enabled,
  });

  res.json({ success: true, override, message: t('success:flags.updated') });
}));

app.delete('/api/admin/feature-flags/:orgId/:key', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { orgId, key } = req.params;
  const t = (req as any).t;

  if (!isValidFeatureKey(key)) {
    throw createError(t('errors:flags.unknownKey'), 400, 'UNKNOWN_FLAG_KEY');
  }

  const before = await featureFlagRepository.getOrgOverride(orgId, key);
  await featureFlagRepository.deleteOverride(orgId, key);
  invalidateFlag(orgId, key as any);

  auditLog(req, 'feature_flag.override_cleared', 'feature_flag', key, {
    target_org_id: orgId,
    flag_key: key,
    before: before ? before.enabled : null,
    after: null,
  });

  res.json({ success: true });
}));

// ─── Admin: Billing Config ──────────────────────────────────────────────────

const BILLING_CONFIG_KEYS = ['trial_days', 'currency', 'payg_rates', 'grace_period_days', 'credits_low_threshold_cents', 'payg_charge_buffer_cents'] as const;

app.get('/api/admin/billing-config', requireAuth, requireSuperAdmin, asyncHandler(async (_req, res) => {
  const all = await billingConfigRepository.getAll();
  const config: Record<string, string> = {};
  for (const row of all) {
    config[row.key] = row.value;
  }
  res.json({ success: true, config });
}));

app.patch('/api/admin/billing-config', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const updates = req.body as Record<string, string>;

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw createError(req.t('errors:validation.bodyMustBeJsonObject'), 400, 'INVALID_BODY');
  }

  const changes: Record<string, { before: string | null; after: string }> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (!BILLING_CONFIG_KEYS.includes(key as any)) {
      throw createError(req.t('errors:validation.unknownBillingConfigKey', { key }), 400, 'UNKNOWN_KEY');
    }
    if (typeof value !== 'string') {
      throw createError(req.t('errors:validation.valueMustBeString', { key }), 400, 'INVALID_VALUE');
    }

    if (key === 'trial_days' || key === 'grace_period_days') {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        throw createError(req.t('errors:validation.mustBeNonNegativeInteger', { key }), 400, 'INVALID_VALUE');
      }
    }

    if (key === 'credits_low_threshold_cents' || key === 'payg_charge_buffer_cents') {
      try {
        const n = BigInt(value);
        if (n < 0n) throw new Error();
      } catch {
        throw createError(req.t('errors:validation.mustBeNonNegativeBigint', { key }), 400, 'INVALID_VALUE');
      }
    }

    if (key === 'payg_rates') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
        for (const [, v] of Object.entries(parsed)) {
          if (typeof v !== 'string' && typeof v !== 'number') throw new Error();
          const n = BigInt(v as string | number);
          if (n < 0n) throw new Error();
        }
      } catch {
        throw createError(req.t('errors:validation.paygRatesMustBeValid'), 400, 'INVALID_VALUE');
      }
    }

    if (key === 'currency') {
      if (!/^[a-z]{3}$/.test(value)) {
        throw createError(req.t('errors:validation.currencyMustBeValid'), 400, 'INVALID_VALUE');
      }
    }

    const before = await billingConfigRepository.get(key);
    await billingConfigRepository.set(key, value);
    changes[key] = { before, after: value };
  }

  auditLog(req, 'billing_config.update', 'billing_config', undefined, changes);

  const all = await billingConfigRepository.getAll();
  const config: Record<string, string> = {};
  for (const row of all) {
    config[row.key] = row.value;
  }

  res.json({ success: true, config });
}));

// ─── Admin: AI Providers ────────────────────────────────────────────────────

const KNOWN_AI_PROVIDERS = ['openai', 'anthropic', 'google', 'openrouter'] as const;

function isKnownProvider(p: string): p is (typeof KNOWN_AI_PROVIDERS)[number] {
  return (KNOWN_AI_PROVIDERS as readonly string[]).includes(p);
}

app.get('/api/admin/ai-providers', requireAuth, requireSuperAdmin, asyncHandler(async (_req, res) => {
  const [configs, defaultProvider, fallbackOrder, reconModels] = await Promise.all([
    platformAiConfigRepository.listAll(),
    billingConfigRepository.getDefaultAiProvider(),
    billingConfigRepository.getAiFallbackOrder(),
    billingConfigRepository.getAllReconModels(),
  ]);

  const providers = configs.map((c) => ({
    provider: c.provider,
    displayName: c.display_name,
    enabled: c.is_active,
    rateLimit: c.rate_limit,
    hasKey: c.hasKey,
    hasFallbackKey: c.hasFallbackKey,
    maskedKey: c.maskedKey,
    maskedFallbackKey: c.maskedFallbackKey,
    defaultModel: c.default_model || '',
    models: c.models || [],
  }));

  res.json({
    success: true,
    providers,
    defaultProvider: defaultProvider || { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    fallbackOrder: fallbackOrder.length > 0 ? fallbackOrder : [...KNOWN_AI_PROVIDERS],
    reconModels,
  });
}));

app.patch('/api/admin/ai-providers', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { providers } = req.body;

  if (!Array.isArray(providers)) {
    throw createError(req.t('errors:validation.workspaceRequired') || 'Body must contain a "providers" array', 400, 'INVALID_BODY');
  }

  for (const entry of providers) {
    if (!entry || typeof entry !== 'object') {
      throw createError(req.t('errors:validation.providerEntryInvalid'), 400, 'INVALID_ENTRY');
    }
    if (typeof entry.provider !== 'string' || !isKnownProvider(entry.provider)) {
      throw createError(req.t('errors:ai.unknownProvider', { provider: entry.provider }) || 'Unknown provider', 400, 'INVALID_ENTRY');
    }
  }

  const results = [];
  for (const entry of providers) {
    const provider = entry.provider as string;
    if (typeof entry.enabled === 'boolean') {
      if (entry.enabled) {
        await platformAiConfigRepository.setActive(provider, true);
      } else {
        await platformAiConfigRepository.setActive(provider, false);
      }
    }
    if (entry.rateLimit !== undefined) {
      const rl = Number(entry.rateLimit);
      if (!Number.isInteger(rl) || rl < 0) {
        throw createError(req.t('errors:ai.invalidRateLimit') || 'Rate limit must be a non-negative integer', 400, 'INVALID_ENTRY');
      }
      await platformAiConfigRepository.updateRateLimit(provider, rl);
    }
    if (typeof entry.defaultModel === 'string' && entry.defaultModel.length > 0) {
      await platformAiConfigRepository.updateDefaultModel(provider, entry.defaultModel);
    }
    if (Array.isArray(entry.models)) {
      await platformAiConfigRepository.updateModels(provider, entry.models);
    }
    platformKeyCache.invalidate(provider);
    const updated = await platformAiConfigRepository.findByProvider(provider);
    if (updated) results.push(updated);
  }

  auditLog(req, 'ai_providers.update', 'platform_ai_config', undefined, {
    updatedProviders: providers.map((p: any) => p.provider),
  });

  const [allConfigs, defaultProvider, fallbackOrder] = await Promise.all([
    platformAiConfigRepository.listAll(),
    billingConfigRepository.getDefaultAiProvider(),
    billingConfigRepository.getAiFallbackOrder(),
  ]);

  res.json({
    success: true,
    providers: allConfigs.map((c) => ({
      provider: c.provider,
      displayName: c.display_name,
      enabled: c.is_active,
      rateLimit: c.rate_limit,
      hasKey: c.hasKey,
      hasFallbackKey: c.hasFallbackKey,
      maskedKey: c.maskedKey,
      maskedFallbackKey: c.maskedFallbackKey,
      defaultModel: c.default_model || '',
      models: c.models || [],
    })),
    defaultProvider: defaultProvider || { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    fallbackOrder: fallbackOrder.length > 0 ? fallbackOrder : [...KNOWN_AI_PROVIDERS],
  });
}));

// ─── Admin: AI Provider Key Management ──────────────────────────────────────

app.post('/api/admin/ai-providers/:provider/key', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { provider } = req.params;
  if (!isKnownProvider(provider)) {
    throw createError(req.t('errors:ai.invalidProvider', { provider }) || `Unknown AI provider: ${provider}`, 400, 'INVALID_PROVIDER');
  }

  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    throw createError(req.t('errors:ai.keyRequired') || 'API key is required', 400, 'KEY_REQUIRED');
  }
  if (apiKey.length > 500) {
    throw createError(req.t('errors:ai.keyTooLong') || 'API key exceeds maximum length', 400, 'KEY_TOO_LONG');
  }

  const updated = await platformAiConfigRepository.upsertKey(provider, apiKey.trim());
  platformKeyCache.invalidate(provider);

  auditLog(req, 'ai-provider.key-set', 'platform_ai_config', provider, { provider });

  res.json({ success: true, provider, hasKey: true, maskedKey: updated.maskedKey });
}));

app.delete('/api/admin/ai-providers/:provider/key', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { provider } = req.params;
  if (!isKnownProvider(provider)) {
    throw createError(req.t('errors:ai.invalidProvider', { provider }) || `Unknown AI provider: ${provider}`, 400, 'INVALID_PROVIDER');
  }

  await platformAiConfigRepository.removeKey(provider);
  platformKeyCache.invalidate(provider);

  auditLog(req, 'ai-provider.key-removed', 'platform_ai_config', provider, { provider });

  res.json({ success: true, provider, hasKey: false });
}));

app.post('/api/admin/ai-providers/:provider/fallback-key', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { provider } = req.params;
  if (!isKnownProvider(provider)) {
    throw createError(req.t('errors:ai.invalidProvider', { provider }) || `Unknown AI provider: ${provider}`, 400, 'INVALID_PROVIDER');
  }

  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    throw createError(req.t('errors:ai.keyRequired') || 'API key is required', 400, 'KEY_REQUIRED');
  }
  if (apiKey.length > 500) {
    throw createError(req.t('errors:ai.keyTooLong') || 'API key exceeds maximum length', 400, 'KEY_TOO_LONG');
  }

  const updated = await platformAiConfigRepository.upsertFallbackKey(provider, apiKey.trim());
  platformKeyCache.invalidate(provider);

  auditLog(req, 'ai-provider.fallback-key-set', 'platform_ai_config', provider, { provider });

  res.json({ success: true, provider, hasFallbackKey: true, maskedFallbackKey: updated.maskedFallbackKey });
}));

app.delete('/api/admin/ai-providers/:provider/fallback-key', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { provider } = req.params;
  if (!isKnownProvider(provider)) {
    throw createError(req.t('errors:ai.invalidProvider', { provider }) || `Unknown AI provider: ${provider}`, 400, 'INVALID_PROVIDER');
  }

  await platformAiConfigRepository.removeFallbackKey(provider);
  platformKeyCache.invalidate(provider);

  auditLog(req, 'ai-provider.fallback-key-removed', 'platform_ai_config', provider, { provider });

  res.json({ success: true, provider, hasFallbackKey: false });
}));

// ─── Admin: AI Provider Test Connection ─────────────────────────────────────

app.post('/api/admin/ai-providers/:provider/test', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { provider } = req.params;
  if (!isKnownProvider(provider)) {
    throw createError(req.t('errors:ai.invalidProvider', { provider }) || `Unknown AI provider: ${provider}`, 400, 'INVALID_PROVIDER');
  }

  const useFallback = req.query.useFallback === 'true';

  let apiKey: string | null;
  try {
    apiKey = useFallback
      ? await platformAiConfigRepository.getDecryptedFallbackKey(provider)
      : await platformAiConfigRepository.getDecryptedKey(provider);
  } catch (err) {
    if (err instanceof DecryptionKeyMismatchError) {
      res.json({
        success: false,
        error:
          req.t('errors:ai.keyDecryptFailed', { provider }) ||
          `Stored API key for ${provider} can no longer be decrypted (encryption key changed). Please re-enter the key.`,
        code: 'KEY_DECRYPT_FAILED',
        provider,
      });
      return;
    }
    throw err;
  }

  if (!apiKey) {
    res.json({
      success: false,
      error: req.t('errors:ai.testNoKey', { provider }) || `No API key configured for ${provider}`,
      provider,
    });
    return;
  }

  const config = await platformAiConfigRepository.findByProvider(provider);
  const model = config?.default_model || '';
  const apiUrl = providerBaseUrl(provider as AIProviderName);

  const start = Date.now();
  try {
    const aiProvider = selectAIProvider({ apiUrl, apiKey, provider: provider as AIProviderName });
    await generateText({
      model: aiProvider(model),
      prompt: 'Say "ok"',
      maxOutputTokens: 16,
    });
    const latencyMs = Date.now() - start;
    res.json({ success: true, ok: true, latencyMs, provider });
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    logger.warn('AI provider test failed', { provider, error: err.message });
    res.json({
      success: true,
      ok: false,
      error: err.message || 'Connection test failed',
      latencyMs,
      provider,
    });
  }
}));

// ─── Admin: AI Provider Default Model & Fallback Order ──────────────────────

app.patch('/api/admin/ai-providers/default-model', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { provider, model } = req.body;

  if (!provider || typeof provider !== 'string' || !isKnownProvider(provider)) {
    throw createError(req.t('errors:ai.invalidProvider', { provider }) || `Unknown AI provider: ${provider}`, 400, 'INVALID_PROVIDER');
  }
  if (!model || typeof model !== 'string') {
    throw createError(req.t('errors:ai.modelNotAvailable', { model, provider }) || `Model is required`, 400, 'INVALID_MODEL');
  }

  const config = await platformAiConfigRepository.findByProvider(provider);
  if (!config || !config.is_active) {
    throw createError(req.t('errors:ai.providerNotActive', { provider }) || `Provider ${provider} is not active`, 400, 'PROVIDER_NOT_ACTIVE');
  }
  if (config.models.length > 0 && !config.models.includes(model)) {
    throw createError(req.t('errors:ai.modelNotAvailable', { model, provider }) || `Model ${model} is not available for ${provider}`, 400, 'MODEL_NOT_AVAILABLE');
  }

  await billingConfigRepository.setDefaultAiProvider(provider, model);
  platformKeyCache.invalidate();

  auditLog(req, 'ai-provider.default-changed', 'platform_ai_config', provider, { provider, model });

  res.json({ success: true, defaultProvider: { provider, model } });
}));

app.patch('/api/admin/ai-providers/fallback-order', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { order } = req.body;

  if (!Array.isArray(order)) {
    throw createError(req.t('errors:ai.invalidFallbackOrder') || 'Fallback order must be an array', 400, 'INVALID_ORDER');
  }

  const uniqueOrder = new Set(order);
  if (uniqueOrder.size !== order.length) {
    throw createError(req.t('errors:ai.invalidFallbackOrder') || 'Fallback order must not contain duplicates', 400, 'INVALID_ORDER');
  }
  for (const p of order) {
    if (!isKnownProvider(p)) {
      throw createError(req.t('errors:ai.invalidFallbackOrder') || `Unknown provider in fallback order: ${p}`, 400, 'INVALID_ORDER');
    }
  }
  if (order.length !== KNOWN_AI_PROVIDERS.length) {
    throw createError(req.t('errors:ai.invalidFallbackOrder') || 'Fallback order must include all known providers', 400, 'INVALID_ORDER');
  }

  await billingConfigRepository.setAiFallbackOrder(order);
  platformKeyCache.invalidate();

  auditLog(req, 'ai-provider.fallback-order-changed', 'platform_ai_config', undefined, { order });

  res.json({ success: true, fallbackOrder: order });
}));

// Recon-specific AI model tier overrides.  Empty / missing value = inherit
// the platform-wide default model for that tier.
app.patch('/api/admin/ai-providers/recon-models', requireAuth, requireSuperAdmin, asyncHandler(async (req: any, res) => {
  const { small, medium, large } = req.body ?? {};

  const tiers: Array<['small' | 'medium' | 'large', unknown]> = [
    ['small', small],
    ['medium', medium],
    ['large', large],
  ];

  for (const [, value] of tiers) {
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw createError(req.t('errors:validation.invalid') || 'Recon model must be a string or null', 400, 'INVALID_BODY');
    }
  }

  for (const [tier, value] of tiers) {
    if (value === undefined) continue;
    const normalized = typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
    await billingConfigRepository.setReconModel(tier, normalized);
  }

  platformKeyCache.invalidate();

  const reconModels = await billingConfigRepository.getAllReconModels();

  auditLog(req, 'ai-provider.recon-models-changed', 'platform_ai_config', undefined, reconModels);

  res.json({ success: true, reconModels });
}));

// ─── User: AI Providers (public) ────────────────────────────────────────────

app.get('/api/me/ai-providers', requireAuth, asyncHandler(async (req: any, res) => {
  const configs = await platformAiConfigRepository.findActive();

  const providers = configs.map((c) => ({
    provider: c.provider,
    displayName: c.display_name,
    models: c.models || [],
    defaultModel: c.default_model || '',
  }));

  // Always include custom (OpenAI-compatible) option
  providers.push({
    provider: 'custom',
    displayName: 'Custom (OpenAI-compatible)',
    models: [],
    defaultModel: '',
  });

  // Determine user's subscription tier
  let tier: 'byo_keys' | 'managed_payg' = 'byo_keys';
  if (req.workspaceId) {
    const subscription = await subscriptionRepository.findByWorkspaceId(req.workspaceId);
    if (subscription) {
      const plan = await planRepository.findById(subscription.plan_id);
      if (plan && isPlanSlug(plan.slug)) {
        tier = PLANS[plan.slug].tier;
      }
    }
  }

  const hasPlatformKeys = configs.length > 0;
  const platformDefault = await billingConfigRepository.getDefaultAiProvider();

  res.json({
    success: true,
    providers,
    tier,
    hasPlatformKeys,
    platformDefault,
  });
}));

// ─── User: Feature Flags ────────────────────────────────────────────────────

app.get('/api/me/flags', requireAuth, asyncHandler(async (req: any, res) => {
  const orgId = req.workspaceId;
  if (!orgId) {
    throw createError((req as any).t('errors:workspace.notResolved'), 401, 'WORKSPACE_REQUIRED');
  }
  const flags = await resolveAllFlags(orgId);
  res.json({ success: true, flags });
}));

// Error handling middleware (must be last)
app.use(errorHandler);

export { app };

if (env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info('Gateway service started', {
      port: PORT,
      aiServiceUrl: env.AI_SERVICE_URL,
      testExecutorUrl: env.TEST_EXECUTOR_URL
    });

    startCleanupScheduler();

    seedFeatureFlags()
      .then(() => logger.info('Feature flags seeded'))
      .catch((err: any) => logger.error('Feature flags seed failed', { error: err.message }));

    if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
      seedAdminUser(env.ADMIN_EMAIL, env.ADMIN_PASSWORD, env.ADMIN_NAME)
        .then(() => logger.info('Admin user seeded'))
        .catch((err: any) => logger.error('Admin seed failed', { error: err.message }));
    }

    import('../services/qa-monitor-scheduler').then(({ startMonitorScheduler }) => {
      startMonitorScheduler();
    }).catch(err => {
      logger.warn('QA Monitor scheduler failed to start', { error: err.message });
    });
  });
}

