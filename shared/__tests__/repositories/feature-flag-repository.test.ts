import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { FeatureFlagRepository } from '../../database/repositories/feature-flag-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('FeatureFlagRepository', () => {
  const repo = new FeatureFlagRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('listFlags', () => {
    it('returns all feature flags ordered by key', async () => {
      const flags = [{ key: 'a' }, { key: 'b' }];
      mockQuery.mockResolvedValue(flags);
      const result = await repo.listFlags();
      expect(result).toEqual(flags);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM feature_flags ORDER BY key'),
      );
    });
  });

  describe('getByKey', () => {
    it('returns flag when found', async () => {
      mockQuery.mockResolvedValue([{ key: 'dark_mode' }]);
      expect(await repo.getByKey('dark_mode')).toEqual({ key: 'dark_mode' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.getByKey('nope')).toBeNull();
    });
  });

  describe('getOrgOverride', () => {
    it('returns override when found', async () => {
      const override = { organization_id: 'org1', flag_key: 'f1', enabled: true };
      mockQuery.mockResolvedValue([override]);
      expect(await repo.getOrgOverride('org1', 'f1')).toEqual(override);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.getOrgOverride('org1', 'f1')).toBeNull();
    });
  });

  describe('listOrgOverrides', () => {
    it('returns overrides for an org', async () => {
      const overrides = [{ flag_key: 'a' }, { flag_key: 'b' }];
      mockQuery.mockResolvedValue(overrides);
      const result = await repo.listOrgOverrides('org1');
      expect(result).toEqual(overrides);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('organization_id = $1'),
        ['org1'],
      );
    });
  });

  describe('upsertOverride', () => {
    it('inserts or updates override and returns it', async () => {
      const override = { organization_id: 'org1', flag_key: 'f1', enabled: true };
      mockQuery.mockResolvedValue([override]);
      const result = await repo.upsertOverride('org1', 'f1', true, 'admin1');
      expect(result).toEqual(override);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        ['org1', 'f1', true, 'admin1'],
      );
    });
  });

  describe('deleteOverride', () => {
    it('returns true when override was deleted', async () => {
      mockQuery.mockResolvedValue([{ flag_key: 'f1' }]);
      expect(await repo.deleteOverride('org1', 'f1')).toBe(true);
    });

    it('returns false when override not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.deleteOverride('org1', 'f1')).toBe(false);
    });
  });

  describe('listAllOrgOverridesWithFlags', () => {
    it('returns flags with join data', async () => {
      const data = [{ key: 'a', override_enabled: true }, { key: 'b', override_enabled: null }];
      mockQuery.mockResolvedValue(data);
      const result = await repo.listAllOrgOverridesWithFlags('org1');
      expect(result).toEqual(data);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN organization_feature_flags'),
        ['org1'],
      );
    });
  });
});
