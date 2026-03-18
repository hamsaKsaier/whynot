import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { createLogger } from '../../../shared/logger/logger';
import { QALoopRepository } from '../repositories/qa-loop-repository';
import { RetestExecutor } from '../retest-executor';
import { ChangeDetector } from '../change-detector';
import { APIKeyManager, APIKey } from './api-key-manager';
import { NotificationService } from '../notifications/notification-service';
import { LoopOrchestrator } from '../loop-orchestrator';

const router = Router();
const logger = createLogger('qa-loop-webhook');
const qaLoopRepository = new QALoopRepository();
const apiKeyManager = new APIKeyManager();
const notificationService = new NotificationService();

// Pending webhook callbacks
const pendingCallbacks = new Map<string, {
  callbackUrl: string;
  projectId: string;
  startedAt: Date;
}>();

// Extend Request type to include apiKey
interface AuthenticatedRequest extends Request {
  apiKey?: APIKey;
  startTime?: number;
}

// ==================== AUTHENTICATION MIDDLEWARE (Phase 9) ====================

/**
 * API Key authentication middleware
 * Validates X-QALoop-Key header and optional HMAC signature
 */
async function authenticateAPIKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  req.startTime = Date.now();

  const apiKey = req.headers['x-qaloop-key'] as string;
  const signature = req.headers['x-qaloop-signature'] as string;
  const timestamp = req.headers['x-qaloop-timestamp'] as string;

  // Allow unauthenticated access if auth is disabled (for backwards compatibility)
  if (!apiKey && process.env.WEBHOOK_AUTH_OPTIONAL === 'true') {
    return next();
  }

  if (!apiKey) {
    res.status(401).json({
      error: 'Authentication required',
      hint: 'Include X-QALoop-Key header with your API key'
    });
    return;
  }

  // Validate API key
  const validation = await apiKeyManager.validateAPIKey(apiKey);

  if (!validation.isValid) {
    res.status(401).json({
      error: 'Invalid API key',
      details: validation.error
    });
    return;
  }

  // Verify HMAC signature if provided
  if (signature && timestamp) {
    const body = JSON.stringify(req.body);
    const hmacResult = apiKeyManager.verifyHMACSignature(apiKey, body, signature, timestamp);

    if (!hmacResult.isValid) {
      res.status(401).json({
        error: 'Invalid signature',
        details: hmacResult.error
      });
      return;
    }
  }

  // Check rate limit
  const rateLimit = await apiKeyManager.checkRateLimit(validation.apiKey!.id);

  if (!rateLimit.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      limit: validation.apiKey!.rateLimitPerHour,
      remaining: rateLimit.remaining,
      resetAt: rateLimit.resetAt.toISOString()
    });
    return;
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', validation.apiKey!.rateLimitPerHour.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', rateLimit.resetAt.toISOString());

  // Attach API key to request for later use
  req.apiKey = validation.apiKey;

  next();
}

/**
 * Request logging middleware
 */
async function logWebhookRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const originalSend = res.send;

  res.send = function (body: any): Response {
    const duration = Date.now() - (req.startTime || Date.now());

    // Log the request (async, don't wait)
    apiKeyManager.logWebhookRequest({
      apiKeyId: req.apiKey?.id || null,
      endpoint: req.path,
      method: req.method,
      requestBody: req.body,
      responseStatus: res.statusCode,
      responseBody: typeof body === 'string' ? JSON.parse(body) : body,
      ipAddress: req.ip || req.socket?.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
      durationMs: duration
    }).catch(err => {
      logger.warn('Failed to log webhook request', { error: err.message });
    });

    return originalSend.call(this, body);
  };

  next();
}

// Apply authentication middleware to all webhook routes
router.use(authenticateAPIKey);
router.use(logWebhookRequest);

/**
 * Webhook endpoint for CI/CD integration
 * Triggers a retest and optionally sends results to a callback URL
 */
router.post('/webhook/retest', async (req: Request, res: Response) => {
  try {
    const {
      project_id,
      session_id,
      mode = 'quick',
      callback_url,
      api_key, // Optional API key for authentication
      include_report = true
    } = req.body;

    // Validate required fields
    if (!project_id && !session_id) {
      return res.status(400).json({
        error: 'Either project_id or session_id is required'
      });
    }

    // Find the session to retest
    let sourceSession;
    if (session_id) {
      sourceSession = await qaLoopRepository.getSession(session_id);
    } else {
      // Get the most recent completed session for the project
      const { sessions } = await qaLoopRepository.listSessions({
        projectId: project_id,
        status: 'completed',
        limit: 1,
        offset: 0
      });
      sourceSession = sessions[0];
    }

    if (!sourceSession) {
      return res.status(404).json({
        error: 'No completed exploration session found',
        hint: 'Run an exploration first before triggering a retest'
      });
    }

    // Create a new retest session
    const retestSession = await qaLoopRepository.createSession({
      projectId: sourceSession.project_id || undefined,
      targetUrl: sourceSession.target_url,
      mode: mode === 'smart' ? 'smart_retest' : 'retest',
      qualityThreshold: sourceSession.quality_threshold,
      maxIterations: 1,
      config: {
        sourceSessionId: sourceSession.id,
        triggeredBy: 'webhook',
        callbackUrl: callback_url
      }
    });

    const runId = uuidv4();

    // Store callback info if provided
    if (callback_url) {
      pendingCallbacks.set(runId, {
        callbackUrl: callback_url,
        projectId: project_id || sourceSession.project_id,
        startedAt: new Date()
      });
    }

    logger.info('Webhook triggered retest', {
      runId,
      sourceSessionId: sourceSession.id,
      retestSessionId: retestSession.id,
      mode,
      hasCallback: !!callback_url
    });

    // Start retest asynchronously
    const retestExecutor = new RetestExecutor(retestSession.id, sourceSession.id, mode);

    retestExecutor.run().then(async (results) => {
      await qaLoopRepository.updateSessionStatus(retestSession.id, 'completed');
      await qaLoopRepository.createTestSuiteFromSession(retestSession.id);

      // Send callback if configured
      const callbackInfo = pendingCallbacks.get(runId);
      if (callbackInfo?.callbackUrl) {
        await sendCallback(callbackInfo.callbackUrl, {
          run_id: runId,
          session_id: retestSession.id,
          source_session_id: sourceSession.id,
          status: 'completed',
          results: include_report ? results : undefined,
          summary: {
            total: results.totalTests,
            passed: results.passed,
            failed: results.failed,
            skipped: results.skipped,
            errors: results.errors,
            self_healed: results.selfHealed,
            duration_ms: results.duration,
            change_report: results.changeReport
          },
          completed_at: new Date().toISOString()
        });
        pendingCallbacks.delete(runId);
      }

      logger.info('Webhook retest completed', {
        runId,
        passed: results.passed,
        failed: results.failed
      });

    }).catch(async (error) => {
      await qaLoopRepository.updateSessionStatus(retestSession.id, 'failed', error.message);

      // Send error callback
      const callbackInfo = pendingCallbacks.get(runId);
      if (callbackInfo?.callbackUrl) {
        await sendCallback(callbackInfo.callbackUrl, {
          run_id: runId,
          session_id: retestSession.id,
          status: 'failed',
          error: error.message,
          completed_at: new Date().toISOString()
        });
        pendingCallbacks.delete(runId);
      }

      logger.error('Webhook retest failed', {
        runId,
        error: error.message
      });
    });

    // Return immediately with run info
    res.status(202).json({
      success: true,
      run_id: runId,
      session_id: retestSession.id,
      source_session_id: sourceSession.id,
      status: 'started',
      mode,
      callback_url: callback_url ? 'configured' : 'not_configured',
      message: 'Retest started. Results will be sent to callback URL when complete.'
    });

  } catch (error: any) {
    logger.error('Webhook handler error', { error: error.message });
    res.status(500).json({
      error: 'Failed to process webhook',
      details: error.message
    });
  }
});

/**
 * Check status of a webhook-triggered run
 */
router.get('/webhook/status/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;

    const callbackInfo = pendingCallbacks.get(runId);

    if (callbackInfo) {
      res.json({
        run_id: runId,
        status: 'running',
        started_at: callbackInfo.startedAt.toISOString(),
        elapsed_ms: Date.now() - callbackInfo.startedAt.getTime()
      });
    } else {
      res.json({
        run_id: runId,
        status: 'completed_or_not_found',
        message: 'Run has completed, was not found, or callback was already sent'
      });
    }

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Detect changes without running tests
 */
router.post('/webhook/detect-changes', async (req: Request, res: Response) => {
  try {
    const { project_id, session_id } = req.body;

    // Find the session to check
    let sourceSession;
    if (session_id) {
      sourceSession = await qaLoopRepository.getSession(session_id);
    } else {
      const { sessions } = await qaLoopRepository.listSessions({
        projectId: project_id,
        status: 'completed',
        limit: 1,
        offset: 0
      });
      sourceSession = sessions[0];
    }

    if (!sourceSession) {
      return res.status(404).json({
        error: 'No completed session found'
      });
    }

    const changeDetector = new ChangeDetector(sourceSession.id);
    const changes = await changeDetector.detectChanges();
    const affectedTests = await changeDetector.getAffectedTests(changes);

    res.json({
      success: true,
      session_id: sourceSession.id,
      changes: {
        total_checked: changes.totalChecked,
        changed_pages: changes.changedPages.length,
        new_pages: changes.newPages.length,
        removed_pages: changes.removedPages.length,
        unchanged: changes.unchangedCount,
        affected_tests: affectedTests.length,
        detection_duration_ms: changes.detectionDurationMs
      },
      changed_pages: changes.changedPages,
      new_pages: changes.newPages.slice(0, 10), // Limit response size
      affected_test_ids: affectedTests.slice(0, 20)
    });

  } catch (error: any) {
    logger.error('Change detection webhook error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GitHub Actions integration endpoint
 */
router.post('/webhook/github-actions', async (req: Request, res: Response) => {
  try {
    const {
      repository,
      ref,
      sha,
      project_id,
      session_id,
      mode = 'smart',
      github_token
    } = req.body;

    // Determine source session
    let sourceSession;
    if (session_id) {
      sourceSession = await qaLoopRepository.getSession(session_id);
    } else if (project_id) {
      const { sessions } = await qaLoopRepository.listSessions({
        projectId: project_id,
        status: 'completed',
        limit: 1,
        offset: 0
      });
      sourceSession = sessions[0];
    }

    if (!sourceSession) {
      return res.status(404).json({
        error: 'No completed exploration session found'
      });
    }

    // Create retest session with GitHub metadata
    const retestSession = await qaLoopRepository.createSession({
      projectId: sourceSession.project_id || undefined,
      targetUrl: sourceSession.target_url,
      mode: mode === 'smart' ? 'smart_retest' : 'retest',
      qualityThreshold: sourceSession.quality_threshold,
      maxIterations: 1,
      config: {
        sourceSessionId: sourceSession.id,
        triggeredBy: 'github_actions',
        github: {
          repository,
          ref,
          sha
        }
      }
    });

    // Run retest
    const retestExecutor = new RetestExecutor(retestSession.id, sourceSession.id, mode);

    // For GitHub Actions, we want synchronous results
    const results = await retestExecutor.run();
    await qaLoopRepository.updateSessionStatus(retestSession.id, 'completed');
    await qaLoopRepository.createTestSuiteFromSession(retestSession.id);

    // Update GitHub commit status if token provided
    if (github_token && repository && sha) {
      await updateGitHubStatus(github_token, repository, sha, results);
    }

    // Return results in GitHub-friendly format
    res.json({
      success: results.failed === 0 && results.errors === 0,
      session_id: retestSession.id,
      conclusion: results.failed === 0 && results.errors === 0 ? 'success' : 'failure',
      summary: {
        total: results.totalTests,
        passed: results.passed,
        failed: results.failed,
        errors: results.errors,
        self_healed: results.selfHealed
      },
      duration_ms: results.duration,
      change_report: results.changeReport ? {
        pages_changed: results.changeReport.changedPages.length,
        pages_new: results.changeReport.newPages.length
      } : undefined,
      details_url: `/api/qa-loop/sessions/${retestSession.id}`
    });

  } catch (error: any) {
    logger.error('GitHub Actions webhook error', { error: error.message });
    res.status(500).json({
      success: false,
      conclusion: 'failure',
      error: error.message
    });
  }
});

async function sendCallback(url: string, data: any): Promise<void> {
  try {
    await axios.post(url, data, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'QALoop-Webhook/1.0'
      }
    });
    logger.info('Callback sent successfully', { url });
  } catch (error: any) {
    logger.error('Failed to send callback', { url, error: error.message });
  }
}

async function updateGitHubStatus(
  token: string,
  repository: string,
  sha: string,
  results: any
): Promise<void> {
  try {
    const state = results.failed === 0 && results.errors === 0 ? 'success' : 'failure';
    const description = `${results.passed}/${results.totalTests} tests passed`;

    await axios.post(
      `https://api.github.com/repos/${repository}/statuses/${sha}`,
      {
        state,
        description,
        context: 'QA Loop / Retest',
        target_url: undefined // Could add a URL to results page
      },
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'QALoop-Webhook/1.0'
        }
      }
    );
    logger.info('GitHub status updated', { repository, sha, state });
  } catch (error: any) {
    logger.warn('Failed to update GitHub status', { error: error.message });
  }
}

// ==================== PHASE 9: NEW WEBHOOK ENDPOINTS ====================

/**
 * Trigger a new exploration session via webhook
 */
router.post('/webhook/trigger', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      target_url,
      project_id,
      quality_threshold = 80,
      max_iterations = 10,
      max_duration_hours = 2,
      mode = 'explore',
      enable_chaos = true,
      enable_detective = true,
      max_budget_cents,
      callback_url,
      notify = true
    } = req.body;

    // Validate required fields
    if (!target_url) {
      return res.status(400).json({
        error: 'target_url is required'
      });
    }

    // Check permission
    if (req.apiKey && !req.apiKey.permissions.includes('trigger')) {
      return res.status(403).json({
        error: 'API key does not have permission to trigger sessions'
      });
    }

    // Create the session
    const session = await qaLoopRepository.createSession({
      projectId: project_id,
      targetUrl: target_url,
      mode,
      qualityThreshold: quality_threshold,
      maxIterations: max_iterations,
      config: {
        maxDurationHours: max_duration_hours,
        enableChaos: enable_chaos,
        enableDetective: enable_detective,
        maxBudgetCents: max_budget_cents,
        triggeredBy: 'webhook',
        apiKeyId: req.apiKey?.id,
        callbackUrl: callback_url
      }
    });

    const runId = uuidv4();

    // Store callback if provided
    if (callback_url) {
      pendingCallbacks.set(runId, {
        callbackUrl: callback_url,
        projectId: project_id,
        startedAt: new Date()
      });
    }

    // Start the QA loop asynchronously
    const orchestrator = new LoopOrchestrator(session.id, {
      targetUrl: target_url,
      mode,
      qualityThreshold: quality_threshold,
      maxIterations: max_iterations,
      maxDurationHours: max_duration_hours,
      enableChaos: enable_chaos,
      enableDetective: enable_detective,
      maxBudgetCents: max_budget_cents
    });

    orchestrator.start().then(async () => {
      const updatedSession = await qaLoopRepository.getSession(session.id);

      // Send callback
      const callbackInfo = pendingCallbacks.get(runId);
      if (callbackInfo?.callbackUrl) {
        await sendCallback(callbackInfo.callbackUrl, {
          run_id: runId,
          session_id: session.id,
          status: 'completed',
          quality_score: updatedSession?.quality_score,
          completed_at: new Date().toISOString()
        });
        pendingCallbacks.delete(runId);
      }

      // Send notification
      if (notify) {
        await notificationService.notifySessionComplete(session.id, {
          qualityScore: updatedSession?.quality_score || 0,
          testsGenerated: updatedSession?.tests_generated || 0,
          bugsFound: updatedSession?.bugs_found || 0,
          duration: `${Math.round((Date.now() - new Date(session.created_at).getTime()) / 60000)}min`
        });
      }
    }).catch(async (error) => {
      // Send failure callback
      const callbackInfo = pendingCallbacks.get(runId);
      if (callbackInfo?.callbackUrl) {
        await sendCallback(callbackInfo.callbackUrl, {
          run_id: runId,
          session_id: session.id,
          status: 'failed',
          error: error.message,
          completed_at: new Date().toISOString()
        });
        pendingCallbacks.delete(runId);
      }

      // Send failure notification
      if (notify) {
        await notificationService.notifySessionFailed(session.id, error.message);
      }
    });

    logger.info('Webhook triggered exploration', {
      runId,
      sessionId: session.id,
      targetUrl: target_url
    });

    res.status(202).json({
      success: true,
      run_id: runId,
      session_id: session.id,
      status: 'started',
      mode,
      target_url,
      callback_url: callback_url ? 'configured' : 'not_configured',
      message: 'QA session started. Results will be sent to callback URL when complete.'
    });

  } catch (error: any) {
    logger.error('Webhook trigger error', { error: error.message });
    res.status(500).json({
      error: 'Failed to trigger session',
      details: error.message
    });
  }
});

// ==================== API KEY MANAGEMENT ENDPOINTS ====================

/**
 * Create a new API key (requires admin permission)
 */
router.post('/api/api-keys', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Only API keys with admin permission can create new API keys
    if (req.apiKey && !req.apiKey.permissions.includes('admin')) {
      return res.status(403).json({ error: 'Admin permission required' });
    }

    const { name, permissions, rate_limit_per_hour, expires_in_days } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const apiKey = await apiKeyManager.createAPIKey({
      name,
      permissions,
      rateLimitPerHour: rate_limit_per_hour,
      expiresInDays: expires_in_days
    });

    res.status(201).json({
      success: true,
      api_key: apiKey,
      warning: 'Save the key now - it will not be shown again!'
    });

  } catch (error: any) {
    logger.error('Failed to create API key', { error: error.message });
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

/**
 * List all API keys
 */
router.get('/api/api-keys', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const includeRevoked = req.query.include_revoked === 'true';
    const keys = await apiKeyManager.listAPIKeys(includeRevoked);

    res.json({
      api_keys: keys.map(k => ({
        id: k.id,
        name: k.name,
        key_prefix: k.keyPrefix,
        permissions: k.permissions,
        rate_limit_per_hour: k.rateLimitPerHour,
        last_used_at: k.lastUsedAt,
        expires_at: k.expiresAt,
        created_at: k.createdAt,
        revoked_at: k.revokedAt
      }))
    });

  } catch (error: any) {
    logger.error('Failed to list API keys', { error: error.message });
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

/**
 * Revoke an API key
 */
router.delete('/api/api-keys/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await apiKeyManager.revokeAPIKey(id);

    res.json({ success: true, message: 'API key revoked' });

  } catch (error: any) {
    logger.error('Failed to revoke API key', { error: error.message });
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

/**
 * Get webhook logs
 */
router.get('/api/webhook-logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { api_key_id, limit = '50', offset = '0' } = req.query;

    const logs = await apiKeyManager.getWebhookLogs({
      apiKeyId: api_key_id as string,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10)
    });

    res.json({ logs });

  } catch (error: any) {
    logger.error('Failed to get webhook logs', { error: error.message });
    res.status(500).json({ error: 'Failed to get webhook logs' });
  }
});

// ==================== NOTIFICATION CHANNEL MANAGEMENT ====================

/**
 * Create notification channel
 */
router.post('/api/notification-channels', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, channel_type, config } = req.body;

    if (!name || !channel_type || !config) {
      return res.status(400).json({
        error: 'name, channel_type, and config are required'
      });
    }

    const channel = await notificationService.createChannel(name, channel_type, config);

    res.status(201).json({ success: true, channel });

  } catch (error: any) {
    logger.error('Failed to create notification channel', { error: error.message });
    res.status(500).json({ error: 'Failed to create notification channel' });
  }
});

/**
 * List notification channels
 */
router.get('/api/notification-channels', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeOnly = req.query.active_only === 'true';
    const channels = await notificationService.listChannels(activeOnly);

    res.json({ channels });

  } catch (error: any) {
    logger.error('Failed to list notification channels', { error: error.message });
    res.status(500).json({ error: 'Failed to list notification channels' });
  }
});

/**
 * Delete notification channel
 */
router.delete('/api/notification-channels/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await notificationService.deleteChannel(id);

    res.json({ success: true });

  } catch (error: any) {
    logger.error('Failed to delete notification channel', { error: error.message });
    res.status(500).json({ error: 'Failed to delete notification channel' });
  }
});

/**
 * Test notification channel
 */
router.post('/api/notification-channels/:id/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const channels = await notificationService.listChannels();
    const channel = channels.find(c => c.id === req.params.id);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    await notificationService.notify({
      type: 'custom',
      title: 'Test Notification',
      message: 'This is a test notification from QA Loop.',
      severity: 'info',
      metadata: {
        'Channel': channel.name,
        'Type': channel.channelType
      }
    });

    res.json({ success: true, message: 'Test notification sent' });

  } catch (error: any) {
    logger.error('Failed to send test notification', { error: error.message });
    res.status(500).json({ error: 'Failed to send test notification', details: error.message });
  }
});

export default router;
