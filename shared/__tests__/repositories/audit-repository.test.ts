import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { AuditRepository } from '../../database/repositories/audit-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('AuditRepository', () => {
  const repo = new AuditRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('log', () => {
    it('inserts audit log entry', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.log({ action: 'user.login', actor_id: 'u1', actor_email: 'a@b.com' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_log'),
        ['u1', 'a@b.com', 'user.login', null, null, '{}', null, null],
      );
    });

    it('serializes details as JSON', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.log({ action: 'test', details: { key: 'val' } });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_log'),
        expect.arrayContaining([JSON.stringify({ key: 'val' })]),
      );
    });
  });

  describe('findAll', () => {
    it('returns entries and total without filters', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce([{ id: '1' }]);
      const result = await repo.findAll();
      expect(result).toEqual({ entries: [{ id: '1' }], total: 10 });
    });

    it('applies actor_id filter', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([{ id: '1' }]);
      await repo.findAll({ actor_id: 'u1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('actor_id = $'),
        expect.arrayContaining(['u1']),
      );
    });

    it('applies all filters', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([{ id: '1' }]);
      await repo.findAll({
        actor_id: 'u1',
        action: 'login',
        target_type: 'user',
        target_id: 't1',
      });
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('uses custom offset and limit', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '50' }])
        .mockResolvedValueOnce([]);
      await repo.findAll({ offset: 10, limit: 20 });
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('findCursorPaginated', () => {
    it('returns entries and null nextCursor when no more', async () => {
      mockQuery.mockResolvedValue([{ id: '1', created_at: new Date() }]);
      const result = await repo.findCursorPaginated({ limit: 50 });
      expect(result.entries).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when hasMore', async () => {
      const rows = Array.from({ length: 51 }, (_, i) => ({
        id: `id-${i}`,
        created_at: new Date('2025-01-01'),
      }));
      mockQuery.mockResolvedValue(rows);
      const result = await repo.findCursorPaginated({ limit: 50 });
      expect(result.entries).toHaveLength(50);
      expect(result.nextCursor).toBeTruthy();
    });

    it('decodes cursor and applies it', async () => {
      const cursor = Buffer.from('2025-01-01T00:00:00.000Z|abc').toString('base64');
      mockQuery.mockResolvedValue([]);
      await repo.findCursorPaginated({ cursor, limit: 10 });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('(created_at, id) <'),
        expect.arrayContaining(['2025-01-01T00:00:00.000Z', 'abc']),
      );
    });

    it('ignores invalid cursor gracefully', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await repo.findCursorPaginated({ cursor: 'not-valid-base64!!!' });
      expect(result.entries).toEqual([]);
    });

    it('applies date range filters', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.findCursorPaginated({ from: '2025-01-01', to: '2025-12-31' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('created_at >='),
        expect.arrayContaining(['2025-01-01', '2025-12-31']),
      );
    });

    it('caps limit at 100', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.findCursorPaginated({ limit: 200 });
      // fetchLimit should be 100, so LIMIT param is 101
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([101]),
      );
    });
  });
});
