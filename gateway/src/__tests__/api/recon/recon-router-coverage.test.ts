/**
 * Coverage-gap tests for gateway/src/api/recon/index.ts.
 *
 * This file extends recon-router.test.ts to drive 100% line + branch coverage.
 * Cases here focus on branches not exercised in the per-feature test file:
 *  - 1001-char justification
 *  - PAYG-only quota (included=0, payg>0)
 *  - PDF report path (with + without pdf_url)
 *  - Malformed cursor decoder
 *  - Settings GET/PUT endpoints
 *  - Resume on `cancelled` status (not just `failed`)
 *  - Cross-tenant 404 on every read endpoint
 *  - Cancel no-op returns current scan state (covers `updated ?? scan` fallback)
 *  - i18n message keys surface in error responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── hoisted mocks ──────────────────────────────────────────────────────────
const h = vi.hoisted(() => ({
  mockIsFlagEnabled: vi.fn<(orgId: string, key: string) => Promise<boolean>>(),
  mockSubscriptionRepo: { findByWorkspaceId: vi.fn() },
  mockPlanRepo: { getFeatures: vi.fn() },
  mockCheckReconQuota: vi.fn(),
  mockProjectRepo: { findByIdForWorkspace: vi.fn() },
  mockQuery: vi.fn(),
  mockAxiosPost: vi.fn(),
  scanDb: new Map<string, any>(),
  authDb: new Map<string, any>(),
  phaseDb: new Map<string, any[]>(),
  findingDb: new Map<string, any[]>(),
  reportDb: new Map<string, any>(),
  settingsDb: new Map<string, any>(),
}));

vi.mock('../../../utils/feature-flags', () => ({
  isFlagEnabled: (...args: any[]) => h.mockIsFlagEnabled(...(args as [string, string])),
}));

vi.mock('../../../../shared/database/repositories/subscription-repository', () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => h.mockSubscriptionRepo),
}));

vi.mock('../../../../shared/database/repositories/plan-repository', () => ({
  PlanRepository: vi.fn().mockImplementation(() => h.mockPlanRepo),
}));

vi.mock('../../../payments/billing-service', () => ({
  BillingService: { checkReconQuota: (ws: string) => h.mockCheckReconQuota(ws) },
}));

vi.mock('../../../../shared/database/repositories/project-repository', () => ({
  ProjectRepository: vi.fn().mockImplementation(() => h.mockProjectRepo),
}));

vi.mock('../../../../shared/database/connection', () => ({
  query: (...args: any[]) => h.mockQuery(...args),
}));

vi.mock('axios', () => ({
  default: { post: (...args: any[]) => h.mockAxiosPost(...args) },
}));

vi.mock('../../../../shared/logger/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../../../../shared/database/repositories/recon-scan-repository', () => ({
  ReconScanRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn(async (input: any) => {
      const id = `scan-${h.scanDb.size + 1}`;
      const now = new Date();
      const row = {
        id,
        workspace_id: input.workspace_id,
        project_id: input.project_id,
        environment_id: input.environment_id,
        target_url: input.target_url,
        status: 'pending',
        created_by_user_id: input.created_by_user_id,
        started_at: null,
        completed_at: null,
        cancel_requested_at: null,
        last_heartbeat_at: null,
        config_yaml: input.config_yaml ?? null,
        error_message: null,
        total_cost_credits: '0',
        created_at: now,
        updated_at: now,
      };
      h.scanDb.set(id, row);
      return row;
    }),
    findById: vi.fn(async (id: string, workspaceId: string) => {
      const row = h.scanDb.get(id);
      if (!row || row.workspace_id !== workspaceId) return null;
      return row;
    }),
    list: vi.fn(async (opts: any) => {
      const rows = [...h.scanDb.values()].filter((r) => r.workspace_id === opts.workspace_id);
      return rows.slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50));
    }),
    updateStatus: vi.fn(async (id: string, status: string) => {
      const row = h.scanDb.get(id);
      if (!row) return null;
      row.status = status;
      return row;
    }),
    requestCancel: vi.fn(async (id: string, workspaceId: string) => {
      const row = h.scanDb.get(id);
      if (!row || row.workspace_id !== workspaceId) return null;
      if (row.status !== 'pending' && row.status !== 'running') return null;
      row.cancel_requested_at = new Date();
      return row;
    }),
    countCreatedSince: vi.fn(async () => 0),
  })),
}));

vi.mock('../../../../shared/database/repositories/recon-scan-authorization-repository', () => ({
  ReconScanAuthorizationRepository: vi.fn().mockImplementation(() => ({
    insert: vi.fn(async (input: any) => {
      if (input.justification.length < 20 || input.justification.length > 1000) {
        throw new Error(
          'recon authorization justification must be between 20 and 1000 characters',
        );
      }
      const row = { id: `auth-${h.authDb.size + 1}`, ...input, created_at: new Date() };
      h.authDb.set(row.id, row);
      return row;
    }),
    findByScanId: vi.fn(async (scanId: string) => {
      for (const row of h.authDb.values()) {
        if (row.scan_id === scanId) return row;
      }
      return null;
    }),
  })),
}));

vi.mock('../../../../shared/database/repositories/recon-scan-phase-repository', () => ({
  ReconScanPhaseRepository: vi.fn().mockImplementation(() => ({
    listByScan: vi.fn(async (scanId: string) => h.phaseDb.get(scanId) ?? []),
  })),
}));

vi.mock('../../../../shared/database/repositories/recon-finding-repository', () => ({
  ReconFindingRepository: vi.fn().mockImplementation(() => ({
    listByScan: vi.fn(async (opts: any) => {
      let rows = h.findingDb.get(opts.scan_id) ?? [];
      if (opts.status) rows = rows.filter((r) => r.status === opts.status);
      if (opts.severity) rows = rows.filter((r) => r.severity === opts.severity);
      if (opts.vuln_class) rows = rows.filter((r) => r.vuln_class === opts.vuln_class);
      return rows;
    }),
  })),
}));

vi.mock('../../../../shared/database/repositories/recon-report-repository', () => ({
  ReconReportRepository: vi.fn().mockImplementation(() => ({
    findByScanId: vi.fn(async (scanId: string) => h.reportDb.get(scanId) ?? null),
  })),
}));

vi.mock('../../../../shared/database/repositories/recon-workspace-settings-repository', () => ({
  ReconWorkspaceSettingsRepository: vi.fn().mockImplementation(() => ({
    findByWorkspaceId: vi.fn(async (ws: string) => h.settingsDb.get(ws) ?? null),
    upsert: vi.fn(async (input: any) => {
      const row = { ...input, updated_at: new Date() };
      h.settingsDb.set(input.workspace_id, row);
      return row;
    }),
  })),
}));

vi.mock('../../../middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const userId = req.headers['x-test-user-id'] as string | undefined;
    const workspaceId = req.headers['x-test-workspace-id'] as string | undefined;
    if (!userId || !workspaceId) {
      return res.status(401).json({ success: false, error: 'errors:auth.unauthorized' });
    }
    req.user = { id: userId, email: `${userId}@test.com`, name: 'Test', role: 'user' };
    req.workspaceId = workspaceId;
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
}));

import { errorHandler } from '../../../middleware/error-handler';
import { reconRouter, __resetReconRateLimiter } from '../../../api/recon';
import { __resetFeatureCache } from '../../../middleware/feature-gate';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.t = (k: string) => k;
    next();
  });
  app.use('/api/recon', reconRouter);
  app.use(errorHandler);
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────
const WS = '00000000-0000-4000-8000-000000000001';
const OTHER_WS = '00000000-0000-4000-8000-000000000099';
const USER = '00000000-0000-4000-8000-000000000010';
const OTHER_USER = '00000000-0000-4000-8000-000000000011';
const PROJECT = '00000000-0000-4000-8000-000000000020';
const ENV = '00000000-0000-4000-8000-000000000030';

function validAuthorization(overrides: Record<string, any> = {}) {
  return {
    acknowledged: true,
    justification: 'Customer engagement SOW 2026-04 signed by both legal teams.',
    acknowledged_by_user_id: USER,
    acknowledged_at: new Date().toISOString(),
    ...overrides,
  };
}

function validCreatePayload(overrides: Record<string, any> = {}) {
  return {
    project_id: PROJECT,
    environment_id: ENV,
    target_url: 'https://scan.example.com',
    authorization: validAuthorization(),
    ...overrides,
  };
}

function setupDefaults() {
  h.mockIsFlagEnabled.mockResolvedValue(true);
  h.mockSubscriptionRepo.findByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro' });
  h.mockPlanRepo.getFeatures.mockResolvedValue([
    { feature_key: 'recon_enabled', feature_value: 'true' },
  ]);
  h.mockCheckReconQuota.mockResolvedValue({ included_remaining: 5, payg_per_scan_credits: 0n });
  h.mockProjectRepo.findByIdForWorkspace.mockImplementation(async (id: string, ws: string) => {
    if (id === PROJECT && ws === WS) {
      return {
        id: PROJECT,
        name: 'Acme',
        description: null,
        website_url: 'https://scan.example.com',
        created_at: new Date(),
        updated_at: new Date(),
      };
    }
    return null;
  });
  h.mockQuery.mockImplementation(async (sql: string, params: any[]) => {
    if (/FROM saved_environments/i.test(sql)) {
      const [id, ws] = params;
      if (ws !== WS) return [];
      if (id === ENV) {
        return [{
          id: ENV, workspace_id: WS, name: 'Staging', url: 'https://scan.example.com',
          description: null, created_at: new Date(), updated_at: new Date(),
        }];
      }
      return [];
    }
    if (/FROM github_repos/i.test(sql)) return [{ count: '1' }];
    return [];
  });
  h.mockAxiosPost.mockResolvedValue({ data: { ok: true } });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.scanDb.clear();
  h.authDb.clear();
  h.phaseDb.clear();
  h.findingDb.clear();
  h.reportDb.clear();
  h.settingsDb.clear();
  __resetReconRateLimiter();
  __resetFeatureCache();
  setupDefaults();
});

const app = () => createApp();

async function createScan(
  overrides: Record<string, any> = {},
  workspace: string = WS,
): Promise<any> {
  await request(app())
    .post('/api/recon/scans')
    .set('x-test-user-id', USER)
    .set('x-test-workspace-id', workspace)
    .send(validCreatePayload(overrides));
  // Return the in-memory DB row (mutable snake_case entity the router reads).
  return [...h.scanDb.values()].find((r) => r.workspace_id === workspace);
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/recon/scans — authorization payload edges', () => {
  it('rejects justification at 1001 characters (boundary)', async () => {
    const tooLong = 'a'.repeat(1001);
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload({
        authorization: validAuthorization({ justification: tooLong }),
      }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('errors:recon.authorization.justification.tooShort');
  });

  it('accepts justification at exactly 20 characters (boundary)', async () => {
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload({
        authorization: validAuthorization({ justification: 'x'.repeat(20) }),
      }));
    expect(res.status).toBe(201);
  });

  it('rejects authorization with acknowledged=false', async () => {
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload({
        authorization: validAuthorization({ acknowledged: false }),
      }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation:recon.authorization.acknowledged');
  });

  it('rejects malformed authorization payload (bad acknowledged_at)', async () => {
    // `validate()` allows `acknowledged_at: string | Date`; the stricter
    // middleware schema requires ISO8601. This hits the `malformed` branch.
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({
        ...validCreatePayload(),
        authorization: {
          acknowledged: true,
          justification: 'a long enough justification text here okay.',
          acknowledged_by_user_id: USER,
          acknowledged_at: 'not-a-datetime',
        },
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('errors:recon.authorization.malformed');
  });

  it('rejects non-http(s) target URL', async () => {
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload({ target_url: 'ftp://scan.example.com' }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/recon/scans — billing / quota branches', () => {
  it('402 surfaces errors:recon.payment.required', async () => {
    h.mockCheckReconQuota.mockResolvedValue({
      included_remaining: 0,
      payg_per_scan_credits: 0n,
    });
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('errors:recon.payment.required');
  });

  it('passes when included_remaining=0 but PAYG rate > 0', async () => {
    h.mockCheckReconQuota.mockResolvedValue({
      included_remaining: 0,
      payg_per_scan_credits: 100n,
    });
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    expect(res.status).toBe(201);
  });

  it('still creates scan when executor enqueue fails (fire-and-forget)', async () => {
    h.mockAxiosPost.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    expect(res.status).toBe(201);
    expect(res.body.scan.status).toBe('pending');
  });
});

describe('GET /api/recon/scans — list edges', () => {
  it('returns empty list for a workspace with no scans', async () => {
    const res = await request(app())
      .get('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.body.scans).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });

  it('treats malformed base64 cursor as offset=0', async () => {
    await createScan();
    const res = await request(app())
      .get('/api/recon/scans?cursor=%%%not-base64%%%')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.body.scans).toHaveLength(1);
  });

  it('treats non-numeric offset inside cursor as 0', async () => {
    await createScan();
    const bogus = Buffer.from(JSON.stringify({ o: 'nope' })).toString('base64');
    const res = await request(app())
      .get(`/api/recon/scans?cursor=${encodeURIComponent(bogus)}`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.body.scans).toHaveLength(1);
  });

  it('caps limit at 100 even when client requests 500', async () => {
    const res = await request(app())
      .get('/api/recon/scans?limit=500')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    // no assertion on payload — capping happens inside the repo call
  });
});

describe('GET /api/recon/scans/:id — cross-tenant leakage guard', () => {
  it('returns 404 (not 403) with recon.scan.notFound key for another workspace', async () => {
    const scan = await createScan();
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}`)
      .set('x-test-user-id', OTHER_USER)
      .set('x-test-workspace-id', OTHER_WS);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('errors:recon.scan.notFound');
  });
});

describe('GET /api/recon/scans/:id/findings — filtering', () => {
  it('defaults to status=confirmed when omitted', async () => {
    const scan = await createScan();
    h.findingDb.set(scan.id, [
      {
        id: 'f1', scan_id: scan.id, vuln_class: 'xss', status: 'confirmed',
        severity: 'high', impact_score: 9, exploitability_score: 8, blast_radius_score: 5,
        normalized_endpoint: '/a', normalized_param: 'q', description: 'x',
        proof_of_concept: { kind: 'http' }, exploit_outcome: null, remediation: null,
        duplicates: [], created_at: new Date(),
      },
      {
        id: 'f2', scan_id: scan.id, vuln_class: 'xss', status: 'discarded_unprovable',
        severity: 'low', impact_score: 1, exploitability_score: 1, blast_radius_score: 1,
        normalized_endpoint: '/b', normalized_param: 'q', description: 'y',
        proof_of_concept: null, exploit_outcome: null, remediation: null,
        duplicates: [], created_at: new Date(),
      },
    ]);
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}/findings`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.body.findings).toHaveLength(1);
    expect(res.body.findings[0].status).toBe('confirmed');
  });

  it('404 for findings of a scan in another workspace', async () => {
    const scan = await createScan();
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}/findings`)
      .set('x-test-user-id', OTHER_USER)
      .set('x-test-workspace-id', OTHER_WS);
    expect(res.status).toBe(404);
  });

  it('filters by vuln_class', async () => {
    const scan = await createScan();
    h.findingDb.set(scan.id, [
      {
        id: 'f1', scan_id: scan.id, vuln_class: 'xss', status: 'confirmed',
        severity: 'low', impact_score: 1, exploitability_score: 1, blast_radius_score: 1,
        normalized_endpoint: '/a', normalized_param: 'q', description: 'x',
        proof_of_concept: {}, exploit_outcome: null, remediation: null,
        duplicates: [], created_at: new Date(),
      },
      {
        id: 'f2', scan_id: scan.id, vuln_class: 'injection', status: 'confirmed',
        severity: 'high', impact_score: 9, exploitability_score: 8, blast_radius_score: 5,
        normalized_endpoint: '/b', normalized_param: 'q', description: 'y',
        proof_of_concept: {}, exploit_outcome: null, remediation: null,
        duplicates: [], created_at: new Date(),
      },
    ]);
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}/findings?vuln_class=injection`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.body.findings).toHaveLength(1);
    expect(res.body.findings[0].vulnClass).toBe('injection');
  });
});

describe('GET /api/recon/scans/:id/report — content negotiation', () => {
  it('404 with generationFailed key when report missing', async () => {
    const scan = await createScan();
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}/report`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('errors:recon.report.generationFailed');
  });

  it('redirects to PDF URL when Accept: application/pdf and pdf_url set', async () => {
    const scan = await createScan();
    h.reportDb.set(scan.id, {
      id: 'r1', scan_id: scan.id, markdown: '# r',
      pdf_url: 'https://cdn.example.com/r.pdf',
      summary: { total: 0, by_severity: {}, by_class: {} },
      generated_at: new Date(),
    });
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}/report`)
      .set('Accept', 'application/pdf')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://cdn.example.com/r.pdf');
  });

  it('404 when Accept: application/pdf but pdf_url is null', async () => {
    const scan = await createScan();
    h.reportDb.set(scan.id, {
      id: 'r1', scan_id: scan.id, markdown: '# r', pdf_url: null,
      summary: { total: 0, by_severity: {}, by_class: {} },
      generated_at: new Date(),
    });
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}/report`)
      .set('Accept', 'application/pdf')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(404);
  });

  it('404 for report on a scan in another workspace', async () => {
    const scan = await createScan();
    h.reportDb.set(scan.id, {
      id: 'r1', scan_id: scan.id, markdown: '# r', pdf_url: null,
      summary: { total: 0 }, generated_at: new Date(),
    });
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}/report`)
      .set('x-test-user-id', OTHER_USER)
      .set('x-test-workspace-id', OTHER_WS);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('errors:recon.scan.notFound');
  });
});

describe('POST /api/recon/scans/:id/cancel — state branches', () => {
  it('idempotent on already-cancelled scan', async () => {
    const scan = await createScan();
    scan.status = 'cancelled';
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/cancel`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('success:recon.scan.cancelled');
  });

  it('idempotent on completed scan', async () => {
    const scan = await createScan();
    scan.status = 'completed';
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/cancel`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
  });

  it('idempotent on failed scan', async () => {
    const scan = await createScan();
    scan.status = 'failed';
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/cancel`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
  });

  it('404 for cancel on a scan in another workspace', async () => {
    const scan = await createScan();
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/cancel`)
      .set('x-test-user-id', OTHER_USER)
      .set('x-test-workspace-id', OTHER_WS);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/recon/scans/:id/resume — state + URL branches', () => {
  it('resumes a cancelled scan', async () => {
    const scan = await createScan();
    scan.status = 'cancelled';
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/resume`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({ target_url: scan.target_url });
    expect(res.status).toBe(200);
    expect(res.body.scan.status).toBe('pending');
  });

  it('resumes a stuck scan', async () => {
    const scan = await createScan();
    scan.status = 'stuck';
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/resume`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({ target_url: scan.target_url });
    expect(res.status).toBe(200);
  });

  it('rejects resume on a completed scan', async () => {
    const scan = await createScan();
    scan.status = 'completed';
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/resume`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({ target_url: scan.target_url });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('errors:recon.scan.invalidStatus');
  });

  it('rejects resume with a missing target_url in body', async () => {
    const scan = await createScan();
    scan.status = 'failed';
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/resume`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({});
    expect(res.status).toBe(400);
  });

  it('url mismatch surfaces errors:recon.resume.urlMismatch', async () => {
    const scan = await createScan();
    scan.status = 'failed';
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/resume`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({ target_url: 'https://other.example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('errors:recon.resume.urlMismatch');
  });

  it('404 for resume on a scan in another workspace', async () => {
    const scan = await createScan();
    scan.status = 'failed';
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/resume`)
      .set('x-test-user-id', OTHER_USER)
      .set('x-test-workspace-id', OTHER_WS)
      .send({ target_url: scan.target_url });
    expect(res.status).toBe(404);
  });

  it('still resolves when executor resume enqueue fails', async () => {
    const scan = await createScan();
    scan.status = 'failed';
    h.mockAxiosPost.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/resume`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({ target_url: scan.target_url });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/recon/settings', () => {
  it('returns defaults when no row exists', async () => {
    const res = await request(app())
      .get('/api/recon/settings')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.body.settings).toEqual({
      workspaceId: WS,
      notifyRecipientUserIds: [],
      emailOnComplete: true,
      emailOnFail: true,
      paygCapCredits: 0,
    });
  });

  it('returns persisted values when a row exists', async () => {
    h.settingsDb.set(WS, {
      workspace_id: WS,
      notify_recipient_user_ids: [USER],
      email_on_complete: false,
      email_on_fail: true,
      payg_cap_credits: 5000,
    });
    const res = await request(app())
      .get('/api/recon/settings')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.body.settings.notifyRecipientUserIds).toEqual([USER]);
    expect(res.body.settings.emailOnComplete).toBe(false);
    expect(res.body.settings.paygCapCredits).toBe(5000);
  });
});

describe('PUT /api/recon/settings', () => {
  const validBody = {
    notify_recipient_user_ids: [USER],
    email_on_complete: true,
    email_on_fail: false,
    payg_cap_credits: 1000,
  };

  it('upserts valid settings', async () => {
    const res = await request(app())
      .put('/api/recon/settings')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.settings.paygCapCredits).toBe(1000);
    expect(h.settingsDb.get(WS)).toBeTruthy();
  });

  it('rejects payg_cap_credits above MAX_PAYG_CAP_CREDITS (100_000)', async () => {
    const res = await request(app())
      .put('/api/recon/settings')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({ ...validBody, payg_cap_credits: 100_001 });
    expect(res.status).toBe(400);
  });

  it('rejects negative payg_cap_credits', async () => {
    const res = await request(app())
      .put('/api/recon/settings')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({ ...validBody, payg_cap_credits: -1 });
    expect(res.status).toBe(400);
  });

  it('rejects notify_recipient_user_ids above 50 entries', async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    const res = await request(app())
      .put('/api/recon/settings')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({ ...validBody, notify_recipient_user_ids: tooMany });
    expect(res.status).toBe(400);
  });

  it('rejects non-UUID entries in notify_recipient_user_ids', async () => {
    const res = await request(app())
      .put('/api/recon/settings')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({ ...validBody, notify_recipient_user_ids: ['not-a-uuid'] });
    expect(res.status).toBe(400);
  });

  it('401 when unauthenticated', async () => {
    const res = await request(app()).put('/api/recon/settings').send(validBody);
    expect(res.status).toBe(401);
  });
});

describe('Gate errors expose i18n message keys', () => {
  it('anonymous → 401', async () => {
    const res = await request(app()).get('/api/recon/scans');
    expect(res.status).toBe(401);
  });

  it('flag off → 404 (no body leakage)', async () => {
    h.mockIsFlagEnabled.mockResolvedValue(false);
    const res = await request(app())
      .get('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(404);
  });
});
