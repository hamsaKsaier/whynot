import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { AnnouncementRepository } from '../../database/repositories/announcement-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('AnnouncementRepository', () => {
  const repo = new AnnouncementRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('findAll', () => {
    it('returns all announcements', async () => {
      const announcements = [{ id: '1', title: 'A' }];
      mockQuery.mockResolvedValue(announcements);
      expect(await repo.findAll()).toEqual(announcements);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM announcements ORDER BY created_at DESC'),
      );
    });
  });

  describe('findActive', () => {
    it('returns active announcements within date range', async () => {
      mockQuery.mockResolvedValue([{ id: '1' }]);
      const result = await repo.findActive();
      expect(result).toEqual([{ id: '1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active = true'),
      );
    });
  });

  describe('findById', () => {
    it('returns announcement when found', async () => {
      mockQuery.mockResolvedValue([{ id: '1' }]);
      expect(await repo.findById('1')).toEqual({ id: '1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts with defaults and returns announcement', async () => {
      const ann = { id: '1', title: 'Hello' };
      mockQuery.mockResolvedValue([ann]);
      const result = await repo.create({ title: 'Hello' });
      expect(result).toEqual(ann);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO announcements'),
        ['Hello', null, 'info', true, null, null, null],
      );
    });

    it('passes all fields when provided', async () => {
      const starts = new Date('2025-01-01');
      const ends = new Date('2025-12-31');
      mockQuery.mockResolvedValue([{ id: '1' }]);
      await repo.create({
        title: 'T',
        body: 'B',
        type: 'warning',
        is_active: false,
        starts_at: starts,
        ends_at: ends,
        created_by: 'admin',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO announcements'),
        ['T', 'B', 'warning', false, starts, ends, 'admin'],
      );
    });
  });

  describe('update', () => {
    it('updates provided fields', async () => {
      mockQuery.mockResolvedValue([{ id: '1', title: 'Updated' }]);
      const result = await repo.update('1', { title: 'Updated' });
      expect(result).toEqual({ id: '1', title: 'Updated' });
    });

    it('falls back to findById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: '1' }]);
      await repo.update('1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.update('missing', { title: 'X' })).toBeNull();
    });

    it('builds dynamic SET for multiple fields', async () => {
      mockQuery.mockResolvedValue([{ id: '1' }]);
      await repo.update('1', { title: 'T', body: 'B', type: 'error', is_active: false });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE announcements SET'),
        ['T', 'B', 'error', false, '1'],
      );
    });
  });

  describe('delete', () => {
    it('returns true when deleted', async () => {
      mockQuery.mockResolvedValue([{ id: '1' }]);
      expect(await repo.delete('1')).toBe(true);
    });

    it('returns false when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.delete('missing')).toBe(false);
    });
  });
});
