import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsFlagEnabled } = vi.hoisted(() => ({
  mockIsFlagEnabled: vi.fn(),
}));
vi.mock('../../utils/feature-flags', () => ({
  isFlagEnabled: (...args: any[]) => mockIsFlagEnabled(...args),
}));

import { requireFlag } from '../../middleware/require-flag';

function makeMocks(workspaceId?: string, tFn?: Function) {
  const req = {
    workspaceId,
    t: tFn ?? vi.fn((k: string) => k),
  } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireFlag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if no workspaceId', async () => {
    const { req, res, next } = makeMocks();
    await requireFlag('ci_integration' as any)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'errors:workspace.notResolved' }));
  });

  it('returns 403 if flag is disabled', async () => {
    mockIsFlagEnabled.mockResolvedValue(false);
    const { req, res, next } = makeMocks('ws-1');
    await requireFlag('ci_integration' as any)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('FEATURE_DISABLED');
  });

  it('calls next when flag is enabled', async () => {
    mockIsFlagEnabled.mockResolvedValue(true);
    const { req, res, next } = makeMocks('ws-1');
    await requireFlag('ci_integration' as any)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('uses t function for error message when available', async () => {
    mockIsFlagEnabled.mockResolvedValue(false);
    const tFn = vi.fn((k: string) => `translated:${k}`);
    const { req, res, next } = makeMocks('ws-1', tFn);
    await requireFlag('ci_integration' as any)(req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.error.message).toBe('translated:errors:flags.disabled');
  });

  it('falls back to key string when t is not available', async () => {
    mockIsFlagEnabled.mockResolvedValue(false);
    const req = { workspaceId: 'ws-1' } as any; // no t function
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await requireFlag('ci_integration' as any)(req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.error.message).toBe('errors:flags.disabled');
  });

  it('calls next(err) on thrown error', async () => {
    mockIsFlagEnabled.mockRejectedValue(new Error('db error'));
    const { req, res, next } = makeMocks('ws-1');
    await requireFlag('ci_integration' as any)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
