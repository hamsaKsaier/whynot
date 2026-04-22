import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockInsertBatch, mockIsManagedPaygTier, mockRecordUsageEvent } = vi.hoisted(() => ({
  mockInsertBatch: vi.fn().mockResolvedValue(['id-1']),
  mockIsManagedPaygTier: vi.fn().mockResolvedValue(false),
  mockRecordUsageEvent: vi.fn().mockResolvedValue({ ledgerEntryId: 'led-1', deltaCents: -50n }),
}));

vi.mock('../../shared/database/repositories/usage-event-repository', () => ({
  UsageEventRepository: vi.fn(() => ({
    insertBatch: mockInsertBatch,
  })),
}));

vi.mock('../../shared/logger/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../payments/subscription-manager', () => ({
  SubscriptionManager: {
    isManagedPaygTier: mockIsManagedPaygTier,
  },
}));

vi.mock('../payments/billing-service', () => ({
  BillingService: {
    recordUsageEvent: mockRecordUsageEvent,
  },
}));

vi.mock('../../shared/constants/pricing', () => ({
  DEFAULT_PAYG_RATES: {
    test_generation: 50n,
    test_execution: 10n,
  },
}));

import { recordUsageEvent, flush, _testReset, _testGetBuffer } from '../utils/usage-tracker';

describe('usage-tracker', () => {
  beforeEach(() => {
    _testReset();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    _testReset();
    vi.useRealTimers();
  });

  it('enqueues events into the buffer', () => {
    recordUsageEvent({
      workspaceId: 'ws-1',
      userId: 'u-1',
      eventType: 'test_generation',
    });

    expect(_testGetBuffer()).toHaveLength(1);
    expect(_testGetBuffer()[0]).toEqual({
      workspace_id: 'ws-1',
      user_id: 'u-1',
      event_type: 'test_generation',
      quantity: 1,
      metadata: undefined,
    });
  });

  it('flushes on interval', async () => {
    recordUsageEvent({ workspaceId: 'ws-1', eventType: 'test_execution' });
    expect(mockInsertBatch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(mockInsertBatch).toHaveBeenCalled();
  });

  it('flushes when batch size is reached', async () => {
    for (let i = 0; i < 100; i++) {
      recordUsageEvent({ workspaceId: 'ws-1', eventType: 'test_execution' });
    }

    // Let the flush promise settle
    await vi.advanceTimersByTimeAsync(0);

    expect(mockInsertBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ workspace_id: 'ws-1', event_type: 'test_execution' }),
      ]),
    );
  });

  it('flush() is a no-op when buffer is empty', async () => {
    await flush();
    expect(mockInsertBatch).not.toHaveBeenCalled();
  });

  it('flush() clears the buffer', async () => {
    recordUsageEvent({ workspaceId: 'ws-1', eventType: 'test_generation', quantity: 3 });
    recordUsageEvent({ workspaceId: 'ws-2', eventType: 'test_execution' });

    await flush();

    expect(_testGetBuffer()).toHaveLength(0);
    expect(mockInsertBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ workspace_id: 'ws-1', quantity: 3 }),
        expect.objectContaining({ workspace_id: 'ws-2', quantity: 1 }),
      ]),
    );
  });

  it('forwards events to PAYG billing for managed tier orgs', async () => {
    mockIsManagedPaygTier.mockResolvedValue(true);

    recordUsageEvent({ workspaceId: 'ws-payg', userId: 'u-1', eventType: 'test_generation' });

    await flush();

    expect(mockRecordUsageEvent).toHaveBeenCalledWith(
      {
        orgId: 'ws-payg',
        eventType: 'test_generation',
        quantity: 1,
        metadata: undefined,
      },
      { userId: 'u-1', orgId: 'ws-payg' },
    );
  });

  it('skips PAYG billing for non-managed orgs', async () => {
    mockIsManagedPaygTier.mockResolvedValue(false);

    recordUsageEvent({ workspaceId: 'ws-free', eventType: 'test_generation' });

    await flush();

    expect(mockRecordUsageEvent).not.toHaveBeenCalled();
  });

  it('skips PAYG billing when event type has no rate', async () => {
    mockIsManagedPaygTier.mockResolvedValue(true);

    recordUsageEvent({ workspaceId: 'ws-payg', eventType: 'unknown_event' });

    await flush();

    expect(mockRecordUsageEvent).not.toHaveBeenCalled();
  });

  it('handles multiple workspaces in a single batch for PAYG', async () => {
    mockIsManagedPaygTier.mockImplementation(async (id: string) => id === 'ws-payg');

    recordUsageEvent({ workspaceId: 'ws-payg', eventType: 'test_generation' });
    recordUsageEvent({ workspaceId: 'ws-free', eventType: 'test_generation' });
    recordUsageEvent({ workspaceId: 'ws-payg', eventType: 'test_execution' });

    await flush();

    expect(mockIsManagedPaygTier).toHaveBeenCalledWith('ws-payg');
    expect(mockIsManagedPaygTier).toHaveBeenCalledWith('ws-free');
    expect(mockRecordUsageEvent).toHaveBeenCalledTimes(2);
  });

  it('logs error but does not throw if insertBatch fails', async () => {
    mockInsertBatch.mockRejectedValueOnce(new Error('DB down'));

    recordUsageEvent({ workspaceId: 'ws-1', eventType: 'test_generation' });

    await expect(flush()).resolves.toBeUndefined();
    expect(_testGetBuffer()).toHaveLength(0);
  });
});
