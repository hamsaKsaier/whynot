/**
 * public-router.ts
 *
 * Public endpoints that do NOT require authentication.
 * Must be mounted BEFORE the `requireAuth` blanket in main.ts.
 *
 * - POST /api/public/scan     — Start a free public scan (rate limited: 3/day/IP)
 * - GET  /api/public/scan/:id — Get public scan results
 * - GET  /api/public/plans    — Get pricing plans for the landing page
 */

import express from 'express';
import axios from 'axios';
import { z } from 'zod';
import { asyncHandler, createError } from '../middleware/error-handler';
import { validate } from '../middleware/validation';
import { createLogger } from '../../shared/logger/logger';
import { query } from '../../shared/database/connection';
import { PlanRepository } from '../../shared/database/repositories/plan-repository';
import { env } from '../config/env';

const router = express.Router();
const logger = createLogger('public-router');

const qaLoopExecutorUrl = env.QA_LOOP_EXECUTOR_URL;

const planRepository = new PlanRepository();

// ── Rate Limiting (in-memory, per IP) ────────────────────────────────────────

const scanRateMap = new Map<string, { count: number; resetAt: number }>();
const MAX_SCANS_PER_DAY = 3;

function checkScanRateLimit(ip: string): void {
  const now = Date.now();
  const entry = scanRateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // Reset for the day
    scanRateMap.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return;
  }

  if (entry.count >= MAX_SCANS_PER_DAY) {
    throw createError(
      `Rate limit exceeded. You can run ${MAX_SCANS_PER_DAY} free scans per day. Sign up for unlimited access.`,
      429,
      'RATE_LIMIT_EXCEEDED',
      undefined,
      'errors:rateLimit.scanLimitExceeded',
      { maxScans: String(MAX_SCANS_PER_DAY) }
    );
  }

  entry.count++;
}

// Cleanup stale entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of scanRateMap.entries()) {
    if (now > entry.resetAt) scanRateMap.delete(ip);
  }
}, 60 * 60 * 1000);

// ── SSRF Protection ──────────────────────────────────────────────────────────

// In development, allow Docker-internal hostnames (e.g. http://test-app:4000)
const ALLOW_INTERNAL = env.NODE_ENV !== 'production' ||
  env.ALLOW_INTERNAL_SCAN;

function validatePublicUrl(url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    throw createError('targetUrl must be a valid URL', 400, 'VALIDATION_ERROR', undefined, 'errors:validation.urlInvalid');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw createError('targetUrl must use http or https', 400, 'VALIDATION_ERROR', undefined, 'errors:validation.urlProtocolRequired');
  }

  const host = parsed.hostname.toLowerCase();

  // Skip SSRF checks in development / when explicitly allowed
  if (ALLOW_INTERNAL) return;

  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    throw createError('Cannot scan localhost', 400, 'VALIDATION_ERROR', undefined, 'errors:validation.cannotScanLocalhost');
  }

  const privateRanges = [/^10\./, /^192\.168\./, /^172\/(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./, /^127\./];
  if (privateRanges.some(r => r.test(host))) {
    throw createError('Cannot scan private network addresses', 400, 'VALIDATION_ERROR', undefined, 'errors:validation.cannotScanPrivateNetwork');
  }
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const publicScanSchema = z.object({
  targetUrl: z.string().url('targetUrl must be a valid URL'),
  email: z.string().email('Invalid email').optional(),
});

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/public/scan — Start a free public scan
 */
router.post('/scan', validate(publicScanSchema), asyncHandler(async (req, res) => {
  const { targetUrl, email } = req.body;
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress || 'unknown';

  // Rate limit check
  checkScanRateLimit(ip);

  // SSRF check
  validatePublicUrl(targetUrl);

  logger.info('Public scan requested', { targetUrl, ip, email: email || null });

  try {
    // Start a tightly limited QA session for free public scans
    // - 2 iterations max (keeps API costs low)
    // - 5-minute hard cap (prevents runaway sessions)
    const response = await axios.post(
      `${qaLoopExecutorUrl}/api/sessions`,
      {
        targetUrl,
        qualityThreshold: 80,
        maxIterations: 2,
        maxDurationHours: 1,  // 1 hour cap for free scans (2 iterations finish well within this)
        workspaceId: null,
        config: { isPublicScan: true },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30_000,
      }
    );

    const sessionId = response.data?.session?.id;

    // Record the public scan request (for analytics & rate limiting persistence)
    if (sessionId) {
      try {
        await query(
          `INSERT INTO public_scan_requests (session_id, ip_address, email, target_url)
           VALUES ($1, $2, $3, $4)`,
          [sessionId, ip, email || null, targetUrl]
        );
      } catch (dbError: any) {
        logger.warn('Failed to record public scan', { error: dbError.message });
      }
    }

    res.status(201).json({
      sessionId,
      message: (req as any).t('success:scan.started'),
    });
  } catch (error: any) {
    logger.error('Failed to start public scan', {
      error: error.message,
      status: error.response?.status,
    });

    if (error.response) {
      res.status(error.response.status).json({
        error: (req as any).t('errors:service.scanStartFailed'),
        details: error.response.data?.error || (req as any).t('errors:service.unavailable'),
      });
    } else {
      res.status(503).json({
        error: (req as any).t('errors:service.scanUnavailable'),
      });
    }
  }
}));

/**
 * GET /api/public/scan/:sessionId — Get public scan results
 */
router.get('/scan/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  try {
    // Fetch session details
    const sessionResponse = await axios.get(
      `${qaLoopExecutorUrl}/api/sessions/${sessionId}`,
      { headers: { 'Content-Type': 'application/json' }, timeout: 10_000 }
    );

    const sessionData = sessionResponse.data;
    const session = sessionData?.session || sessionData;

    // Fetch bugs
    let bugs: any[] = [];
    try {
      const bugsResponse = await axios.get(
        `${qaLoopExecutorUrl}/api/sessions/${sessionId}/bugs`,
        { headers: { 'Content-Type': 'application/json' }, timeout: 10_000 }
      );
      bugs = bugsResponse.data?.bugs || bugsResponse.data || [];
    } catch {
      // Bugs may not be available yet
    }

    // Extract test cases from session data (executor returns them at top level)
    const testCases: any[] = sessionData?.testCases || session.testCases || [];

    res.json({
      session: {
        id: session.id,
        target_url: session.target_url || session.targetUrl,
        status: session.status,
        quality_score: session.quality_score || session.qualityScore || 0,
        bugs_found: session.bugs_found || session.bugsFound || 0,
        tests_generated: session.tests_generated || session.testsGenerated || 0,
        pages_explored: session.pages_explored || session.pagesExplored || 0,
        created_at: session.created_at || session.createdAt,
        completed_at: session.completed_at || session.completedAt || null,
      },
      bugs: bugs.map((b: any) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        severity: b.severity,
        category: b.category,
        page_url: b.page_url || b.pageUrl,
        reproduction_steps: b.reproduction_steps || b.reproductionSteps || [],
      })),
      testCases: testCases.map((tc: any) => ({
        id: tc.id,
        name: tc.name,
        category: tc.category,
        last_run_status: tc.last_run_status || tc.lastRunStatus || null,
        source_page_url: tc.source_page_url || tc.sourcePageUrl || null,
      })),
    });
  } catch (error: any) {
    if (error.response?.status === 404) {
      res.status(404).json({ error: (req as any).t('errors:resource.scanNotFound') });
    } else {
      logger.error('Failed to get public scan results', {
        sessionId,
        error: error.message,
      });
      res.status(500).json({ error: (req as any).t('errors:service.scanResultsFailed') });
    }
  }
}));

/**
 * GET /api/public/plans — Get pricing plans for the landing page
 */
router.get('/plans', asyncHandler(async (_req, res) => {
  try {
    const plans = await planRepository.findPublicPlans();

    const plansWithFeatures = await Promise.all(
      plans.map(async (plan) => {
        let features = {};
        try {
          const featureRows = await query<{ feature_key: string; feature_value: string }>(
            'SELECT feature_key, feature_value FROM plan_features WHERE plan_id = $1',
            [plan.id]
          );
          features = featureRows.reduce((acc: Record<string, any>, f) => {
            const num = Number(f.feature_value);
            acc[f.feature_key] = isNaN(num) ? (f.feature_value === 'true' ? true : f.feature_value) : num;
            return acc;
          }, {});
        } catch {
          // features table may not exist
        }

        return {
          id: plan.id,
          name: plan.name,
          monthly_credits: plan.credits_per_period,
          price_monthly: Math.round(plan.price_cents / 100),
          features,
        };
      })
    );

    res.json(plansWithFeatures);
  } catch (error: any) {
    logger.warn('Failed to load public plans', { error: error.message });
    res.json([]); // Return empty array if plans can't be loaded
  }
}));

export { router as publicRouter };
