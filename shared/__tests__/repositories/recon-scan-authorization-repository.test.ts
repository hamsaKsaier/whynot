import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import {
  ReconScanAuthorizationRepository,
} from '../../database/repositories/recon-scan-authorization-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('ReconScanAuthorizationRepository', () => {
  const repo = new ReconScanAuthorizationRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  const validInput = {
    scan_id: 's-1',
    acknowledged_by_user_id: 'u-1',
    acknowledged_at: new Date('2026-04-21T00:00:00Z'),
    justification: 'Authorized pentest against staging for release 4.2 prep',
    caller_ip: '10.0.0.5',
    user_agent: 'Mozilla/5.0',
  };

  describe('insert', () => {
    it('inserts a new authorization record', async () => {
      mockQuery.mockResolvedValue([{ id: 'auth-1', scan_id: 's-1' }]);
      const result = await repo.insert(validInput);
      expect(result).toEqual({ id: 'auth-1', scan_id: 's-1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO recon_scan_authorizations'),
        [
          's-1',
          'u-1',
          validInput.acknowledged_at,
          validInput.justification,
          '10.0.0.5',
          'Mozilla/5.0',
        ],
      );
    });

    it('rejects justification shorter than 20 chars', async () => {
      await expect(
        repo.insert({ ...validInput, justification: 'too short' }),
      ).rejects.toThrow(/20 and 1000/);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('rejects justification longer than 1000 chars', async () => {
      await expect(
        repo.insert({ ...validInput, justification: 'x'.repeat(1001) }),
      ).rejects.toThrow(/20 and 1000/);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('casts caller_ip as INET', async () => {
      mockQuery.mockResolvedValue([{ id: 'auth-1' }]);
      await repo.insert(validInput);
      expect(mockQuery.mock.calls[0][0]).toContain('$5::inet');
    });
  });

  describe('findByScanId', () => {
    it('returns the authorization row for a scan', async () => {
      mockQuery.mockResolvedValue([{ id: 'auth-1', scan_id: 's-1' }]);
      const result = await repo.findByScanId('s-1');
      expect(result).toEqual({ id: 'auth-1', scan_id: 's-1' });
    });

    it('returns null when no row exists', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await repo.findByScanId('s-missing');
      expect(result).toBeNull();
    });
  });

  describe('immutability', () => {
    it('does not expose any update or delete method', () => {
      const instance = repo as unknown as Record<string, unknown>;
      expect(typeof instance.update).toBe('undefined');
      expect(typeof instance.delete).toBe('undefined');
      expect(typeof instance.remove).toBe('undefined');
    });
  });
});
