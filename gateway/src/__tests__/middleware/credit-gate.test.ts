import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCheckCreditBalance, mockConsumeCredits } = vi.hoisted(() => ({
  mockCheckCreditBalance: vi.fn(),
  mockConsumeCredits: vi.fn(),
}));
vi.mock('../../payments/payment-service', () => ({
  PaymentService: {
    checkCreditBalance: (...args: any[]) => mockCheckCreditBalance(...args),
    consumeCredits: (...args: any[]) => mockConsumeCredits(...args),
  },
}));

vi.mock('../../payments/credit-cost-mapper', () => ({
  getCreditCost: vi.fn((key: string) => {
    const costs: Record<string, number> = {
      TEST_GENERATION: 3,
      TEST_EXECUTION: 1,
    };
    return costs[key] ?? 0;
  }),
  getCreditDescription: vi.fn((key: string, detail?: string) => {
    const base = key === 'TEST_GENERATION' ? 'Test case generation' : key;
    return detail ? `${base}: ${detail}` : base;
  }),
}));

import { requireCredits, deductCredits } from '../../middleware/credit-gate';

function makeMocks(workspaceId?: string) {
  const req = { workspaceId } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireCredits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 if no workspaceId', async () => {
    const { req, res, next } = makeMocks();
    await requireCredits('TEST_GENERATION')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Workspace not resolved' }));
  });

  it('returns 402 if insufficient credits', async () => {
    mockCheckCreditBalance.mockResolvedValue({ hasEnough: false, balance: 1 });
    const { req, res, next } = makeMocks('ws-1');
    await requireCredits('TEST_GENERATION')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        details: expect.objectContaining({ required: 3, available: 1 }),
      }),
    );
  });

  it('calls next and attaches cost info if sufficient credits', async () => {
    mockCheckCreditBalance.mockResolvedValue({ hasEnough: true, balance: 50 });
    const { req, res, next } = makeMocks('ws-1');
    await requireCredits('TEST_GENERATION')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req._creditCost).toBe(3);
    expect(req._creditOperation).toBe('TEST_GENERATION');
  });

  it('accepts numeric cost instead of key', async () => {
    mockCheckCreditBalance.mockResolvedValue({ hasEnough: true, balance: 50 });
    const { req, res, next } = makeMocks('ws-1');
    await requireCredits(5)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req._creditCost).toBe(5);
    expect(req._creditOperation).toBeUndefined();
  });

  it('calls next(err) on thrown error', async () => {
    mockCheckCreditBalance.mockRejectedValue(new Error('db error'));
    const { req, res, next } = makeMocks('ws-1');
    await requireCredits('TEST_EXECUTION')(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('deductCredits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls PaymentService.consumeCredits with correct params', async () => {
    mockConsumeCredits.mockResolvedValue(undefined);
    await deductCredits('ws-1', 'TEST_GENERATION', 'session-123', 'session', 's-1');

    expect(mockConsumeCredits).toHaveBeenCalledWith(
      'ws-1',
      3,
      'Test case generation: session-123',
      'session',
      's-1',
    );
  });

  it('works without optional detail parameters', async () => {
    mockConsumeCredits.mockResolvedValue(undefined);
    await deductCredits('ws-1', 'TEST_EXECUTION');

    expect(mockConsumeCredits).toHaveBeenCalledWith(
      'ws-1',
      1,
      'TEST_EXECUTION',
      undefined,
      undefined,
    );
  });
});
