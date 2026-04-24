import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── hoisted mocks so vi.mock closures can reference them ────────────────────
const h = vi.hoisted(() => ({
  mockIsFlagEnabled: vi.fn<(orgId: string, key: string) => Promise<boolean>>(),
  mockSubscriptionRepo: {
    findByWorkspaceId: vi.fn(),
  },
  mockPlanRepo: {
    getFeatures: vi.fn(),
  },
  mockCheckReconQuota: vi.fn(),
  mockProjectRepo: {
    findByIdForWorkspace: vi.fn(),
  },
  mockQuery: vi.fn(),
  mockAxiosPost: vi.fn(),
  scanDb: new Map<string, any>(),
  authDb: new Map<string, any>(),
  phaseDb: new Map<string, any[]>(),
  findingDb: new Map<string, any[]>(),
  reportDb: new Map<string, any>(),
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
  BillingService: {
    checkReconQuota: (ws: string) => h.mockCheckReconQuota(ws),
  },
}));

vi.mock('../../../../shared/database/repositories/project-repository', () => ({
  ProjectRepository: vi.fn().mockImplementation(() => h.mockProjectRepo),
}));

vi.mock('../../../../shared/database/connection', () => ({
  query: (...args: any[]) => h.mockQuery(...args),
}));

vi.mock('axios', () => ({
  default: {
    post: (...args: any[]) => h.mockAxiosPost(...args),
  },
}));

vi.mock('../../../../shared/logger/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// In-memory recon repositories
vi.mock('../../../../shared/database/repositories/recon-scan-repository', () => {
  return {
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
        const sliced = rows.slice(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50));
        return sliced;
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
  };
});

vi.mock('../../../../shared/database/repositories/recon-scan-authorization-repository', () => ({
  ReconScanAuthorizationRepository: vi.fn().mockImplementation(() => ({
    insert: vi.fn(async (input: any) => {
      if (input.justification.length < 20 || input.justification.length > 1000) {
        throw new Error('recon authorization justification must be between 20 and 1000 characters');
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
    checkpoint: vi.fn(async (input: any) => input),
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

// Stub auth middleware: accept x-test-user-id + x-test-workspace-id headers.
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

// Stub i18n middleware as identity for t()
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
const PROJECT = '00000000-0000-4000-8000-000000000020';
const ENV = '00000000-0000-4000-8000-000000000030';
const PROD_ENV = '00000000-0000-4000-8000-000000000031';

function validAuthorization() {
  return {
    acknowledged: true,
    justification: 'Customer engagement SOW 2026-04 signed by both legal teams.',
    acknowledged_by_user_id: USER,
    acknowledged_at: new Date().toISOString(),
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

function setupDefaultMocks() {
  h.mockIsFlagEnabled.mockResolvedValue(true);
  h.mockSubscriptionRepo.findByWorkspaceId.mockResolvedValue({ plan_id: 'plan-pro' });
  h.mockPlanRepo.getFeatures.mockResolvedValue([
    { feature_key: 'recon_enabled', feature_value: 'true' },
  ]);
  h.mockCheckReconQuota.mockResolvedValue({ included_remaining: 5, payg_per_scan_credits: 0n });

  h.mockProjectRepo.findByIdForWorkspace.mockImplementation(
    async (id: string, workspaceId: string) => {
      if (id === PROJECT && workspaceId === WS) {
        return {
          id: PROJECT,
          name: 'Acme Project',
          description: null,
          website_url: 'https://scan.example.com',
          created_at: new Date(),
          updated_at: new Date(),
        };
      }
      return null;
    },
  );

  h.mockQuery.mockImplementation(async (sql: string, params: any[]) => {
    if (/FROM saved_environments/i.test(sql)) {
      const [id, ws] = params;
      if (ws !== WS) return [];
      if (id === ENV) {
        return [{
          id: ENV,
          workspace_id: WS,
          name: 'Staging',
          url: 'https://scan.example.com',
          description: null,
          created_at: new Date(),
          updated_at: new Date(),
        }];
      }
      if (id === PROD_ENV) {
        return [{
          id: PROD_ENV,
          workspace_id: WS,
          name: 'Production',
          url: 'https://scan.example.com',
          description: null,
          created_at: new Date(),
          updated_at: new Date(),
        }];
      }
      return [];
    }
    if (/FROM github_repos/i.test(sql)) {
      return [{ count: '1' }];
    }
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
  __resetReconRateLimiter();
  __resetFeatureCache();
  setupDefaultMocks();
});

const app = () => createApp();

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Recon router — auth + flag + feature gates', () => {
  it('anonymous request → 401', async () => {
    const res = await request(app()).post('/api/recon/scans').send(validCreatePayload());
    expect(res.status).toBe(401);
  });

  it('flag disabled → 404 FEATURE_DISABLED', async () => {
    h.mockIsFlagEnabled.mockResolvedValue(false);
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    expect(res.status).toBe(404);
  });

  it('plan without recon_enabled → 403 FEATURE_NOT_AVAILABLE', async () => {
    h.mockPlanRepo.getFeatures.mockResolvedValue([]);
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    expect(res.status).toBe(403);
  });
});

describe('POST /api/recon/scans — create', () => {
  it('rejects when authorization is missing', async () => {
    const payload = validCreatePayload();
    delete (payload as any).authorization;
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(payload);
    expect(res.status).toBe(400);
  });

  it('rejects when justification is too short', async () => {
    const payload = validCreatePayload({
      authorization: { ...validAuthorization(), justification: 'too short' },
    });
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(payload);
    expect(res.status).toBe(400);
  });

  it('creates scan and persists authorization row', async () => {
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    expect(res.status).toBe(201);
    expect(res.body.scan.id).toBeDefined();
    expect(res.body.scan.status).toBe('pending');
    expect(h.authDb.size).toBe(1);
    const [authRow] = [...h.authDb.values()];
    expect(authRow.justification).toContain('SOW');
    expect(authRow.scan_id).toBe(res.body.scan.id);
  });

  it('returns a production warning when environment name contains "prod"', async () => {
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload({ environment_id: PROD_ENV }));
    expect(res.status).toBe(201);
    expect(res.body.warnings).toBeDefined();
    expect(res.body.warnings[0].code).toBe('recon.environment.production');
  });

  it('404 when project belongs to another workspace', async () => {
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', OTHER_WS)
      .send(validCreatePayload());
    expect(res.status).toBe(404);
  });

  it('400 when no GitHub repo is linked to the workspace', async () => {
    h.mockQuery.mockImplementation(async (sql: string, params: any[]) => {
      if (/FROM saved_environments/i.test(sql)) {
        return [{
          id: ENV,
          workspace_id: WS,
          name: 'Staging',
          url: 'https://scan.example.com',
          description: null,
          created_at: new Date(),
          updated_at: new Date(),
        }];
      }
      if (/FROM github_repos/i.test(sql)) return [{ count: '0' }];
      return [];
    });
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    expect(res.status).toBe(400);
  });

  it('400 when selected environment has no URL', async () => {
    h.mockQuery.mockImplementation(async (sql: string, params: any[]) => {
      if (/FROM saved_environments/i.test(sql)) {
        return [{
          id: ENV,
          workspace_id: WS,
          name: 'Staging',
          url: '',
          description: null,
          created_at: new Date(),
          updated_at: new Date(),
        }];
      }
      if (/FROM github_repos/i.test(sql)) return [{ count: '1' }];
      return [];
    });
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    expect(res.status).toBe(400);
  });

  it('402 when plan has no included scans and no PAYG rate', async () => {
    h.mockCheckReconQuota.mockResolvedValue({ included_remaining: 0, payg_per_scan_credits: 0n });
    const res = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    expect(res.status).toBe(402);
  });

  it('rate-limit: 6th scan within an hour → 429', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await request(app())
        .post('/api/recon/scans')
        .set('x-test-user-id', USER)
        .set('x-test-workspace-id', WS)
        .send(validCreatePayload());
      expect(r.status).toBe(201);
    }
    const over = await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    expect(over.status).toBe(429);
  });
});

describe('GET /api/recon/scans — list', () => {
  it('lists only the caller workspace scans', async () => {
    // Seed two scans for WS, one for OTHER_WS.
    await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    // inject a cross-workspace row directly
    h.scanDb.set('scan-other', { ...[...h.scanDb.values()][0], id: 'scan-other', workspace_id: OTHER_WS });

    const res = await request(app())
      .get('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.body.scans).toHaveLength(2);
  });

  it('cursor round-trip returns next page', async () => {
    // Seed 3 scans, limit=2 forces cursor.
    for (let i = 0; i < 3; i++) {
      await request(app())
        .post('/api/recon/scans')
        .set('x-test-user-id', USER)
        .set('x-test-workspace-id', WS)
        .send(validCreatePayload());
    }
    const first = await request(app())
      .get('/api/recon/scans?limit=2')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(first.status).toBe(200);
    expect(first.body.scans).toHaveLength(2);
    expect(first.body.nextCursor).toBeTruthy();

    const second = await request(app())
      .get(`/api/recon/scans?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(second.status).toBe(200);
    expect(second.body.scans).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
  });
});

describe('GET /api/recon/scans/:id', () => {
  it('returns 404 for a scan in another workspace', async () => {
    await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    const [scan] = [...h.scanDb.values()];
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', OTHER_WS);
    expect(res.status).toBe(404);
  });

  it('returns scan with phases[]', async () => {
    await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    const [scan] = [...h.scanDb.values()];
    h.phaseDb.set(scan.id, [
      { id: 'p1', scan_id: scan.id, phase: 'fingerprinting', status: 'completed', started_at: new Date(), completed_at: new Date(), output_artifact_id: null, error_message: null },
    ]);
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.body.phases).toHaveLength(1);
  });
});

describe('GET /api/recon/scans/:id/findings', () => {
  it('filters by severity', async () => {
    await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    const [scan] = [...h.scanDb.values()];
    h.findingDb.set(scan.id, [
      { id: 'f1', scan_id: scan.id, vuln_class: 'xss', status: 'confirmed', severity: 'low', impact_score: 1, exploitability_score: 1, blast_radius_score: 1, normalized_endpoint: '/a', normalized_param: 'q', description: 'x', proof_of_concept: {}, exploit_outcome: null, remediation: null, duplicates: [], created_at: new Date() },
      { id: 'f2', scan_id: scan.id, vuln_class: 'xss', status: 'confirmed', severity: 'high', impact_score: 9, exploitability_score: 8, blast_radius_score: 5, normalized_endpoint: '/b', normalized_param: 'q', description: 'y', proof_of_concept: {}, exploit_outcome: null, remediation: null, duplicates: [], created_at: new Date() },
    ]);
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}/findings?severity=high`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.body.findings).toHaveLength(1);
    expect(res.body.findings[0].severity).toBe('high');
  });
});

describe('GET /api/recon/scans/:id/report', () => {
  it('returns 404 when report is not yet generated', async () => {
    await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    const [scan] = [...h.scanDb.values()];
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}/report`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(404);
  });

  it('returns JSON by default when report exists', async () => {
    await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    const [scan] = [...h.scanDb.values()];
    h.reportDb.set(scan.id, {
      id: 'r1',
      scan_id: scan.id,
      markdown: '# report',
      pdf_url: null,
      summary: { total: 0, by_severity: {}, by_class: {} },
      generated_at: new Date(),
    });
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}/report`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.body.report.markdown).toBe('# report');
  });

  it('returns raw markdown when Accept: text/markdown', async () => {
    await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    const [scan] = [...h.scanDb.values()];
    h.reportDb.set(scan.id, {
      id: 'r1', scan_id: scan.id, markdown: '# md', pdf_url: null,
      summary: { total: 0, by_severity: {}, by_class: {} }, generated_at: new Date(),
    });
    const res = await request(app())
      .get(`/api/recon/scans/${scan.id}/report`)
      .set('Accept', 'text/markdown')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.text).toBe('# md');
  });
});

describe('POST /api/recon/scans/:id/cancel', () => {
  it('is idempotent — calling twice returns 200 both times', async () => {
    await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    const [scan] = [...h.scanDb.values()];

    const first = await request(app())
      .post(`/api/recon/scans/${scan.id}/cancel`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(first.status).toBe(200);

    const second = await request(app())
      .post(`/api/recon/scans/${scan.id}/cancel`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS);
    expect(second.status).toBe(200);
  });
});

describe('POST /api/recon/scans/:id/resume', () => {
  it('rejects mismatched target_url → 400', async () => {
    await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    const [scan] = [...h.scanDb.values()];
    scan.status = 'failed';
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/resume`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({ target_url: 'https://evil.example.com' });
    expect(res.status).toBe(400);
  });

  it('resumes when URL matches and scan is in a resumable state', async () => {
    await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    const [scan] = [...h.scanDb.values()];
    scan.status = 'failed';
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/resume`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({ target_url: scan.target_url });
    expect(res.status).toBe(200);
    expect(res.body.scan.status).toBe('pending');
  });

  it('rejects resume when scan is in an invalid state (running)', async () => {
    await request(app())
      .post('/api/recon/scans')
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send(validCreatePayload());
    const [scan] = [...h.scanDb.values()];
    scan.status = 'running';
    const res = await request(app())
      .post(`/api/recon/scans/${scan.id}/resume`)
      .set('x-test-user-id', USER)
      .set('x-test-workspace-id', WS)
      .send({ target_url: scan.target_url });
    expect(res.status).toBe(400);
  });
});
