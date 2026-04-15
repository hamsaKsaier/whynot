import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requireCredits, deductCredits } from '../middleware/credit-gate';

const mockCheckCreditBalance = vi.fn();
const mockConsumeCredits = vi.fn();

vi.mock('../payments/payment-service', () => ({
  PaymentService: {
    checkCreditBalance: (...args: unknown[]) => mockCheckCreditBalance(...args),
    consumeCredits: (...args: unknown[]) => mockConsumeCredits(...args),
  },
}));

vi.mock('../payments/credit-cost-mapper', async () => {
  const actual: Record<string, unknown> = await vi.importActual('../payments/credit-cost-mapper');
  return actual;
});

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

describe('requireCredits', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  it('returns 401 when workspaceId is missing', async () => {
    const middleware = requireCredits('TEST_GENERATION');
    const req = createMockReq({ workspaceId: undefined });
    const res = createMockRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 402 INSUFFICIENT_CREDITS when balance is too low', async () => {
    mockCheckCreditBalance.mockResolvedValue({ hasEnough: false, balance: 1 });
    const middleware = requireCredits('TEST_GENERATION');
    const req = createMockReq();
    const res = createMockRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    const body = (res.status as any).mock.results[0].value.json.mock.calls[0][0];
    expect(body.code).toBe('INSUFFICIENT_CREDITS');
    expect(body.details.required).toBe(3); // TEST_GENERATION costs 3
    expect(body.details.available).toBe(1);
    expect(body.details.upgrade_url).toBe('/billing');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and attaches credit info when balance is sufficient', async () => {
    mockCheckCreditBalance.mockResolvedValue({ hasEnough: true, balance: 100 });
    const middleware = requireCredits('TEST_GENERATION');
    const req = createMockReq();
    const res = createMockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as any)._creditCost).toBe(3);
    expect((req as any)._creditOperation).toBe('TEST_GENERATION');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('accepts numeric cost instead of CreditCostKey', async () => {
    mockCheckCreditBalance.mockResolvedValue({ hasEnough: true, balance: 50 });
    const middleware = requireCredits(7);
    const req = createMockReq();
    const res = createMockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(mockCheckCreditBalance).toHaveBeenCalledWith('ws-1', 7);
    expect((req as any)._creditCost).toBe(7);
    expect((req as any)._creditOperation).toBeUndefined();
  });

  it('passes errors to next()', async () => {
    const dbError = new Error('db down');
    mockCheckCreditBalance.mockRejectedValue(dbError);
    const middleware = requireCredits('TEST_EXECUTION');
    const req = createMockReq();
    const res = createMockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('uses correct cost for each operation key', async () => {
    mockCheckCreditBalance.mockResolvedValue({ hasEnough: false, balance: 0 });

    const operations = [
      { key: 'TEST_GENERATION', cost: 3 },
      { key: 'TEST_EXECUTION', cost: 1 },
      { key: 'QA_LOOP_ITERATION', cost: 2 },
      { key: 'AUTO_FIX_ATTEMPT', cost: 5 },
      { key: 'CI_SCAN', cost: 10 },
    ] as const;

    for (const { key, cost } of operations) {
      vi.clearAllMocks();
      mockCheckCreditBalance.mockResolvedValue({ hasEnough: false, balance: 0 });
      const middleware = requireCredits(key as any);
      const req = createMockReq();
      const res = createMockRes();

      await middleware(req, res, next);

      const body = (res.status as any).mock.results[0].value.json.mock.calls[0][0];
      expect(body.details.required).toBe(cost);
    }
  });
});

describe('deductCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deducts correct cost for operation', async () => {
    mockConsumeCredits.mockResolvedValue(undefined);

    await deductCredits('ws-1', 'TEST_GENERATION', 'Generate login tests');

    expect(mockConsumeCredits).toHaveBeenCalledOnce();
    expect(mockConsumeCredits).toHaveBeenCalledWith(
      'ws-1',
      3, // TEST_GENERATION cost
      expect.stringContaining('Generate login tests'),
      undefined,
      undefined,
    );
  });

  it('passes reference type and id when provided', async () => {
    mockConsumeCredits.mockResolvedValue(undefined);

    await deductCredits('ws-1', 'TEST_EXECUTION', 'Run test', 'execution', 'exec-123');

    expect(mockConsumeCredits).toHaveBeenCalledWith(
      'ws-1',
      1, // TEST_EXECUTION cost
      expect.any(String),
      'execution',
      'exec-123',
    );
  });

  it('throws when consumeCredits fails', async () => {
    mockConsumeCredits.mockRejectedValue(new Error('ledger write failed'));

    await expect(
      deductCredits('ws-1', 'TEST_GENERATION'),
    ).rejects.toThrow('ledger write failed');
  });
});
