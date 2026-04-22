/**
 * ci-router.ts
 *
 * CI/CD integration endpoints.
 * Authenticated via API keys (not JWT).
 *
 * - POST /api/ci/scan           — Start a QA scan from CI pipeline
 * - GET  /api/ci/results/:id    — Get scan results (poll this until status=completed)
 *
 * Management endpoints (JWT auth):
 * - GET    /api/ci/keys         — List API keys for workspace
 * - POST   /api/ci/keys         — Create a new API key
 * - DELETE /api/ci/keys/:id     — Revoke an API key
 */

import express from 'express';
import axios from 'axios';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireApiKeyAuth, generateApiKey, hashApiKey } from '../middleware/api-key-auth';
import { asyncHandler, createError } from '../middleware/error-handler';
import { validate } from '../middleware/validation';
import { query } from '../../shared/database/connection';
import { createLogger } from '../../shared/logger/logger';
import { env } from '../config/env';

const router = express.Router();
const logger = createLogger('ci-router');

const qaLoopExecutorUrl = env.QA_LOOP_EXECUTOR_URL;

// ── Schemas ──────────────────────────────────────────────────────────────────

const ciScanSchema = z.object({
  targetUrl: z.string().url('targetUrl must be a valid URL'),
  qualityThreshold: z.number().min(0).max(100).optional().default(80),
  maxIterations: z.number().int().min(1).max(50).optional().default(5),
  failOnThreshold: z.boolean().optional().default(true),
  documentContext: z.string().max(50_000).optional(),
});

const createKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
});

// ── CI Scan endpoints (API Key auth) ─────────────────────────────────────────

/**
 * POST /api/ci/scan — Start a QA scan from CI pipeline
 */
router.post('/scan', requireApiKeyAuth, validate(ciScanSchema), asyncHandler(async (req: any, res) => {
  const { targetUrl, qualityThreshold, maxIterations, documentContext } = req.body;
  const workspaceId = req.workspaceId;

  logger.info('CI scan started', {
    workspaceId,
    targetUrl,
    apiKeyId: req.apiKeyId,
  });

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (workspaceId) headers['X-Workspace-ID'] = workspaceId;

    const response = await axios.post(
      `${qaLoopExecutorUrl}/api/sessions`,
      {
        targetUrl,
        qualityThreshold,
        maxIterations,
        workspaceId,
        documentContext,
      },
      { headers, timeout: 30_000 }
    );

    const sessionId = response.data?.session?.id;

    res.status(201).json({
      sessionId,
      status: 'running',
      message: req.t('success:ci.scanStarted'),
      resultsUrl: `/api/ci/results/${sessionId}`,
    });
  } catch (error: any) {
    logger.error('CI scan failed to start', {
      error: error.message,
      status: error.response?.status,
    });

    res.status(error.response?.status || 503).json({
      error: req.t('errors:service.ciScanStartFailed'),
      details: error.response?.data?.error || error.message,
    });
  }
}));

/**
 * GET /api/ci/results/:sessionId — Get scan results
 */
router.get('/results/:sessionId', requireApiKeyAuth, asyncHandler(async (req: any, res) => {
  const { sessionId } = req.params;

  try {
    // Get session
    const sessionRes = await axios.get(
      `${qaLoopExecutorUrl}/api/sessions/${sessionId}`,
      { timeout: 10_000 }
    );

    const session = sessionRes.data?.session || sessionRes.data;

    // Get bugs
    let bugs: any[] = [];
    try {
      const bugsRes = await axios.get(
        `${qaLoopExecutorUrl}/api/sessions/${sessionId}/bugs`,
        { timeout: 10_000 }
      );
      bugs = bugsRes.data?.bugs || bugsRes.data || [];
    } catch {}

    const qualityScore = session.quality_score || session.qualityScore || 0;
    const qualityThreshold = session.quality_threshold || 80;
    const isComplete = ['completed', 'stopped', 'failed'].includes(session.status);

    // CI-friendly response format
    const result: any = {
      sessionId: session.id,
      status: session.status,
      qualityScore,
      qualityThreshold,
      passed: isComplete ? qualityScore >= qualityThreshold : null,
      bugsFound: session.bugs_found || session.bugsFound || 0,
      testsGenerated: session.tests_generated || session.testsGenerated || 0,
      pagesExplored: session.pages_explored || session.pagesExplored || 0,
      startedAt: session.created_at || session.createdAt,
      completedAt: session.completed_at || session.completedAt || null,
    };

    // Include bugs summary for completed scans
    if (isComplete && bugs.length > 0) {
      result.bugs = bugs.map((b: any) => ({
        title: b.title,
        severity: b.severity,
        category: b.category,
        pageUrl: b.page_url || b.pageUrl,
      }));

      result.summary = {
        critical: bugs.filter((b: any) => b.severity === 'critical').length,
        high: bugs.filter((b: any) => b.severity === 'high').length,
        medium: bugs.filter((b: any) => b.severity === 'medium').length,
        low: bugs.filter((b: any) => b.severity === 'low').length,
      };
    }

    // Set appropriate HTTP status for CI
    // 200 = scan complete and passed
    // 200 = scan still running (check status field)
    // 422 = scan complete but failed quality threshold
    if (isComplete && !result.passed) {
      res.status(422).json(result);
    } else {
      res.json(result);
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      res.status(404).json({ error: req.t('errors:resource.scanNotFound') });
    } else {
      res.status(500).json({ error: req.t('errors:service.ciScanResultsFailed') });
    }
  }
}));

// ── API Key management (JWT auth) ────────────────────────────────────────────

/**
 * GET /api/ci/keys — List API keys for workspace
 */
router.get('/keys', requireAuth, asyncHandler(async (req: any, res) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: req.t('errors:validation.workspaceRequired') });

  const keys = await query<any>(
    `SELECT id, name, key_prefix, last_used_at, is_active, created_at
     FROM ci_api_keys
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId]
  );

  res.json(keys);
}));

/**
 * POST /api/ci/keys — Create a new API key
 */
router.post('/keys', requireAuth, validate(createKeySchema), asyncHandler(async (req: any, res) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: req.t('errors:validation.workspaceRequired') });

  const { name } = req.body;
  const { key, hash, prefix } = generateApiKey();

  await query(
    `INSERT INTO ci_api_keys (workspace_id, name, key_hash, key_prefix, created_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [workspaceId, name, hash, prefix, req.user?.id || null]
  );

  logger.info('CI API key created', { workspaceId, name });

  // Return the full key ONCE (it won't be shown again)
  res.status(201).json({
    key,
    prefix,
    name,
    message: req.t('success:ci.apiKeySaved'),
  });
}));

/**
 * DELETE /api/ci/keys/:id — Revoke an API key
 */
router.delete('/keys/:id', requireAuth, asyncHandler(async (req: any, res) => {
  const workspaceId = req.workspaceId;

  const result = await query(
    `UPDATE ci_api_keys SET is_active = false, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2
     RETURNING id`,
    [req.params.id, workspaceId]
  );

  if (result.length === 0) {
    return res.status(404).json({ error: req.t('errors:resource.apiKeyNotFound') });
  }

  logger.info('CI API key revoked', { keyId: req.params.id });
  res.json({ success: true });
}));

export { router as ciRouter };
