import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));

import { query, transaction } from '../../database/connection';
import { SelectorLearningRepository } from '../../database/repositories/selector-learning-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockTransaction = transaction as ReturnType<typeof vi.fn>;

describe('SelectorLearningRepository', () => {
  const repo = new SelectorLearningRepository();

  beforeEach(() => {
    mockQuery.mockReset();
    mockTransaction.mockReset();
  });

  describe('findByStep', () => {
    it('returns learning entity when found', async () => {
      const entity = { id: 'sl1', test_case_id: 'tc1', step_id: 's1' };
      mockQuery.mockResolvedValue([entity]);
      expect(await repo.findByStep('tc1', 's1')).toEqual(entity);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('test_case_id = $1 AND step_id = $2'),
        ['tc1', 's1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByStep('tc1', 's1')).toBeNull();
    });
  });

  describe('findByPageState', () => {
    it('returns matching entities', async () => {
      mockQuery.mockResolvedValue([{ id: 'sl1' }]);
      const result = await repo.findByPageState('hash123', { tag: 'button' } as any);
      expect(result).toEqual([{ id: 'sl1' }]);
    });
  });

  describe('saveProvenSelector', () => {
    it('creates new record via transaction when none exists', async () => {
      const newEntity = { id: 'sl1', success_count: 1 };
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [] }) // no existing
            .mockResolvedValueOnce({ rows: [newEntity] }), // insert
        };
        return cb(mockClient);
      });
      const result = await repo.saveProvenSelector(
        'tc1', 's1',
        { tag: 'button' } as any,
        { type: 'css', value: '.btn' } as any,
      );
      expect(result).toEqual(newEntity);
    });

    it('updates existing record when selector already tracked', async () => {
      const updatedEntity = { id: 'sl1', success_count: 2 };
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({
              rows: [{
                proven_selectors: [{ type: 'css', value: '.btn', success_count: 1 }],
              }],
            })
            .mockResolvedValueOnce({ rows: [updatedEntity] }),
        };
        return cb(mockClient);
      });
      const result = await repo.saveProvenSelector(
        'tc1', 's1',
        { tag: 'button' } as any,
        { type: 'css', value: '.btn' } as any,
      );
      expect(result).toEqual(updatedEntity);
    });

    it('adds new selector to existing record', async () => {
      const updatedEntity = { id: 'sl1', success_count: 2 };
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({
              rows: [{
                proven_selectors: [{ type: 'css', value: '.old' }],
              }],
            })
            .mockResolvedValueOnce({ rows: [updatedEntity] }),
        };
        return cb(mockClient);
      });
      const result = await repo.saveProvenSelector(
        'tc1', 's1',
        { tag: 'button' } as any,
        { type: 'css', value: '.new' } as any,
      );
      expect(result).toEqual(updatedEntity);
    });
  });

  describe('updateLastUsed', () => {
    it('updates last_used_at timestamp', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.updateLastUsed('sl1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE selector_learning SET last_used_at'),
        ['sl1'],
      );
    });
  });

  describe('deleteOldRecords', () => {
    it('deletes records older than specified days', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await repo.deleteOldRecords(30);
      expect(result).toBe(0);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM selector_learning'),
        [30],
      );
    });

    it('uses default of 90 days', async () => {
      mockQuery.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const result = await repo.deleteOldRecords();
      expect(result).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [90],
      );
    });

    it('throws on non-finite input', async () => {
      await expect(repo.deleteOldRecords(NaN)).rejects.toThrow('must be a finite number');
    });
  });

  describe('trackSelectorAttempt', () => {
    it('creates new record when none exists', async () => {
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 'sl1' }] }),
        };
        return cb(mockClient);
      });
      await repo.trackSelectorAttempt('tc1', 's1', { type: 'css', value: '.btn' } as any, true);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('updates existing record with success', async () => {
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({
              rows: [{
                proven_selectors: [{ type: 'css', value: '.btn', success_count: 1, failure_count: 0 }],
              }],
            })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return cb(mockClient);
      });
      await repo.trackSelectorAttempt('tc1', 's1', { type: 'css', value: '.btn' } as any, true);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('adds new selector if not in existing list', async () => {
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({
              rows: [{
                proven_selectors: [{ type: 'css', value: '.other' }],
              }],
            })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return cb(mockClient);
      });
      await repo.trackSelectorAttempt('tc1', 's1', { type: 'css', value: '.new' } as any, false);
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('getHighConfidenceSelectors', () => {
    it('returns selectors above threshold', async () => {
      mockQuery.mockResolvedValue([{
        proven_selectors: [
          { type: 'css', value: '.good', success_count: 9, failure_count: 1, success_rate: 0.9 },
          { type: 'css', value: '.bad', success_count: 1, failure_count: 9, success_rate: 0.1 },
        ],
      }]);
      const result = await repo.getHighConfidenceSelectors('tc1', 's1');
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('.good');
    });

    it('returns empty array when no learning exists', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.getHighConfidenceSelectors('tc1', 's1')).toEqual([]);
    });

    it('includes selectors with old format (success_count > 0, no attempts)', async () => {
      mockQuery.mockResolvedValue([{
        proven_selectors: [
          { type: 'css', value: '.legacy', success_count: 5 },
        ],
      }]);
      const result = await repo.getHighConfidenceSelectors('tc1', 's1');
      expect(result).toHaveLength(1);
    });
  });
});
