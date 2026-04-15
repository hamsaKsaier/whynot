import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { SystemSettingsRepository } from '../../database/repositories/system-settings-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('SystemSettingsRepository', () => {
  const repo = new SystemSettingsRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('get', () => {
    it('returns value when found', async () => {
      mockQuery.mockResolvedValue([{ value: 'dark' }]);
      expect(await repo.get('theme')).toBe('dark');
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.get('missing')).toBeNull();
    });
  });

  describe('getAll', () => {
    it('returns all settings', async () => {
      const settings = [{ key: 'a', value: '1' }];
      mockQuery.mockResolvedValue(settings);
      expect(await repo.getAll()).toEqual(settings);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY key'),
      );
    });
  });

  describe('set', () => {
    it('upserts setting and returns it', async () => {
      const setting = { key: 'theme', value: 'dark' };
      mockQuery.mockResolvedValue([setting]);
      const result = await repo.set('theme', 'dark', 'admin1');
      expect(result).toEqual(setting);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        ['theme', 'dark', 'admin1'],
      );
    });

    it('passes null when no updatedBy', async () => {
      mockQuery.mockResolvedValue([{ key: 'k' }]);
      await repo.set('k', 'v');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['k', 'v', null],
      );
    });
  });

  describe('delete', () => {
    it('returns true when deleted', async () => {
      mockQuery.mockResolvedValue([{ key: 'theme' }]);
      expect(await repo.delete('theme')).toBe(true);
    });

    it('returns false when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.delete('missing')).toBe(false);
    });
  });
});
