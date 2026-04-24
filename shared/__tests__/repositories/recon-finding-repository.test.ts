import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import {
  ReconFindingRepository,
} from '../../database/repositories/recon-finding-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('ReconFindingRepository', () => {
  const repo = new ReconFindingRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('insertWithDedup', () => {
    it('skips dedup lookup for non-confirmed findings', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 'f-1' }]);
      const result = await repo.insertWithDedup({
        scan_id: 's-1',
        vuln_class: 'xss',
        status: 'discarded_unprovable',
        description: 'maybe',
      });
      expect(result).toEqual({ id: 'f-1' });
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO recon_findings'),
        expect.any(Array),
      );
    });

    it('inserts a new row when no confirmed duplicate exists', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // SELECT existing -> none
        .mockResolvedValueOnce([{ id: 'f-new' }]); // INSERT
      const result = await repo.insertWithDedup({
        scan_id: 's-1',
        vuln_class: 'injection',
        status: 'confirmed',
        severity: 'high',
        normalized_endpoint: '/api/users/:id',
        normalized_param: 'id',
        description: 'SQLi in id param',
        proof_of_concept: { kind: 'http', request: 'GET /api/users/1' },
      });
      expect(result).toEqual({ id: 'f-new' });
      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[0]).toContain('INSERT INTO recon_findings');
      // proof_of_concept is JSON-serialized
      expect(insertCall[1]).toContainEqual(
        JSON.stringify({ kind: 'http', request: 'GET /api/users/1' }),
      );
    });

    it('keeps the higher-severity row when incoming severity wins', async () => {
      const existing = {
        id: 'f-exists',
        scan_id: 's-1',
        vuln_class: 'injection',
        status: 'confirmed',
        severity: 'medium',
        description: 'older',
        proof_of_concept: null,
        duplicates: [],
      };
      mockQuery
        .mockResolvedValueOnce([existing]) // SELECT existing
        .mockResolvedValueOnce([{ ...existing, severity: 'critical' }]); // UPDATE
      const result = await repo.insertWithDedup({
        scan_id: 's-1',
        vuln_class: 'injection',
        status: 'confirmed',
        severity: 'critical',
        description: 'sharper PoC',
      });
      expect(result.severity).toBe('critical');
      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE recon_findings');
      // duplicates includes the displaced row
      const duplicatesArg = updateCall[1][9];
      expect(duplicatesArg).toContain('"severity":"medium"');
    });

    it('appends to duplicates when current finding dominates', async () => {
      const existing = {
        id: 'f-exists',
        scan_id: 's-1',
        vuln_class: 'xss',
        status: 'confirmed',
        severity: 'high',
        description: 'existing',
        proof_of_concept: null,
        duplicates: [{ vuln_class: 'xss', severity: 'low' }],
      };
      mockQuery
        .mockResolvedValueOnce([existing])
        .mockResolvedValueOnce([existing]);
      await repo.insertWithDedup({
        scan_id: 's-1',
        vuln_class: 'xss',
        status: 'confirmed',
        severity: 'low',
        description: 'weaker dup',
      });
      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE recon_findings SET duplicates');
      const dupArg = JSON.parse(updateCall[1][1]);
      expect(dupArg).toHaveLength(2);
      expect(dupArg[1].description).toBe('weaker dup');
    });

    it('treats missing severity as rank 0 for tie-breaking', async () => {
      const existing = {
        id: 'f-exists',
        scan_id: 's-1',
        vuln_class: 'ssrf',
        status: 'confirmed',
        severity: null,
        description: 'old',
        proof_of_concept: null,
        duplicates: [],
      };
      mockQuery
        .mockResolvedValueOnce([existing])
        .mockResolvedValueOnce([existing]);
      await repo.insertWithDedup({
        scan_id: 's-1',
        vuln_class: 'ssrf',
        status: 'confirmed',
        severity: 'low',
        description: 'new',
      });
      // incoming (rank 1) > existing (rank 0) -> UPDATE full row
      const updateCall = mockQuery.mock.calls[1];
      expect(updateCall[0]).toContain('SET severity');
    });
  });

  describe('listByScan', () => {
    it('lists without filters', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.listByScan({ scan_id: 's-1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('scan_id = $1'),
        ['s-1'],
      );
    });

    it('applies status, class, and severity filters', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.listByScan({
        scan_id: 's-1',
        status: 'confirmed',
        vuln_class: 'xss',
        severity: 'high',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('severity ='),
        ['s-1', 'confirmed', 'xss', 'high'],
      );
    });
  });
});
