import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));

import { query, transaction } from '../../database/connection';
import { ExecutionRepository } from '../../database/repositories/execution-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockTransaction = transaction as ReturnType<typeof vi.fn>;

describe('ExecutionRepository', () => {
  const repo = new ExecutionRepository();

  beforeEach(() => {
    mockQuery.mockReset();
    mockTransaction.mockReset();
  });

  describe('create', () => {
    it('inserts execution and step results via transaction', async () => {
      const execEntity = { id: 'e1', status: 'completed' };
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn()
            .mockResolvedValueOnce({ rows: [execEntity] })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return cb(mockClient);
      });
      const execution = {
        execution_id: 'e1',
        test_case_id: 'tc1',
        status: 'completed',
        started_at: '2025-01-01T00:00:00Z',
        completed_at: '2025-01-01T01:00:00Z',
        total_duration_ms: 3600000,
        steps: [
          { step_id: 's1', success: true, execution_time_ms: 100 },
        ],
      } as any;
      const result = await repo.create(execution);
      expect(result).toEqual(execEntity);
    });

    it('handles Date objects for started_at', async () => {
      const execEntity = { id: 'e1' };
      mockTransaction.mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({ rows: [execEntity] }),
        };
        return cb(mockClient);
      });
      const execution = {
        execution_id: 'e1',
        test_case_id: 'tc1',
        status: 'running',
        started_at: new Date(),
        steps: [],
      } as any;
      const result = await repo.create(execution);
      expect(result).toEqual(execEntity);
    });
  });

  describe('findById', () => {
    it('returns execution when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'e1' }]);
      expect(await repo.findById('e1')).toEqual({ id: 'e1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findById('missing')).toBeNull();
    });

    it('scopes to workspace when provided', async () => {
      mockQuery.mockResolvedValue([{ id: 'e1' }]);
      await repo.findById('e1', 'ws1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id = $2'),
        ['e1', 'ws1'],
      );
    });
  });

  describe('findStepResults', () => {
    it('returns step results for execution', async () => {
      mockQuery.mockResolvedValue([{ id: 'sr1' }]);
      const result = await repo.findStepResults('e1');
      expect(result).toEqual([{ id: 'sr1' }]);
    });
  });

  describe('findByTestCaseId', () => {
    it('returns executions for test case', async () => {
      mockQuery.mockResolvedValue([{ id: 'e1' }]);
      const result = await repo.findByTestCaseId('tc1');
      expect(result).toEqual([{ id: 'e1' }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('test_case_id = $1'),
        ['tc1', 50],
      );
    });

    it('uses custom limit', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.findByTestCaseId('tc1', 10);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['tc1', 10],
      );
    });
  });

  describe('count', () => {
    it('returns total count without filters', async () => {
      mockQuery.mockResolvedValue([{ count: '100' }]);
      expect(await repo.count()).toBe(100);
    });

    it('applies workspace filter', async () => {
      mockQuery.mockResolvedValue([{ count: '5' }]);
      await repo.count({ workspaceId: 'ws1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('workspace_id'),
        expect.arrayContaining(['ws1']),
      );
    });

    it('applies status filter', async () => {
      mockQuery.mockResolvedValue([{ count: '3' }]);
      await repo.count({ status: 'failed' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining(['failed']),
      );
    });

    it('applies search filter with JOIN', async () => {
      mockQuery.mockResolvedValue([{ count: '1' }]);
      await repo.count({ search: 'test' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN test_cases'),
        expect.arrayContaining(['%test%']),
      );
    });
  });

  describe('list', () => {
    it('returns executions with default pagination', async () => {
      mockQuery.mockResolvedValue([{ id: 'e1' }]);
      const result = await repo.list();
      expect(result).toEqual([{ id: 'e1' }]);
    });

    it('applies all filters', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.list(0, 10, { workspaceId: 'ws1', status: 'completed', search: 'test' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN test_cases'),
        expect.arrayContaining(['ws1', 'completed', '%test%']),
      );
    });
  });

  describe('findByIdWithSteps', () => {
    it('returns execution with steps', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'e1' }])
        .mockResolvedValueOnce([{ id: 'sr1' }]);
      const result = await repo.findByIdWithSteps('e1');
      expect(result).toEqual({
        execution: { id: 'e1' },
        steps: [{ id: 'sr1' }],
      });
    });

    it('returns null when execution not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.findByIdWithSteps('missing')).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('updates status and returns execution', async () => {
      mockQuery.mockResolvedValue([{ id: 'e1', status: 'failed' }]);
      const result = await repo.updateStatus('e1', 'failed');
      expect(result).toEqual({ id: 'e1', status: 'failed' });
    });

    it('includes completedAt and error when provided', async () => {
      const completedAt = new Date();
      mockQuery.mockResolvedValue([{ id: 'e1' }]);
      await repo.updateStatus('e1', 'completed', completedAt, 'some error');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('completed_at'),
        expect.arrayContaining(['completed', completedAt, 'some error', 'e1']),
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.updateStatus('missing', 'failed')).toBeNull();
    });
  });
});
