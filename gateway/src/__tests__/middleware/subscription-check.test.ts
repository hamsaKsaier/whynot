import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindByWorkspaceId } = vi.hoisted(() => ({
  mockFindByWorkspaceId: vi.fn(),
}));
vi.mock('../../../shared/database/repositories/subscription-repository', () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByWorkspaceId: mockFindByWorkspaceId,
  })),
}));

import { requireActiveSubscription } from '../../middleware/subscription-check';

function makeMocks(workspaceId?: string) {
  const req = { workspaceId } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireActiveSubscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if no workspaceId', async () => {
    const { req, res, next } = makeMocks();
    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 with NO_SUBSCRIPTION when no subscription exists', async () => {
    mockFindByWorkspaceId.mockResolvedValue(null);
    const { req, res, next } = makeMocks('ws-1');
    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NO_SUBSCRIPTION' }),
    );
  });

  it('returns 403 with SUBSCRIPTION_INACTIVE for canceled subscription', async () => {
    mockFindByWorkspaceId.mockResolvedValue({ status: 'canceled' });
    const { req, res, next } = makeMocks('ws-1');
    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'SUBSCRIPTION_INACTIVE',
        details: expect.objectContaining({ status: 'canceled' }),
      }),
    );
  });

  it('returns 403 with SUBSCRIPTION_INACTIVE for past_due', async () => {
    mockFindByWorkspaceId.mockResolvedValue({ status: 'past_due' });
    const { req, res, next } = makeMocks('ws-1');
    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next for active subscription', async () => {
    mockFindByWorkspaceId.mockResolvedValue({ status: 'active' });
    const { req, res, next } = makeMocks('ws-1');
    await requireActiveSubscription(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('calls next for trialing subscription with future trial_end', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    mockFindByWorkspaceId.mockResolvedValue({ status: 'trialing', trial_end: futureDate });
    const { req, res, next } = makeMocks('ws-1');
    await requireActiveSubscription(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 with TRIAL_EXPIRED for expired trial', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    mockFindByWorkspaceId.mockResolvedValue({ status: 'trialing', trial_end: pastDate });
    const { req, res, next } = makeMocks('ws-1');
    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TRIAL_EXPIRED' }),
    );
  });

  it('allows trialing subscription with no trial_end date', async () => {
    mockFindByWorkspaceId.mockResolvedValue({ status: 'trialing', trial_end: null });
    const { req, res, next } = makeMocks('ws-1');
    await requireActiveSubscription(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('calls next(err) on thrown error', async () => {
    mockFindByWorkspaceId.mockRejectedValue(new Error('db error'));
    const { req, res, next } = makeMocks('ws-1');
    await requireActiveSubscription(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
