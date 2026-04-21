import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsFlagEnabled } = vi.hoisted(() => ({
  mockIsFlagEnabled: vi.fn(),
}));
vi.mock('../../utils/feature-flags', () => ({
  isFlagEnabled: (...args: any[]) => mockIsFlagEnabled(...args),
}));

import { requireFlag } from '../../middleware/require-flag';

function makeMocks(workspaceId?: string) {
  const req = {
    workspaceId,
    t: vi.fn((k: string) => k),
  } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireFlag("recon_enabled")', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects with 404 when flag is disabled (indistinguishable from "feature doesn\'t exist")', async () => {
    mockIsFlagEnabled.mockResolvedValue(false);
    const { req, res, next } = makeMocks('ws-1');

    await requireFlag('recon_enabled' as any, { statusCode: 404 })(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('FEATURE_DISABLED');
  });

  it('calls next when flag is enabled', async () => {
    mockIsFlagEnabled.mockResolvedValue(true);
    const { req, res, next } = makeMocks('ws-1');

    await requireFlag('recon_enabled' as any, { statusCode: 404 })(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when no workspaceId is resolved', async () => {
    const { req, res, next } = makeMocks();

    await requireFlag('recon_enabled' as any, { statusCode: 404 })(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
