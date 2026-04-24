import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { ReconScanPhaseRepository } from '../../database/repositories/recon-scan-phase-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('ReconScanPhaseRepository', () => {
  const repo = new ReconScanPhaseRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('checkpoint', () => {
    it('marks isRunning=true when phase transitions to running', async () => {
      mockQuery.mockResolvedValue([{ id: 'p-1' }]);
      await repo.checkpoint({
        scan_id: 's-1',
        phase: 'discovery',
        status: 'running',
      });
      const call = mockQuery.mock.calls[0];
      expect(call[1]).toEqual(['s-1', 'discovery', 'running', true, false, null, null]);
    });

    it('marks isTerminal=true for completed', async () => {
      mockQuery.mockResolvedValue([{ id: 'p-1' }]);
      await repo.checkpoint({
        scan_id: 's-1',
        phase: 'reporting',
        status: 'completed',
        output_artifact_id: 'a-1',
      });
      const call = mockQuery.mock.calls[0];
      expect(call[1]).toEqual(['s-1', 'reporting', 'completed', false, true, 'a-1', null]);
    });

    it('marks isTerminal=true for failed/skipped/cancelled', async () => {
      mockQuery.mockResolvedValue([{ id: 'p-1' }]);
      for (const status of ['failed', 'skipped', 'cancelled'] as const) {
        mockQuery.mockClear();
        await repo.checkpoint({
          scan_id: 's-1',
          phase: 'discovery',
          status,
          error_message: status === 'failed' ? 'boom' : null,
        });
        const call = mockQuery.mock.calls[0];
        expect(call[1][3]).toBe(false); // isRunning
        expect(call[1][4]).toBe(true); // isTerminal
      }
    });

    it('uses ON CONFLICT to upsert by (scan_id, phase)', async () => {
      mockQuery.mockResolvedValue([{ id: 'p-1' }]);
      await repo.checkpoint({
        scan_id: 's-1',
        phase: 'fingerprinting',
        status: 'pending',
      });
      expect(mockQuery.mock.calls[0][0]).toContain('ON CONFLICT (scan_id, phase)');
    });
  });

  describe('listByScan', () => {
    it('orders phases in pipeline order', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.listByScan('s-1');
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain("WHEN 'fingerprinting' THEN 1");
      expect(sql).toContain("WHEN 'reporting' THEN 5");
    });
  });
});
