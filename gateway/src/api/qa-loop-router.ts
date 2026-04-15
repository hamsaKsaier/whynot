/**
 * qa-loop-router.ts
 *
 * Dedicated Express router for all /api/qa-loop/** proxy endpoints (5.2).
 *
 * Key improvements vs. the old inline code in main.ts:
 *  - Single shared CircuitBreaker instance (same behaviour, moved here)
 *  - Generic createProxy() replaces 18 copy-pasted withQALoopBreaker handlers
 *  - Zod schemas validate every mutating endpoint's request body (5.3)
 */

import express, { RequestHandler } from 'express';
import axios from 'axios';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/error-handler';
import { validate } from '../middleware/validation';
import { qaLoopSessionRateLimiter } from '../middleware/rate-limit';
import { requireCredits, deductCredits } from '../middleware/credit-gate';
import { recordUsageEvent } from '../utils/usage-tracker';
import { requireFeature } from '../middleware/feature-gate';
import { requireActiveSubscription } from '../middleware/subscription-check';
import { createLogger } from '../../shared/logger/logger';
import { ProjectRepository } from '../../shared/database/repositories/project-repository';
import { env } from '../config/env';

const router  = express.Router();
const logger  = createLogger('qa-loop-router');
const projectRepository = new ProjectRepository();

const qaLoopExecutorUrl = env.QA_LOOP_EXECUTOR_URL;

// ── Helpers ────────────────────────────────────────────────────────────────────

function qaLoopHeaders(req: express.Request): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (req.workspaceId) headers['X-Workspace-ID'] = req.workspaceId;
  if (req.user?.id)   headers['X-User-ID']       = req.user.id;
  return headers;
}

/**
 * SSRF protection — reject private / loopback targets before proxying (3.8).
 */
function validateTargetUrl(url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    throw createError('targetUrl must be a valid URL', 400, 'VALIDATION_ERROR');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw createError('targetUrl must use http or https', 400, 'VALIDATION_ERROR');
  }

  const host = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    throw createError('targetUrl may not point to localhost', 400, 'VALIDATION_ERROR');
  }

  // Block IPv4 private ranges
  const privateRanges = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^169\.254\./,
    /^0\./,
    /^127\./,
  ];
  if (privateRanges.some(r => r.test(host))) {
    throw createError('targetUrl may not point to a private network address', 400, 'VALIDATION_ERROR');
  }

  // Block IPv6 private ranges: ULA (fc00::/7), link-local (fe80::/10), IPv4-mapped private
  const ipv6PrivatePatterns = [
    /^f[cd][0-9a-f]{2}:/i,                    // fc00::/7 (ULA)
    /^fe[89ab][0-9a-f]:/i,                    // fe80::/10 (link-local)
    /^::ffff:(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/i, // IPv4-mapped private
    /^::ffff:0\./i,                            // IPv4-mapped 0.x
  ];
  if (ipv6PrivatePatterns.some(r => r.test(host))) {
    throw createError('targetUrl may not point to a private network address', 400, 'VALIDATION_ERROR');
  }

  // Block decimal IP notation (e.g., 2130706433 = 127.0.0.1)
  if (/^\d+$/.test(host)) {
    throw createError('targetUrl may not use decimal IP notation', 400, 'VALIDATION_ERROR');
  }
}

function forwardQALoopError(error: any, label: string, req: express.Request, res: express.Response): void {
  logger.error(`QA Loop proxy error: ${label}`, {
    message: error.message,
    status: error.response?.status,
  });
  if (error.response) {
    res.status(error.response.status).json(error.response.data);
  } else {
    res.status(500).json({ error: label, details: (req as any).t('errors:service.unavailable') });
  }
}

// ── Circuit Breaker ────────────────────────────────────────────────────────────

type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

class CircuitBreaker {
  private state: CBState = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly name: string,
    private readonly failureThreshold = 5,
    private readonly recoveryTimeMs   = 30_000,
  ) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeMs) {
        throw Object.assign(
          new Error(`Circuit breaker [${this.name}] is OPEN — service unavailable`),
          { isCircuitOpen: true },
        );
      }
      this.state = 'HALF_OPEN';
      logger.info(`Circuit breaker [${this.name}] HALF_OPEN — probing service`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err: any) {
      this.onFailure(err);
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state !== 'CLOSED') {
      logger.info(`Circuit breaker [${this.name}] CLOSED — service recovered`);
    }
    this.state    = 'CLOSED';
    this.failures = 0;
  }

  private onFailure(error: any): void {
    const status = error.response?.status;
    if (status && status >= 400 && status < 500) return; // don't trip on 4xx

    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold && this.state !== 'OPEN') {
      logger.warn(`Circuit breaker [${this.name}] OPEN after ${this.failures} failures`);
      this.state = 'OPEN';
    }
  }
}

const qaLoopBreaker = new CircuitBreaker('qa-loop-executor');

async function withQALoopBreaker<T>(
  req: express.Request,
  res: express.Response,
  label: string,
  fn: () => Promise<T>,
): Promise<T | void> {
  try {
    return await qaLoopBreaker.call(fn);
  } catch (error: any) {
    if (error.isCircuitOpen) {
      res.status(503).json({
        error:   (req as any).t('errors:service.qaLoopCircuitOpen'),
        details: label,
      });
      return;
    }
    forwardQALoopError(error, label, req, res);
  }
}

// ── Zod schemas (5.3) ─────────────────────────────────────────────────────────

const loginCredentialsSchema = z.object({
  // Accept both email addresses and plain usernames (e.g. "Admin" for OrangeHRM)
  email:            z.string().min(1, 'Username or email is required'),
  password:         z.string().min(1, 'Password is required'),
  loginUrl:         z.string().url().optional(),
  emailSelector:    z.string().optional(),
  passwordSelector: z.string().optional(),
  submitSelector:   z.string().optional(),
}).optional();

export const qaLoopSchemas = {
  /** POST /sessions */
  startSession: z.object({
    targetUrl: z
      .string({ error: 'targetUrl is required' })
      .url('targetUrl must be a valid URL'),
    qualityThreshold: z.number().min(0).max(100).optional().default(80),
    maxIterations:    z.number().int().min(1).max(10_000).optional().default(3),
    documentContext:  z.string().max(50_000).optional(),
    testPriority:     z.enum(['functional_first', 'balanced', 'security_first']).optional(),
    sourceSessionId:  z.string().uuid().optional(),
    loginCredentials: loginCredentialsSchema,
  }),

  /** POST /sessions/:id/retest */
  retest: z.object({
    mode: z.enum(['quick', 'smart']).optional().default('quick'),
  }),

  /** POST /sessions/:id/documents */
  uploadDocument: z.object({
    filename: z.string()
      .min(1, 'filename is required')
      .max(255)
      .refine(
        (name) => /^[\w\-. ]+\.(txt|md|pdf|doc|docx|csv|json|xml|html|yml|yaml)$/i.test(name),
        'Invalid file type. Allowed: txt, md, pdf, doc, docx, csv, json, xml, html, yml, yaml'
      ),
    contentBase64: z.string()
      .max(10_485_760, 'File content must not exceed 10MB (base64)')  // ~7.5MB decoded
      .optional(),
    content: z.string()
      .max(5_000_000, 'File content must not exceed 5MB')
      .optional(),
  }).refine(
    d => d.contentBase64 !== undefined || d.content !== undefined,
    { message: 'Either contentBase64 or content must be provided' },
  ),

  /** PATCH /sessions/:id/documents/:docId */
  toggleDocument: z.object({
    isActive: z.boolean({ error: 'isActive is required' }),
  }),
};

// ── Generic proxy factory (5.2) ───────────────────────────────────────────────

interface ProxyOptions {
  /** HTTP status code to respond with (default 200) */
  status?: number;
  /** Timeout in ms (default 10 000) */
  timeout?: number;
  /** Extra middleware to run before the proxy handler */
  middleware?: RequestHandler[];
  /** Inject workspaceId into forwarded query params (GET) */
  injectWorkspaceQuery?: boolean;
  /** Inject workspaceId into forwarded body (POST) */
  injectWorkspaceBody?: boolean;
}

/**
 * Register a single proxy route on the router.
 *
 * Express path params (`:id`, `:docId`) are resolved to their actual values
 * before forwarding, so the executor receives clean numeric/UUID segments.
 */
function createProxy(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  label: string,
  opts: ProxyOptions = {},
): void {
  const {
    status = 200,
    timeout = 10_000,
    middleware = [],
    injectWorkspaceQuery = false,
    injectWorkspaceBody  = false,
  } = opts;

  const handler = asyncHandler(async (req: express.Request, res: express.Response) => {
    // Resolve :param placeholders in the Express path template
    const targetPath = path.replace(/:(\w+)/g, (_, p) => req.params[p]);
    const url = `${qaLoopExecutorUrl}/api${targetPath}`;
    const headers = qaLoopHeaders(req);

    await withQALoopBreaker(req, res, label, async () => {
      let response: any;

      if (method === 'get') {
        const params: Record<string, any> = { ...req.query };
        if (injectWorkspaceQuery && req.workspaceId) params.workspaceId = req.workspaceId;
        response = await axios.get(url, { params, headers, timeout });

      } else if (method === 'post') {
        const body = injectWorkspaceBody
          ? { ...req.body, workspaceId: req.workspaceId }
          : req.body;
        response = await axios.post(url, body, { headers, timeout });

      } else if (method === 'patch') {
        response = await axios.patch(url, req.body, { headers, timeout });

      } else {
        response = await axios.delete(url, { headers, timeout });
      }

      res.status(status).json(response.data);
    });
  });

  // All routes on this router already require auth (mounted under requireAuth in main.ts),
  // but we add it explicitly here too so the router can be used stand-alone in tests.
  (router as any)[method](path, requireAuth, ...middleware, handler);
}

// ── Routes ────────────────────────────────────────────────────────────────────
// NOTE: more-specific paths must be registered before wildcard ones.

// ── Session lifecycle ──────────────────────────────────────────────────────────

// Start session — rate-limited, SSRF-protected, Zod-validated, credit + feature gated
router.post(
  '/sessions',
  requireAuth,
  requireActiveSubscription,
  requireFeature('qa_loop'),
  requireCredits('QA_LOOP_SESSION_RESERVE'),
  qaLoopSessionRateLimiter,
  validate(qaLoopSchemas.startSession),
  asyncHandler(async (req, res) => {
    validateTargetUrl(req.body.targetUrl);

    // Auto-link or auto-create a project based on the target URL's domain.
    // NEVER reuse a workspace's "first" project — that leaks test cases across apps.
    if (!req.body.projectId && req.workspaceId) {
      try {
        let domain: string;
        try {
          domain = new URL(req.body.targetUrl).hostname;
        } catch {
          domain = req.body.targetUrl;
        }

        // Look for an existing project in this workspace that matches the domain
        const existing = await projectRepository.findByDomain(domain, req.workspaceId);
        if (existing) {
          req.body.projectId = existing.id;
          logger.info('Auto-linked session to project matching domain', {
            projectId: existing.id,
            domain,
          });
        } else {
          // Create a new project for this domain — never reuse a wrong project
          const project = await projectRepository.create({
            name: domain,
            website_url: req.body.targetUrl,
            workspace_id: req.workspaceId,
          });
          req.body.projectId = project.id;
          logger.info('Auto-created project for QA session by domain', {
            projectId: project.id,
            name: domain,
          });
        }
      } catch (err: any) {
        logger.warn('Failed to auto-create/select project, proceeding without', { error: err.message });
      }
    }

    await withQALoopBreaker(req, res, 'Failed to start QA Loop session', async () => {
      const response = await axios.post(
        `${qaLoopExecutorUrl}/api/sessions`,
        { ...req.body, workspaceId: req.workspaceId },
        { headers: qaLoopHeaders(req), timeout: 30_000 },
      );
      // Deduct credits after successful session creation
      if (req.workspaceId) {
        await deductCredits(req.workspaceId, 'QA_LOOP_SESSION_RESERVE', `Session ${response.data?.session?.id || 'new'}`).catch(() => {});
        recordUsageEvent({
          workspaceId: req.workspaceId,
          userId: req.user?.id,
          eventType: 'qa_loop_iteration',
          metadata: { sessionId: response.data?.session?.id },
        });
      }
      res.status(201).json(response.data);
    });
  }),
);

// Check for existing session by base URL (workspace-scoped, SSRF-protected)
router.get(
  '/sessions/check-existing',
  requireAuth,
  asyncHandler(async (req, res) => {
    const baseUrl = req.query.baseUrl as string | undefined;
    if (baseUrl) {
      validateTargetUrl(baseUrl);
    }
    await withQALoopBreaker(req, res, 'Failed to check existing session', async () => {
      const params: Record<string, any> = { ...req.query };
      if (req.workspaceId) params.workspaceId = req.workspaceId;
      const response = await axios.get(
        `${qaLoopExecutorUrl}/api/sessions/check-existing`,
        { params, headers: qaLoopHeaders(req), timeout: 10_000 }
      );
      res.json(response.data);
    });
  }),
);

// List sessions (workspace-scoped)
createProxy('get', '/sessions', 'Failed to list QA Loop sessions', {
  injectWorkspaceQuery: true,
});

// Get session details
createProxy('get', '/sessions/:id', 'Failed to get QA Loop session');

// Pause / Resume / Stop
createProxy('post', '/sessions/:id/pause',  'Failed to pause QA Loop session',  { status: 200, timeout: 10_000 });
createProxy('post', '/sessions/:id/resume', 'Failed to resume QA Loop session', { status: 200, timeout: 10_000 });
createProxy('post', '/sessions/:id/stop',   'Failed to stop QA Loop session',   { status: 200, timeout: 10_000 });

// Retest — Zod-validated
router.post(
  '/sessions/:id/retest',
  requireAuth,
  validate(qaLoopSchemas.retest),
  asyncHandler(async (req, res) => {
    await withQALoopBreaker(req, res, 'Failed to start retest', async () => {
      const response = await axios.post(
        `${qaLoopExecutorUrl}/api/sessions/${req.params.id}/retest`,
        req.body,
        { headers: qaLoopHeaders(req), timeout: 30_000 },
      );
      res.status(201).json(response.data);
    });
  }),
);

// ── Session sub-resources ──────────────────────────────────────────────────────

createProxy('get', '/sessions/:id/test-cases', 'Failed to get test cases');
createProxy('get', '/sessions/:id/bugs',        'Failed to get bugs');
createProxy('get', '/sessions/:id/pages',       'Failed to get pages');
createProxy('get', '/sessions/:id/test-runs',   'Failed to get test runs');

// ── Document management ────────────────────────────────────────────────────────
// combined must come BEFORE /:docId to avoid route shadowing

createProxy('get', '/sessions/:id/documents/combined', 'Failed to get combined documents');
createProxy('get', '/sessions/:id/documents',          'Failed to list documents');

// Upload document — Zod-validated
router.post(
  '/sessions/:id/documents',
  requireAuth,
  validate(qaLoopSchemas.uploadDocument),
  asyncHandler(async (req, res) => {
    await withQALoopBreaker(req, res, 'Failed to upload document', async () => {
      const response = await axios.post(
        `${qaLoopExecutorUrl}/api/sessions/${req.params.id}/documents`,
        req.body,
        { headers: qaLoopHeaders(req), timeout: 30_000 },
      );
      res.status(201).json(response.data);
    });
  }),
);

createProxy('get',    '/sessions/:id/documents/:docId', 'Failed to get document');

// Toggle document active state — Zod-validated
router.patch(
  '/sessions/:id/documents/:docId',
  requireAuth,
  validate(qaLoopSchemas.toggleDocument),
  asyncHandler(async (req, res) => {
    await withQALoopBreaker(req, res, 'Failed to update document', async () => {
      const response = await axios.patch(
        `${qaLoopExecutorUrl}/api/sessions/${req.params.id}/documents/${req.params.docId}`,
        req.body,
        { headers: qaLoopHeaders(req), timeout: 10_000 },
      );
      res.json(response.data);
    });
  }),
);

createProxy('delete', '/sessions/:id/documents/:docId', 'Failed to delete document');

export { router as qaLoopRouter };
