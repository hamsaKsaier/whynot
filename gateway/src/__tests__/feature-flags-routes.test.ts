import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { i18nMiddleware } from '../middleware/i18n';
import i18n from '../i18n';

vi.mock('../../../shared/database/repositories/feature-flag-repository', () => {
  const listFlags = vi.fn();
  const getByKey = vi.fn();
  const getOrgOverride = vi.fn();
  const listOrgOverrides = vi.fn();
  const listAllOrgOverridesWithFlags = vi.fn();
  const upsertOverride = vi.fn();
  const deleteOverride = vi.fn();
  return {
    FeatureFlagRepository: vi.fn().mockImplementation(() => ({
      listFlags,
      getByKey,
      getOrgOverride,
      listOrgOverrides,
      listAllOrgOverridesWithFlags,
      upsertOverride,
      deleteOverride,
    })),
    __mocks: { listFlags, getByKey, getOrgOverride, listOrgOverrides, listAllOrgOverridesWithFlags, upsertOverride, deleteOverride },
  };
});

vi.mock('../../../shared/database/repositories/audit-repository', () => {
  const log = vi.fn().mockResolvedValue(undefined);
  return {
    AuditRepository: vi.fn().mockImplementation(() => ({ log })),
    __auditLog: log,
  };
});

vi.mock('../utils/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/feature-flags')>();
  return {
    ...actual,
    isFlagEnabled: vi.fn(),
    invalidateFlag: vi.fn(),
    invalidateOrg: vi.fn(),
    resolveAllFlags: vi.fn(),
  };
});

// @ts-expect-error vitest mock-injected export
import { __mocks } from '../../../shared/database/repositories/feature-flag-repository';
// @ts-expect-error vitest mock-injected export
import { __auditLog } from '../../../shared/database/repositories/audit-repository';
import { isFlagEnabled, invalidateFlag, resolveAllFlags } from '../utils/feature-flags';
import { isValidFeatureKey } from '../../../shared/constants/platform-features';
import { requireFlag } from '../middleware/require-flag';

const { listFlags, getOrgOverride, listAllOrgOverridesWithFlags, upsertOverride, deleteOverride } = __mocks as any;
const auditLog = __auditLog as any;

const SUPER_ADMIN = { id: 'admin-1', email: 'admin@test.com', name: 'Admin', role: 'super_admin' };
const REGULAR_USER = { id: 'user-1', email: 'user@test.com', name: 'User', role: 'user' };
const WORKSPACE_ID = 'ws-123';

function buildApp(opts: { user?: any; workspaceId?: string } = {}) {
  const app = express();
  app.use(express.json());
  app.use(i18nMiddleware);

  app.use((req, _res, next) => {
    if (opts.user) req.user = opts.user;
    if (opts.workspaceId) req.workspaceId = opts.workspaceId;
    next();
  });

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Auth required' });
    next();
  };
  const requireSuperAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== 'super_admin') return res.status(403).json({ success: false, error: 'Super admin required' });
    next();
  };

  app.get('/api/admin/feature-flags', requireAuth, requireSuperAdmin, async (_req, res) => {
    const flags = await listFlags();
    res.json({ success: true, flags });
  });

  app.get('/api/admin/feature-flags/:orgId', requireAuth, requireSuperAdmin, async (req, res) => {
    const rows = await listAllOrgOverridesWithFlags(req.params.orgId);
    res.json({ success: true, flags: rows });
  });

  app.put('/api/admin/feature-flags/:orgId/:key', requireAuth, requireSuperAdmin, async (req: any, res) => {
    const { orgId, key } = req.params;
    const t = (req as any).t;
    if (!isValidFeatureKey(key)) {
      return res.status(400).json({ success: false, error: { code: 'UNKNOWN_FLAG_KEY', message: t('errors:flags.unknownKey') } });
    }
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
    }
    const before = await getOrgOverride(orgId, key);
    const override = await upsertOverride(orgId, key, enabled, req.user.id);
    (invalidateFlag as any)(orgId, key);
    await auditLog({
      actor_id: req.user.id,
      actor_email: req.user.email,
      action: 'feature_flag.override_set',
      target_type: 'feature_flag',
      target_id: key,
      details: { target_org_id: orgId, flag_key: key, before: before?.enabled ?? null, after: enabled },
    });
    res.json({ success: true, override, message: t('success:flags.updated') });
  });

  app.delete('/api/admin/feature-flags/:orgId/:key', requireAuth, requireSuperAdmin, async (req: any, res) => {
    const { orgId, key } = req.params;
    const t = (req as any).t;
    if (!isValidFeatureKey(key)) {
      return res.status(400).json({ success: false, error: { code: 'UNKNOWN_FLAG_KEY', message: t('errors:flags.unknownKey') } });
    }
    const before = await getOrgOverride(orgId, key);
    await deleteOverride(orgId, key);
    (invalidateFlag as any)(orgId, key);
    await auditLog({
      actor_id: req.user.id,
      actor_email: req.user.email,
      action: 'feature_flag.override_cleared',
      target_type: 'feature_flag',
      target_id: key,
      details: { target_org_id: orgId, flag_key: key, before: before?.enabled ?? null, after: null },
    });
    res.json({ success: true });
  });

  app.get('/api/me/flags', requireAuth, async (req: any, res) => {
    const orgId = req.workspaceId;
    if (!orgId) return res.status(401).json({ success: false, error: 'Workspace not resolved' });
    const flags = await (resolveAllFlags as any)(orgId);
    res.json({ success: true, flags });
  });

  app.get('/test-require-flag', requireAuth, requireFlag('ai_multi_provider'), (_req, res) => {
    res.json({ success: true, message: 'passed' });
  });

  return app;
}

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    if (i18n.isInitialized) return resolve();
    i18n.on('initialized', () => resolve());
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/feature-flags', () => {
  it('returns all flags for super admin', async () => {
    const mockFlags = [{ key: 'ai_multi_provider', name: 'AI Multi', default_enabled: false }];
    listFlags.mockResolvedValue(mockFlags);

    const res = await request(buildApp({ user: SUPER_ADMIN }))
      .get('/api/admin/feature-flags');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.flags).toEqual(mockFlags);
  });

  it('returns 403 for regular user', async () => {
    const res = await request(buildApp({ user: REGULAR_USER }))
      .get('/api/admin/feature-flags');
    expect(res.status).toBe(403);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(buildApp())
      .get('/api/admin/feature-flags');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/feature-flags/:orgId', () => {
  it('returns flags with overrides for an org', async () => {
    const mockRows = [
      { key: 'ai_multi_provider', default_enabled: false, override_enabled: true },
    ];
    listAllOrgOverridesWithFlags.mockResolvedValue(mockRows);

    const res = await request(buildApp({ user: SUPER_ADMIN }))
      .get('/api/admin/feature-flags/ws-123');

    expect(res.status).toBe(200);
    expect(res.body.flags).toEqual(mockRows);
    expect(listAllOrgOverridesWithFlags).toHaveBeenCalledWith('ws-123');
  });
});

describe('PUT /api/admin/feature-flags/:orgId/:key', () => {
  it('sets override and creates audit log', async () => {
    getOrgOverride.mockResolvedValue(null);
    upsertOverride.mockResolvedValue({ organization_id: 'ws-1', flag_key: 'ai_multi_provider', enabled: true });

    const res = await request(buildApp({ user: SUPER_ADMIN }))
      .put('/api/admin/feature-flags/ws-1/ai_multi_provider')
      .send({ enabled: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(upsertOverride).toHaveBeenCalledWith('ws-1', 'ai_multi_provider', true, SUPER_ADMIN.id);
    expect(invalidateFlag).toHaveBeenCalledWith('ws-1', 'ai_multi_provider');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'feature_flag.override_set',
        details: expect.objectContaining({ before: null, after: true }),
      })
    );
  });

  it('returns 400 for unknown key', async () => {
    const res = await request(buildApp({ user: SUPER_ADMIN }))
      .put('/api/admin/feature-flags/ws-1/totally_fake_key')
      .send({ enabled: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNKNOWN_FLAG_KEY');
  });

  it('returns 400 when enabled is not boolean', async () => {
    const res = await request(buildApp({ user: SUPER_ADMIN }))
      .put('/api/admin/feature-flags/ws-1/ai_multi_provider')
      .send({ enabled: 'yes' });
    expect(res.status).toBe(400);
  });

  it('returns localized success message in French', async () => {
    getOrgOverride.mockResolvedValue(null);
    upsertOverride.mockResolvedValue({ enabled: true });

    const res = await request(buildApp({ user: SUPER_ADMIN }))
      .put('/api/admin/feature-flags/ws-1/ai_multi_provider')
      .set('Accept-Language', 'fr')
      .send({ enabled: true });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('succès');
  });

  it('returns localized error for unknown key in Arabic', async () => {
    const res = await request(buildApp({ user: SUPER_ADMIN }))
      .put('/api/admin/feature-flags/ws-1/fake_key')
      .set('Accept-Language', 'ar')
      .send({ enabled: true });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('غير معروف');
  });
});

describe('DELETE /api/admin/feature-flags/:orgId/:key', () => {
  it('clears override and creates audit log', async () => {
    getOrgOverride.mockResolvedValue({ enabled: true });
    deleteOverride.mockResolvedValue(true);

    const res = await request(buildApp({ user: SUPER_ADMIN }))
      .delete('/api/admin/feature-flags/ws-1/ai_multi_provider');

    expect(res.status).toBe(200);
    expect(deleteOverride).toHaveBeenCalledWith('ws-1', 'ai_multi_provider');
    expect(invalidateFlag).toHaveBeenCalledWith('ws-1', 'ai_multi_provider');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'feature_flag.override_cleared',
        details: expect.objectContaining({ before: true, after: null }),
      })
    );
  });

  it('returns 400 for unknown key', async () => {
    const res = await request(buildApp({ user: SUPER_ADMIN }))
      .delete('/api/admin/feature-flags/ws-1/not_real');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNKNOWN_FLAG_KEY');
  });
});

describe('GET /api/me/flags', () => {
  it('returns resolved flags for the current user workspace', async () => {
    const mockFlags = { ai_multi_provider: true, payg_billing: false };
    (resolveAllFlags as any).mockResolvedValue(mockFlags);

    const res = await request(buildApp({ user: REGULAR_USER, workspaceId: WORKSPACE_ID }))
      .get('/api/me/flags');

    expect(res.status).toBe(200);
    expect(res.body.flags).toEqual(mockFlags);
    expect(resolveAllFlags).toHaveBeenCalledWith(WORKSPACE_ID);
  });

  it('returns 401 without auth', async () => {
    const res = await request(buildApp())
      .get('/api/me/flags');
    expect(res.status).toBe(401);
  });

  it('returns 401 without workspace', async () => {
    const res = await request(buildApp({ user: REGULAR_USER }))
      .get('/api/me/flags');
    expect(res.status).toBe(401);
  });
});

describe('requireFlag middleware', () => {
  it('passes through when flag is enabled', async () => {
    (isFlagEnabled as any).mockResolvedValue(true);

    const res = await request(buildApp({ user: REGULAR_USER, workspaceId: WORKSPACE_ID }))
      .get('/test-require-flag');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('passed');
  });

  it('returns 403 with localized message when flag is disabled', async () => {
    (isFlagEnabled as any).mockResolvedValue(false);

    const res = await request(buildApp({ user: REGULAR_USER, workspaceId: WORKSPACE_ID }))
      .get('/test-require-flag');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FEATURE_DISABLED');
    expect(res.body.error.message).toBe('This feature is currently disabled');
  });

  it('returns localized 403 in French', async () => {
    (isFlagEnabled as any).mockResolvedValue(false);

    const res = await request(buildApp({ user: REGULAR_USER, workspaceId: WORKSPACE_ID }))
      .get('/test-require-flag')
      .set('Accept-Language', 'fr');

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('désactivée');
  });

  it('returns localized 403 in Arabic', async () => {
    (isFlagEnabled as any).mockResolvedValue(false);

    const res = await request(buildApp({ user: REGULAR_USER, workspaceId: WORKSPACE_ID }))
      .get('/test-require-flag')
      .set('Accept-Language', 'ar');

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('معطّلة');
  });

  it('returns 401 when workspace not resolved', async () => {
    const res = await request(buildApp({ user: REGULAR_USER }))
      .get('/test-require-flag');
    expect(res.status).toBe(401);
  });

  it('forwards errors from isFlagEnabled to error handler', async () => {
    (isFlagEnabled as any).mockRejectedValue(new Error('db connection lost'));

    const app = buildApp({ user: REGULAR_USER, workspaceId: WORKSPACE_ID });
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: err.message });
    });

    const res = await request(app).get('/test-require-flag');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('db connection lost');
  });

  it('returns key string fallback when i18n t function is absent', async () => {
    (isFlagEnabled as any).mockResolvedValue(false);

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = REGULAR_USER;
      req.workspaceId = WORKSPACE_ID;
      next();
    });
    const requireAuth = (req: any, res: any, next: any) => {
      if (!req.user) return res.status(401).json({ success: false, error: 'Auth required' });
      next();
    };
    app.get('/test-no-i18n', requireAuth, requireFlag('ai_multi_provider'), (_req, res) => {
      res.json({ success: true });
    });

    const res = await request(app).get('/test-no-i18n');
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('errors:flags.disabled');
  });
});

describe('PUT /api/admin/feature-flags/:orgId/:key — idempotent audit', () => {
  it('creates audit row even when setting same value twice', async () => {
    getOrgOverride.mockResolvedValue({ enabled: true });
    upsertOverride.mockResolvedValue({ organization_id: 'ws-1', flag_key: 'ai_multi_provider', enabled: true });

    const res = await request(buildApp({ user: SUPER_ADMIN }))
      .put('/api/admin/feature-flags/ws-1/ai_multi_provider')
      .send({ enabled: true });

    expect(res.status).toBe(200);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'feature_flag.override_set',
        details: expect.objectContaining({ before: true, after: true }),
      })
    );
  });
});

describe('DELETE then GET /api/me/flags flow', () => {
  it('returns default value after override is cleared', async () => {
    deleteOverride.mockResolvedValue(true);
    getOrgOverride.mockResolvedValue({ enabled: true });

    const delRes = await request(buildApp({ user: SUPER_ADMIN }))
      .delete('/api/admin/feature-flags/ws-1/ai_multi_provider');
    expect(delRes.status).toBe(200);

    const defaultFlags = { ai_multi_provider: false, payg_billing: false };
    (resolveAllFlags as any).mockResolvedValue(defaultFlags);

    const getRes = await request(buildApp({ user: REGULAR_USER, workspaceId: 'ws-1' }))
      .get('/api/me/flags');
    expect(getRes.status).toBe(200);
    expect(getRes.body.flags.ai_multi_provider).toBe(false);
  });
});

describe('cross-org access control', () => {
  it('returns 403 for non-superadmin accessing admin feature-flag routes', async () => {
    const res = await request(buildApp({ user: REGULAR_USER }))
      .put('/api/admin/feature-flags/other-org/ai_multi_provider')
      .send({ enabled: true });
    expect(res.status).toBe(403);
  });
});
