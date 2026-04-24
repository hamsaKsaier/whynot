import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { ReconScanArtifactRepository } from '../../database/repositories/recon-scan-artifact-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('ReconScanArtifactRepository', () => {
  const repo = new ReconScanArtifactRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('insert', () => {
    it('inserts an artifact row', async () => {
      mockQuery.mockResolvedValue([{ id: 'a-1' }]);
      const result = await repo.insert({
        scan_id: 's-1',
        phase: 'discovery',
        kind: 'json',
        storage_url: 's3://bucket/obj.json',
        size_bytes: 1234,
      });
      expect(result).toEqual({ id: 'a-1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO recon_scan_artifacts'),
        ['s-1', 'discovery', 'json', 's3://bucket/obj.json', 1234],
      );
    });
  });

  describe('listByScan', () => {
    it('lists all artifacts for a scan', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.listByScan('s-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringMatching(/WHERE scan_id = \$1\s+ORDER BY created_at/),
        ['s-1'],
      );
    });

    it('filters by phase when provided', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.listByScan('s-1', 'exploitation');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND phase = $2'),
        ['s-1', 'exploitation'],
      );
    });
  });
});
