import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { PlanRepository } from '../../database/repositories/plan-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('PlanRepository', () => {
  const repo = new PlanRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('findAll', () => {
    it('returns all plans ordered by sort_order', async () => {
      const plans = [{ id: 'p1' }, { id: 'p2' }];
      mockQuery.mockResolvedValue(plans);
      expect(await repo.findAll()).toEqual(plans);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY sort_order ASC'),
      );
    });
  });

  describe('findPublicPlans', () => {
    it('returns public non-archived plans', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1' }]);
      const result = await repo.findPublicPlans();
      expect(result).toEqual([{ id: 'p1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_public = true AND is_archived = false'),
      );
    });
  });

  describe('findById', () => {
    it('returns plan when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1' }]);
      expect(await repo.findById('p1')).toEqual({ id: 'p1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('findBySlug', () => {
    it('returns plan when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1', slug: 'pro' }]);
      expect(await repo.findBySlug('pro')).toEqual({ id: 'p1', slug: 'pro' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findBySlug('missing')).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts plan with defaults', async () => {
      const plan = { id: 'p1' };
      mockQuery.mockResolvedValue([plan]);
      const result = await repo.create({
        name: 'Pro',
        slug: 'pro',
        price_cents: 2900,
        credits_per_period: 100,
      });
      expect(result).toEqual(plan);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO plans'),
        ['Pro', 'pro', null, 2900, 'monthly', 100, 0, false, true, 0],
      );
    });
  });

  describe('update', () => {
    it('updates provided fields', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1' }]);
      await repo.update('p1', { name: 'New Pro' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE plans SET'),
        ['New Pro', 'p1'],
      );
    });

    it('falls back to findById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1' }]);
      await repo.update('p1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['p1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.update('missing', { name: 'X' })).toBeNull();
    });
  });

  describe('archive', () => {
    it('sets is_archived to true', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1', is_archived: true }]);
      const result = await repo.archive('p1');
      expect(result).toEqual({ id: 'p1', is_archived: true });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_archived = true'),
        ['p1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.archive('missing')).toBeNull();
    });
  });

  describe('restore', () => {
    it('sets is_archived to false', async () => {
      mockQuery.mockResolvedValue([{ id: 'p1', is_archived: false }]);
      const result = await repo.restore('p1');
      expect(result).toEqual({ id: 'p1', is_archived: false });
    });
  });

  describe('getFeatures', () => {
    it('returns features for plan', async () => {
      mockQuery.mockResolvedValue([{ id: 'pf1', feature_key: 'api_access' }]);
      const result = await repo.getFeatures('p1');
      expect(result).toEqual([{ id: 'pf1', feature_key: 'api_access' }]);
    });
  });

  describe('setFeature', () => {
    it('upserts feature', async () => {
      mockQuery.mockResolvedValue([{ id: 'pf1' }]);
      const result = await repo.setFeature('p1', 'api_access', 'true');
      expect(result).toEqual({ id: 'pf1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        ['p1', 'api_access', 'true'],
      );
    });
  });

  describe('setFeatures', () => {
    it('sets multiple features', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'pf1' }])
        .mockResolvedValueOnce([{ id: 'pf2' }]);
      const result = await repo.setFeatures('p1', { api: 'true', storage: '10gb' });
      expect(result).toHaveLength(2);
    });
  });

  describe('removeFeature', () => {
    it('deletes feature and returns true', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.removeFeature('p1', 'api_access')).toBe(true);
    });
  });

  describe('findAllWithFeatures', () => {
    it('returns plans with attached features', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }]) // findAll
        .mockResolvedValueOnce([
          { id: 'pf1', plan_id: 'p1', feature_key: 'api' },
          { id: 'pf2', plan_id: 'p2', feature_key: 'storage' },
        ]); // all features
      const result = await repo.findAllWithFeatures();
      expect(result).toHaveLength(2);
      expect(result[0].features).toEqual([{ id: 'pf1', plan_id: 'p1', feature_key: 'api' }]);
      expect(result[1].features).toEqual([{ id: 'pf2', plan_id: 'p2', feature_key: 'storage' }]);
    });
  });

  describe('countSubscribers', () => {
    it('returns subscriber count', async () => {
      mockQuery.mockResolvedValue([{ count: '42' }]);
      expect(await repo.countSubscribers('p1')).toBe(42);
    });
  });
});
