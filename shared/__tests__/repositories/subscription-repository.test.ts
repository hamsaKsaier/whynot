import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { SubscriptionRepository } from '../../database/repositories/subscription-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('SubscriptionRepository', () => {
  const repo = new SubscriptionRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('findByWorkspaceId', () => {
    it('returns subscription when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'sub1' }]);
      expect(await repo.findByWorkspaceId('ws1')).toEqual({ id: 'sub1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByWorkspaceId('ws1')).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns subscription when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'sub1' }]);
      expect(await repo.findById('sub1')).toEqual({ id: 'sub1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('findByStripeSubscriptionId', () => {
    it('returns subscription when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'sub1' }]);
      expect(await repo.findByStripeSubscriptionId('stripe_1')).toEqual({ id: 'sub1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByStripeSubscriptionId('missing')).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts subscription with defaults', async () => {
      mockQuery.mockResolvedValue([{ id: 'sub1' }]);
      const result = await repo.create({ workspace_id: 'ws1', plan_id: 'p1' });
      expect(result).toEqual({ id: 'sub1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workspace_subscriptions'),
        ['ws1', 'p1', 'active', null, null, null, null, null, null],
      );
    });
  });

  describe('update', () => {
    it('updates provided fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'sub1', status: 'canceled' }]);
      const result = await repo.update('sub1', { status: 'canceled' });
      expect(result).toEqual({ id: 'sub1', status: 'canceled' });
    });

    it('falls back to findById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'sub1' }]);
      await repo.update('sub1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['sub1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.update('missing', { status: 'active' })).toBeNull();
    });
  });

  describe('updateByWorkspaceId', () => {
    it('updates subscription by workspace', async () => {
      mockQuery.mockResolvedValue([{ id: 'sub1' }]);
      const result = await repo.updateByWorkspaceId('ws1', { status: 'paused' });
      expect(result).toEqual({ id: 'sub1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE workspace_id'),
        ['paused', 'ws1'],
      );
    });

    it('falls back to findByWorkspaceId when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'sub1' }]);
      await repo.updateByWorkspaceId('ws1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $1'),
        ['ws1'],
      );
    });
  });

  describe('findAllPaginated', () => {
    it('returns subscriptions and total without filters', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce([{ id: 'sub1' }]);
      const result = await repo.findAllPaginated(0, 10);
      expect(result).toEqual({ subscriptions: [{ id: 'sub1' }], total: 10 });
    });

    it('applies status filter', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([]);
      await repo.findAllPaginated(0, 10, { status: 'active' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining(['active']),
      );
    });

    it('applies plan_id filter', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([]);
      await repo.findAllPaginated(0, 10, { plan_id: 'p1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('plan_id'),
        expect.arrayContaining(['p1']),
      );
    });
  });

  describe('findAllActive', () => {
    it('returns active and trialing subscriptions', async () => {
      mockQuery.mockResolvedValue([{ id: 'sub1' }]);
      const result = await repo.findAllActive();
      expect(result).toEqual([{ id: 'sub1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'active', 'trialing'"),
      );
    });
  });

  describe('findExpiring', () => {
    it('returns trialing subscriptions expiring before date', async () => {
      const date = new Date('2025-12-31');
      mockQuery.mockResolvedValue([{ id: 'sub1' }]);
      const result = await repo.findExpiring(date);
      expect(result).toEqual([{ id: 'sub1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('trial_end <= $1'),
        [date],
      );
    });
  });

  describe('countByPlan', () => {
    it('returns counts grouped by plan', async () => {
      mockQuery.mockResolvedValue([
        { plan_id: 'p1', count: '10' },
        { plan_id: 'p2', count: '5' },
      ]);
      const result = await repo.countByPlan();
      expect(result).toEqual([
        { plan_id: 'p1', count: 10 },
        { plan_id: 'p2', count: 5 },
      ]);
    });
  });
});
