import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { BillingConfigRepository } from '../../database/repositories/billing-config-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('BillingConfigRepository', () => {
  const repo = new BillingConfigRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('get', () => {
    it('returns value when found', async () => {
      mockQuery.mockResolvedValue([{ value: '100' }]);
      expect(await repo.get('max_credits')).toBe('100');
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.get('missing')).toBeNull();
    });
  });

  describe('getInt', () => {
    it('returns parsed integer when found', async () => {
      mockQuery.mockResolvedValue([{ value: '42' }]);
      expect(await repo.getInt('max', 0)).toBe(42);
    });

    it('returns default when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.getInt('missing', 10)).toBe(10);
    });

    it('returns default when value is not a number', async () => {
      mockQuery.mockResolvedValue([{ value: 'abc' }]);
      expect(await repo.getInt('bad', 5)).toBe(5);
    });
  });

  describe('getBigint', () => {
    it('returns parsed bigint when found', async () => {
      mockQuery.mockResolvedValue([{ value: '999999999999' }]);
      expect(await repo.getBigint('large', 0n)).toBe(999999999999n);
    });

    it('returns default when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.getBigint('missing', 100n)).toBe(100n);
    });

    it('returns default when value is not valid bigint', async () => {
      mockQuery.mockResolvedValue([{ value: 'not-a-number' }]);
      expect(await repo.getBigint('bad', 50n)).toBe(50n);
    });
  });

  describe('set', () => {
    it('upserts key-value pair', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.set('key1', 'val1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO billing_config'),
        ['key1', 'val1'],
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array),
      );
    });
  });

  describe('getAll', () => {
    it('returns all config entries', async () => {
      const entries = [{ key: 'a', value: '1' }, { key: 'b', value: '2' }];
      mockQuery.mockResolvedValue(entries);
      expect(await repo.getAll()).toEqual(entries);
    });
  });

  describe('delete', () => {
    it('deletes the config entry', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.delete('key1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM billing_config'),
        ['key1'],
      );
    });
  });
});
