import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
}));

import { query } from '../../database/connection';
import { ReconScanRepository } from '../../database/repositories/recon-scan-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('ReconScanRepository', () => {
  const repo = new ReconScanRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('create', () => {
    it('inserts a scan with pending status', async () => {
      mockQuery.mockResolvedValue([{ id: 'scan-1' }]);
      const result = await repo.create({
        workspace_id: 'ws-1',
        project_id: 'p-1',
        environment_id: 'e-1',
        target_url: 'https://example.com',
        created_by_user_id: 'u-1',
      });
      expect(result).toEqual({ id: 'scan-1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'pending'"),
        ['ws-1', 'p-1', 'e-1', 'https://example.com', 'u-1', null],
      );
    });

    it('passes config_yaml when provided', async () => {
      mockQuery.mockResolvedValue([{ id: 'scan-2' }]);
      await repo.create({
        workspace_id: 'ws-1',
        project_id: 'p-1',
        environment_id: 'e-1',
        target_url: 'https://a.test',
        created_by_user_id: 'u-1',
        config_yaml: 'key: value',
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['key: value']),
      );
    });
  });

  describe('findById', () => {
    it('filters by workspace (multi-tenancy)', async () => {
      mockQuery.mockResolvedValue([{ id: 'scan-1', workspace_id: 'ws-1' }]);
      const result = await repo.findById('scan-1', 'ws-1');
      expect(result).toEqual({ id: 'scan-1', workspace_id: 'ws-1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $2'),
        ['scan-1', 'ws-1'],
      );
    });

    it('returns null when not found (wrong workspace)', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await repo.findById('scan-1', 'ws-evil');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('scopes to workspace only', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.list({ workspace_id: 'ws-1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $1'),
        ['ws-1', 50, 0],
      );
    });

    it('applies project and status filters', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.list({
        workspace_id: 'ws-1',
        project_id: 'p-1',
        status: 'running',
        limit: 10,
        offset: 5,
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        ['ws-1', 'p-1', 'running', 10, 5],
      );
    });
  });

  describe('updateStatus', () => {
    it('sets started_at when transitioning to running', async () => {
      mockQuery.mockResolvedValue([{ id: 'scan-1', status: 'running' }]);
      await repo.updateStatus('scan-1', 'running');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('started_at = COALESCE'),
        ['scan-1', 'running'],
      );
    });

    it('sets completed_at on terminal status', async () => {
      mockQuery.mockResolvedValue([{ id: 'scan-1' }]);
      await repo.updateStatus('scan-1', 'completed');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('completed_at = now()'),
        ['scan-1', 'completed'],
      );
    });

    it('records error_message when provided', async () => {
      mockQuery.mockResolvedValue([{ id: 'scan-1' }]);
      await repo.updateStatus('scan-1', 'failed', { error_message: 'boom' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('error_message = $3'),
        ['scan-1', 'failed', 'boom'],
      );
    });

    it('returns null when row is missing', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await repo.updateStatus('nope', 'completed');
      expect(result).toBeNull();
    });
  });

  describe('touchHeartbeat', () => {
    it('updates last_heartbeat_at', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.touchHeartbeat('scan-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('last_heartbeat_at = now()'),
        ['scan-1'],
      );
    });
  });

  describe('requestCancel', () => {
    it('only cancels pending or running scans, scoped to workspace', async () => {
      mockQuery.mockResolvedValue([{ id: 'scan-1' }]);
      const result = await repo.requestCancel('scan-1', 'ws-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringMatching(/status IN \('pending','running'\)/),
        ['scan-1', 'ws-1'],
      );
      expect(result).toEqual({ id: 'scan-1' });
    });

    it('returns null when no row updated (wrong workspace or terminal scan)', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await repo.requestCancel('scan-1', 'ws-evil');
      expect(result).toBeNull();
    });
  });

  describe('addCostCredits', () => {
    it('increments total_cost_credits atomically', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.addCostCredits('scan-1', 42);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('total_cost_credits = total_cost_credits + $2'),
        ['scan-1', 42],
      );
    });
  });
});
