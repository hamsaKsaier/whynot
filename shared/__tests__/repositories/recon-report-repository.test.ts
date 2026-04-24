import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { ReconReportRepository } from '../../database/repositories/recon-report-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('ReconReportRepository', () => {
  const repo = new ReconReportRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('upsert', () => {
    it('inserts or updates a report by scan_id', async () => {
      mockQuery.mockResolvedValue([{ id: 'r-1', scan_id: 's-1' }]);
      const result = await repo.upsert({
        scan_id: 's-1',
        markdown: '# report',
        summary: { total: 3, by_severity: { high: 1 }, by_class: { xss: 1 } },
      });
      expect(result).toEqual({ id: 'r-1', scan_id: 's-1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (scan_id) DO UPDATE'),
        [
          's-1',
          '# report',
          JSON.stringify({
            total: 3,
            by_severity: { high: 1 },
            by_class: { xss: 1 },
          }),
          null,
        ],
      );
    });

    it('persists pdf_url when provided', async () => {
      mockQuery.mockResolvedValue([{ id: 'r-1' }]);
      await repo.upsert({
        scan_id: 's-1',
        markdown: 'body',
        summary: { total: 0, by_severity: {}, by_class: {} },
        pdf_url: 's3://bucket/report.pdf',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['s3://bucket/report.pdf']),
      );
    });
  });

  describe('findByScanId', () => {
    it('returns a report when present', async () => {
      mockQuery.mockResolvedValue([{ id: 'r-1', scan_id: 's-1' }]);
      const result = await repo.findByScanId('s-1');
      expect(result).toEqual({ id: 'r-1', scan_id: 's-1' });
    });

    it('returns null when absent', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await repo.findByScanId('s-missing');
      expect(result).toBeNull();
    });
  });
});
