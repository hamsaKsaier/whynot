/**
 * recon/index.ts
 *
 * Recon scan HTTP API. Every endpoint is gated by:
 *   - requireAuth (JWT)
 *   - requireFlag('recon_enabled') → 404 when disabled
 *   - requireFeature('recon_enabled') → 402 when plan excludes
 *   - workspace-scoped queries (all repo calls pass workspaceId)
 *
 * Endpoints:
 *   POST   /api/recon/scans
 *   GET    /api/recon/scans
 *   GET    /api/recon/scans/:id
 *   GET    /api/recon/scans/:id/findings
 *   GET    /api/recon/scans/:id/report
 *   POST   /api/recon/scans/:id/cancel
 *   POST   /api/recon/scans/:id/resume
 *   GET    /api/recon/quota
 *   GET    /api/recon/settings
 *   PUT    /api/recon/settings
 */

import express, { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireFlag } from '../../middleware/require-flag';
import { requireFeature } from '../../middleware/feature-gate';
import { asyncHandler, createError } from '../../middleware/error-handler';
import { validate } from '../../middleware/validation';
import {
  validateAuthorizationPayload,
  loadReconProject,
  loadReconEnvironment,
  validateProjectHasGitHubRepo,
  validateEnvironmentHasUrl,
  productionEnvironmentWarning,
  resumeUrlGuard,
} from '../../middleware/recon-validation';
import {
  ReconScanRepository,
  ReconScanEntity,
  ReconScanStatus,
} from '../../../shared/database/repositories/recon-scan-repository';
import { ReconScanAuthorizationRepository } from '../../../shared/database/repositories/recon-scan-authorization-repository';
import { ReconScanPhaseRepository } from '../../../shared/database/repositories/recon-scan-phase-repository';
import {
  ReconFindingRepository,
  VulnClass,
  Severity,
  FindingStatus,
} from '../../../shared/database/repositories/recon-finding-repository';
import { ReconReportRepository } from '../../../shared/database/repositories/recon-report-repository';
import { ReconWorkspaceSettingsRepository } from '../../../shared/database/repositories/recon-workspace-settings-repository';
import { BillingService } from '../../payments/billing-service';
import { createLogger } from '../../../shared/logger/logger';
import { env } from '../../config/env';

const router = express.Router();
const logger = createLogger('recon-router');

const scanRepo = new ReconScanRepository();
const authRepo = new ReconScanAuthorizationRepository();
const phaseRepo = new ReconScanPhaseRepository();
const findingRepo = new ReconFindingRepository();
const reportRepo = new ReconReportRepository();
const workspaceSettingsRepo = new ReconWorkspaceSettingsRepository();

// ─── Schemas ────────────────────────────────────────────────────────────────

const targetUrlSchema = z
  .string()
  .url()
  .refine((url) => {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  });

const authorizationInputSchema = z.object({
  acknowledged: z.boolean(),
  justification: z.string(),
  acknowledged_by_user_id: z.string().uuid(),
  acknowledged_at: z.union([z.string(), z.date()]),
});

const createScanSchema = z.object({
  project_id: z.string().uuid(),
  environment_id: z.string().uuid(),
  target_url: targetUrlSchema,
  config_yaml: z.string().max(64_000).nullable().optional(),
  authorization: authorizationInputSchema,
});

const resumeScanSchema = z.object({
  target_url: targetUrlSchema,
});

const MAX_PAYG_CAP_CREDITS = 100_000;
const MAX_NOTIFY_RECIPIENTS = 50;

const updateReconSettingsSchema = z.object({
  notify_recipient_user_ids: z
    .array(z.string().uuid())
    .max(MAX_NOTIFY_RECIPIENTS),
  email_on_complete: z.boolean(),
  email_on_fail: z.boolean(),
  payg_cap_credits: z
    .number()
    .int()
    .min(0)
    .max(MAX_PAYG_CAP_CREDITS),
});

function serializeReconSettings(
  workspaceId: string,
  entity: Awaited<ReturnType<ReconWorkspaceSettingsRepository['findByWorkspaceId']>>,
) {
  if (!entity) {
    return {
      workspaceId,
      notifyRecipientUserIds: [] as string[],
      emailOnComplete: true,
      emailOnFail: true,
      paygCapCredits: 0,
    };
  }
  return {
    workspaceId: entity.workspace_id,
    notifyRecipientUserIds: entity.notify_recipient_user_ids,
    emailOnComplete: entity.email_on_complete,
    emailOnFail: entity.email_on_fail,
    paygCapCredits: entity.payg_cap_credits,
  };
}

// ─── Rate limiter: 5 scans per workspace per hour ───────────────────────────
// Sliding window. Keyed by workspaceId; one bucket per workspace.

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SCANS_PER_WINDOW = 5;
const workspaceScanWindows = new Map<string, number[]>();

function reconRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const workspaceId = req.workspaceId;
  if (!workspaceId) {
    next();
    return;
  }
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = (workspaceScanWindows.get(workspaceId) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= MAX_SCANS_PER_WINDOW) {
    const t = (req as any).t ?? ((k: string) => k);
    throw createError(
      t('errors:recon.rateLimit.exceeded'),
      429,
      'RECON_RATE_LIMIT_EXCEEDED',
      undefined,
      'errors:recon.rateLimit.exceeded',
    );
  }
  timestamps.push(now);
  workspaceScanWindows.set(workspaceId, timestamps);
  next();
}

/** Test-only helper: reset the in-memory sliding window. */
export function __resetReconRateLimiter(): void {
  workspaceScanWindows.clear();
}

// ─── Shared middleware chain ────────────────────────────────────────────────

router.use(requireAuth);
router.use(requireFlag('recon_enabled', { statusCode: 404 }));
router.use(requireFeature('recon_enabled'));

// ─── Serializers ────────────────────────────────────────────────────────────

function serializeScan(scan: ReconScanEntity) {
  return {
    id: scan.id,
    workspaceId: scan.workspace_id,
    projectId: scan.project_id,
    environmentId: scan.environment_id,
    targetUrl: scan.target_url,
    status: scan.status,
    createdByUserId: scan.created_by_user_id,
    startedAt: scan.started_at ? scan.started_at.toISOString() : null,
    completedAt: scan.completed_at ? scan.completed_at.toISOString() : null,
    cancelRequestedAt: scan.cancel_requested_at ? scan.cancel_requested_at.toISOString() : null,
    lastHeartbeatAt: scan.last_heartbeat_at ? scan.last_heartbeat_at.toISOString() : null,
    configYaml: scan.config_yaml,
    errorMessage: scan.error_message,
    totalCostCredits: String(scan.total_cost_credits ?? '0'),
    createdAt: scan.created_at.toISOString(),
    updatedAt: scan.updated_at.toISOString(),
  };
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString('base64');
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    const o = parseInt(String(parsed.o ?? 0), 10);
    return Number.isFinite(o) && o >= 0 ? o : 0;
  } catch {
    return 0;
  }
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * POST /api/recon/scans — create a new scan.
 */
router.post(
  '/scans',
  reconRateLimiter,
  validate(createScanSchema),
  validateAuthorizationPayload,
  loadReconProject,
  loadReconEnvironment,
  validateProjectHasGitHubRepo,
  validateEnvironmentHasUrl,
  productionEnvironmentWarning,
  asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.workspaceId!;
    const user = req.user!;
    const body = req.body as z.infer<typeof createScanSchema>;

    // Credit gate (v1): require an available managed quota or non-zero PAYG rate
    // so the workspace can actually be charged. This enforces the `recon_enabled`
    // feature gate already passed, plus a runtime quota/credit check.
    const quota = await BillingService.checkReconQuota(workspaceId);
    if (quota.included_remaining <= 0 && quota.payg_per_scan_credits <= 0n) {
      throw createError(
        'Payment required',
        402,
        'RECON_PAYMENT_REQUIRED',
        undefined,
        'errors:recon.payment.required',
      );
    }

    const created = await scanRepo.create({
      workspace_id: workspaceId,
      project_id: body.project_id,
      environment_id: body.environment_id,
      target_url: body.target_url,
      created_by_user_id: user.id,
      config_yaml: body.config_yaml ?? undefined,
    });

    // Persist authorization row (recon-safety #1). This table is append-only.
    try {
      await authRepo.insert({
        scan_id: created.id,
        acknowledged_by_user_id: body.authorization.acknowledged_by_user_id,
        acknowledged_at: new Date(body.authorization.acknowledged_at as any),
        justification: body.authorization.justification,
        caller_ip: req.ip || '0.0.0.0',
        user_agent: (req.headers['user-agent'] as string) || 'unknown',
      });
    } catch (err: any) {
      // Justification already length-validated upstream, but the repo enforces
      // the 20..1000 invariant defensively. Surface a 400 on mismatch.
      if (/justification/i.test(err?.message ?? '')) {
        throw createError(
          err.message,
          400,
          'RECON_AUTHORIZATION_JUSTIFICATION_TOO_SHORT',
          undefined,
          'errors:recon.authorization.justification.tooShort',
        );
      }
      throw err;
    }

    // Fire-and-forget enqueue to the recon executor. Failures don't fail the
    // response — the executor poller or a retry hook can pick up 'pending' rows.
    axios
      .post(
        `${env.RECON_EXECUTOR_URL}/api/scans`,
        { scan_id: created.id, target_url: created.target_url, workspace_id: workspaceId },
        { timeout: 3_000 },
      )
      .catch((err) => {
        logger.warn('recon executor enqueue failed', {
          scanId: created.id,
          error: err?.message,
        });
      });

    logger.info('recon scan created', {
      scanId: created.id,
      workspaceId,
      projectId: created.project_id,
    });

    const response: any = {
      success: true,
      message: (req as any).t('success:recon.scan.created'),
      scan: serializeScan(created),
    };
    if (req.reconWarnings && req.reconWarnings.length > 0) {
      response.warnings = req.reconWarnings;
    }
    res.status(201).json(response);
  }),
);

/**
 * GET /api/recon/scans — list scans for the caller's workspace.
 */
router.get(
  '/scans',
  asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.workspaceId!;
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 100);
    const offset = decodeCursor(req.query.cursor as string | undefined);
    const status = req.query.status as ReconScanStatus | undefined;
    const projectId = req.query.project_id as string | undefined;

    const rows = await scanRepo.list({
      workspace_id: workspaceId,
      project_id: projectId,
      status,
      offset,
      limit: limit + 1,
    });
    const hasMore = rows.length > limit;
    const entries = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      success: true,
      scans: entries.map(serializeScan),
      nextCursor: hasMore ? encodeCursor(offset + limit) : null,
    });
  }),
);

async function requireScan(req: Request): Promise<ReconScanEntity> {
  const workspaceId = req.workspaceId!;
  const scan = await scanRepo.findById(req.params.id, workspaceId);
  if (!scan) {
    throw createError(
      'Recon scan not found',
      404,
      'RECON_SCAN_NOT_FOUND',
      undefined,
      'errors:recon.scan.notFound',
    );
  }
  return scan;
}

/**
 * GET /api/recon/scans/:id — scan detail with phases.
 */
router.get(
  '/scans/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const scan = await requireScan(req);
    const phases = await phaseRepo.listByScan(scan.id);
    res.json({
      success: true,
      scan: serializeScan(scan),
      phases: phases.map((p: any) => ({
        id: p.id,
        scanId: p.scan_id,
        phase: p.phase,
        status: p.status,
        startedAt: p.started_at ? p.started_at.toISOString() : null,
        completedAt: p.completed_at ? p.completed_at.toISOString() : null,
        outputArtifactId: p.output_artifact_id,
        errorMessage: p.error_message,
      })),
    });
  }),
);

/**
 * GET /api/recon/scans/:id/findings
 */
router.get(
  '/scans/:id/findings',
  asyncHandler(async (req: Request, res: Response) => {
    const scan = await requireScan(req);
    const findings = await findingRepo.listByScan({
      scan_id: scan.id,
      severity: req.query.severity as Severity | undefined,
      vuln_class: req.query.vuln_class as VulnClass | undefined,
      status: (req.query.status as FindingStatus | undefined) ?? 'confirmed',
    });
    res.json({
      success: true,
      findings: findings.map((f: any) => ({
        id: f.id,
        scanId: f.scan_id,
        vulnClass: f.vuln_class,
        status: f.status,
        severity: f.severity,
        impactScore: f.impact_score,
        exploitabilityScore: f.exploitability_score,
        blastRadiusScore: f.blast_radius_score,
        normalizedEndpoint: f.normalized_endpoint,
        normalizedParam: f.normalized_param,
        description: f.description,
        proofOfConcept: f.proof_of_concept,
        exploitOutcome: f.exploit_outcome,
        remediation: f.remediation,
        duplicates: f.duplicates,
        createdAt: f.created_at.toISOString(),
      })),
    });
  }),
);

/**
 * GET /api/recon/scans/:id/report — markdown (or PDF via Accept: application/pdf)
 */
router.get(
  '/scans/:id/report',
  asyncHandler(async (req: Request, res: Response) => {
    const scan = await requireScan(req);
    const report = await reportRepo.findByScanId(scan.id);
    if (!report) {
      throw createError(
        'Report not available yet',
        404,
        'RECON_REPORT_NOT_FOUND',
        undefined,
        'errors:recon.report.generationFailed',
      );
    }

    const wantsPdf = (req.headers.accept ?? '').includes('application/pdf');
    if (wantsPdf) {
      if (!report.pdf_url) {
        throw createError(
          'PDF report not available',
          404,
          'RECON_REPORT_PDF_NOT_FOUND',
          undefined,
          'errors:recon.report.generationFailed',
        );
      }
      res.redirect(report.pdf_url);
      return;
    }

    const wantsMarkdown = (req.headers.accept ?? '').includes('text/markdown');
    if (wantsMarkdown) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(report.markdown);
      return;
    }

    res.json({
      success: true,
      report: {
        id: report.id,
        scanId: report.scan_id,
        markdown: report.markdown,
        pdfUrl: report.pdf_url,
        summary: report.summary,
        generatedAt: report.generated_at.toISOString(),
      },
    });
  }),
);

/**
 * POST /api/recon/scans/:id/cancel — idempotent.
 */
router.post(
  '/scans/:id/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const scan = await requireScan(req);
    // Idempotent: if already cancelled or terminal, return current state with 200.
    if (scan.status === 'completed' || scan.status === 'failed' || scan.status === 'cancelled') {
      res.json({
        success: true,
        message: (req as any).t('success:recon.scan.cancelled'),
        scan: serializeScan(scan),
      });
      return;
    }

    const updated = await scanRepo.requestCancel(scan.id, req.workspaceId!);
    const effective = updated ?? scan;
    res.json({
      success: true,
      message: (req as any).t('success:recon.scan.cancelled'),
      scan: serializeScan(effective),
    });
  }),
);

/**
 * POST /api/recon/scans/:id/resume — resume from last completed phase.
 * Rejects URL drift (recon-safety #5).
 */
router.post(
  '/scans/:id/resume',
  validate(resumeScanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const scan = await requireScan(req);
    const { target_url } = req.body as z.infer<typeof resumeScanSchema>;
    resumeUrlGuard(scan.target_url, target_url, req);

    if (scan.status !== 'failed' && scan.status !== 'cancelled' && scan.status !== 'stuck') {
      throw createError(
        'Scan is not in a resumable state',
        400,
        'RECON_SCAN_INVALID_STATUS',
        undefined,
        'errors:recon.scan.invalidStatus',
      );
    }

    const resumed = await scanRepo.updateStatus(scan.id, 'pending', { error_message: null });
    axios
      .post(
        `${env.RECON_EXECUTOR_URL}/api/scans/${scan.id}/resume`,
        { scan_id: scan.id, target_url: scan.target_url, workspace_id: req.workspaceId },
        { timeout: 3_000 },
      )
      .catch((err) => {
        logger.warn('recon executor resume enqueue failed', {
          scanId: scan.id,
          error: err?.message,
        });
      });

    res.json({
      success: true,
      message: (req as any).t('success:recon.scan.resumed'),
      scan: serializeScan(resumed ?? scan),
    });
  }),
);

/**
 * GET /api/recon/quota — current workspace's per-month Recon scan quota.
 * Used by the New Scan wizard's Cost Preview (Step 3).
 *   - mode:         "included" when the plan has remaining included scans,
 *                   otherwise "payg" (caller will be charged per scan).
 *   - remaining:    included scans remaining this calendar month.
 *   - cost_credits: PAYG cost per scan as a decimal string (BigInt-safe).
 */
router.get(
  '/quota',
  asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.workspaceId!;
    const quota = await BillingService.checkReconQuota(workspaceId);
    const mode = quota.included_remaining > 0 ? 'included' : 'payg';
    res.json({
      mode,
      remaining: quota.included_remaining,
      cost_credits: quota.payg_per_scan_credits.toString(),
    });
  }),
);

/**
 * GET /api/recon/settings — workspace-scoped Recon configuration.
 */
router.get(
  '/settings',
  asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.workspaceId!;
    const entity = await workspaceSettingsRepo.findByWorkspaceId(workspaceId);
    res.json({
      success: true,
      settings: serializeReconSettings(workspaceId, entity),
    });
  }),
);

/**
 * PUT /api/recon/settings — update workspace-scoped Recon configuration.
 */
router.put(
  '/settings',
  validate(updateReconSettingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const workspaceId = req.workspaceId!;
    const body = req.body as z.infer<typeof updateReconSettingsSchema>;
    const entity = await workspaceSettingsRepo.upsert({
      workspace_id: workspaceId,
      notify_recipient_user_ids: body.notify_recipient_user_ids,
      email_on_complete: body.email_on_complete,
      email_on_fail: body.email_on_fail,
      payg_cap_credits: body.payg_cap_credits,
    });
    res.json({
      success: true,
      message: (req as any).t('success:recon.settings.updated'),
      settings: serializeReconSettings(workspaceId, entity),
    });
  }),
);

export { router as reconRouter };
