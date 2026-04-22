import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requireActiveSubscription } from '../middleware/subscription-check';

const mockFindByWorkspaceId = vi.fn();

vi.mock('../../shared/database/repositories/subscription-repository', () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByWorkspaceId: (...args: unknown[]) => mockFindByWorkspaceId(...args),
  })),
}));

function createMockReq(overrides: Record<string, unknown> = {}): Request {
  return { workspaceId: 'ws-1', ...overrides } as unknown as Request;
}

function createMockRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe('requireActiveSubscription', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  it('returns 401 when workspaceId is missing', async () => {
    const req = createMockReq({ workspaceId: undefined });
    const res = createMockRes();

    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 NO_SUBSCRIPTION when no subscription exists', async () => {
    mockFindByWorkspaceId.mockResolvedValue(null);
    const req = createMockReq();
    const res = createMockRes();

    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.status as any).mock.results[0].value.json.mock.calls[0][0];
    expect(body.code).toBe('NO_SUBSCRIPTION');
    expect(body.details.upgrade_url).toBe('/billing');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 SUBSCRIPTION_INACTIVE for canceled subscription', async () => {
    mockFindByWorkspaceId.mockResolvedValue({ status: 'canceled' });
    const req = createMockReq();
    const res = createMockRes();

    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.status as any).mock.results[0].value.json.mock.calls[0][0];
    expect(body.code).toBe('SUBSCRIPTION_INACTIVE');
    expect(body.details.status).toBe('canceled');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 SUBSCRIPTION_INACTIVE for past_due subscription', async () => {
    mockFindByWorkspaceId.mockResolvedValue({ status: 'past_due' });
    const req = createMockReq();
    const res = createMockRes();

    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.status as any).mock.results[0].value.json.mock.calls[0][0];
    expect(body.code).toBe('SUBSCRIPTION_INACTIVE');
    expect(body.details.status).toBe('past_due');
  });

  it('calls next() for active subscription', async () => {
    mockFindByWorkspaceId.mockResolvedValue({ status: 'active' });
    const req = createMockReq();
    const res = createMockRes();

    await requireActiveSubscription(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() for valid trialing subscription', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockFindByWorkspaceId.mockResolvedValue({
      status: 'trialing',
      trial_end: futureDate.toISOString(),
    });
    const req = createMockReq();
    const res = createMockRes();

    await requireActiveSubscription(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 TRIAL_EXPIRED when trial has ended', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockFindByWorkspaceId.mockResolvedValue({
      status: 'trialing',
      trial_end: pastDate.toISOString(),
    });
    const req = createMockReq();
    const res = createMockRes();

    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.status as any).mock.results[0].value.json.mock.calls[0][0];
    expect(body.code).toBe('TRIAL_EXPIRED');
    expect(body.details.trial_end).toBeDefined();
    expect(body.details.upgrade_url).toBe('/billing');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for trialing subscription without trial_end', async () => {
    mockFindByWorkspaceId.mockResolvedValue({
      status: 'trialing',
      trial_end: null,
    });
    const req = createMockReq();
    const res = createMockRes();

    await requireActiveSubscription(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('passes errors to next()', async () => {
    const dbError = new Error('connection refused');
    mockFindByWorkspaceId.mockRejectedValue(dbError);
    const req = createMockReq();
    const res = createMockRes();

    await requireActiveSubscription(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 SUBSCRIPTION_INACTIVE for unpaid subscription', async () => {
    mockFindByWorkspaceId.mockResolvedValue({ status: 'unpaid' });
    const req = createMockReq();
    const res = createMockRes();

    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.status as any).mock.results[0].value.json.mock.calls[0][0];
    expect(body.code).toBe('SUBSCRIPTION_INACTIVE');
  });

  it('returns 403 SUBSCRIPTION_INACTIVE for incomplete subscription', async () => {
    mockFindByWorkspaceId.mockResolvedValue({ status: 'incomplete' });
    const req = createMockReq();
    const res = createMockRes();

    await requireActiveSubscription(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.status as any).mock.results[0].value.json.mock.calls[0][0];
    expect(body.code).toBe('SUBSCRIPTION_INACTIVE');
  });
});
