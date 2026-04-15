import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindByWorkspaceId, mockGetFeatures } = vi.hoisted(() => ({
  mockFindByWorkspaceId: vi.fn(),
  mockGetFeatures: vi.fn(),
}));

vi.mock('../../../shared/database/repositories/subscription-repository', () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByWorkspaceId: mockFindByWorkspaceId,
  })),
}));

vi.mock('../../../shared/database/repositories/plan-repository', () => ({
  PlanRepository: vi.fn().mockImplementation(() => ({
    getFeatures: mockGetFeatures,
  })),
}));

import { requireFeature, requireFeatureLimit } from '../../middleware/feature-gate';

// Use unique workspace IDs per test to avoid feature cache interference
let wsCounter = 0;
function uniqueWsId() {
  return `ws-fg-${++wsCounter}`;
}

function makeMocks(workspaceId?: string) {
  const req = { workspaceId } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireFeature', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if no workspaceId', async () => {
    const { req, res, next } = makeMocks();
    await requireFeature('advanced_reporting')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 if feature not in plan', async () => {
    const wsId = uniqueWsId();
    mockFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-1' });
    mockGetFeatures.mockResolvedValue([]);
    const { req, res, next } = makeMocks(wsId);
    await requireFeature('advanced_reporting')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FEATURE_NOT_AVAILABLE',
        details: expect.objectContaining({ feature: 'advanced_reporting' }),
      }),
    );
  });

  it('returns 403 if feature value is "false"', async () => {
    const wsId = uniqueWsId();
    mockFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-1' });
    mockGetFeatures.mockResolvedValue([{ feature_key: 'ci_integration', feature_value: 'false' }]);
    const { req, res, next } = makeMocks(wsId);
    await requireFeature('ci_integration')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 403 if feature value is "0"', async () => {
    const wsId = uniqueWsId();
    mockFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-1' });
    mockGetFeatures.mockResolvedValue([{ feature_key: 'ci_integration', feature_value: '0' }]);
    const { req, res, next } = makeMocks(wsId);
    await requireFeature('ci_integration')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next and attaches features when feature is available', async () => {
    const wsId = uniqueWsId();
    mockFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-1' });
    mockGetFeatures.mockResolvedValue([
      { feature_key: 'ci_integration', feature_value: 'true' },
      { feature_key: 'max_projects', feature_value: '10' },
    ]);
    const { req, res, next } = makeMocks(wsId);
    await requireFeature('ci_integration')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req._planFeatures).toEqual({
      ci_integration: 'true',
      max_projects: '10',
    });
  });

  it('returns 403 when no subscription exists', async () => {
    const wsId = uniqueWsId();
    mockFindByWorkspaceId.mockResolvedValue(null);
    const { req, res, next } = makeMocks(wsId);
    await requireFeature('ci_integration')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next(err) on error', async () => {
    const wsId = uniqueWsId();
    mockFindByWorkspaceId.mockRejectedValue(new Error('db error'));
    const { req, res, next } = makeMocks(wsId);
    await requireFeature('ci_integration')(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('requireFeatureLimit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if no workspaceId', async () => {
    const countFn = vi.fn().mockResolvedValue(0);
    const { req, res, next } = makeMocks();
    await requireFeatureLimit('max_projects', countFn)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('allows when under limit', async () => {
    const wsId = uniqueWsId();
    mockFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-1' });
    mockGetFeatures.mockResolvedValue([{ feature_key: 'max_projects', feature_value: '10' }]);
    const countFn = vi.fn().mockResolvedValue(5);
    const { req, res, next } = makeMocks(wsId);
    await requireFeatureLimit('max_projects', countFn)(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('blocks when at limit', async () => {
    const wsId = uniqueWsId();
    mockFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-1' });
    mockGetFeatures.mockResolvedValue([{ feature_key: 'max_projects', feature_value: '5' }]);
    const countFn = vi.fn().mockResolvedValue(5);
    const { req, res, next } = makeMocks(wsId);
    await requireFeatureLimit('max_projects', countFn)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FEATURE_LIMIT_REACHED',
        details: expect.objectContaining({ limit: 5, current: 5 }),
      }),
    );
  });

  it('allows when feature is "unlimited"', async () => {
    const wsId = uniqueWsId();
    mockFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-1' });
    mockGetFeatures.mockResolvedValue([{ feature_key: 'max_projects', feature_value: 'unlimited' }]);
    const countFn = vi.fn().mockResolvedValue(999);
    const { req, res, next } = makeMocks(wsId);
    await requireFeatureLimit('max_projects', countFn)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(countFn).not.toHaveBeenCalled();
  });

  it('allows when feature not set (no limit)', async () => {
    const wsId = uniqueWsId();
    mockFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-1' });
    mockGetFeatures.mockResolvedValue([]);
    const countFn = vi.fn().mockResolvedValue(999);
    const { req, res, next } = makeMocks(wsId);
    await requireFeatureLimit('max_projects', countFn)(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('allows when feature value is NaN', async () => {
    const wsId = uniqueWsId();
    mockFindByWorkspaceId.mockResolvedValue({ plan_id: 'plan-1' });
    mockGetFeatures.mockResolvedValue([{ feature_key: 'max_projects', feature_value: 'not-a-number' }]);
    const countFn = vi.fn().mockResolvedValue(999);
    const { req, res, next } = makeMocks(wsId);
    await requireFeatureLimit('max_projects', countFn)(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('calls next(err) on error', async () => {
    const wsId = uniqueWsId();
    mockFindByWorkspaceId.mockRejectedValue(new Error('db error'));
    const countFn = vi.fn();
    const { req, res, next } = makeMocks(wsId);
    await requireFeatureLimit('max_projects', countFn)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
