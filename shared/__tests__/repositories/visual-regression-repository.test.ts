import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../database/connection', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));

import { query } from '../../database/connection';
import { VisualRegressionRepository } from '../../database/repositories/visual-regression-repository';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('VisualRegressionRepository', () => {
  const repo = new VisualRegressionRepository();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  // ============ Visual Baselines ============

  describe('getLatestBaseline', () => {
    it('returns latest baseline when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'vb1', baseline_version: 3 }]);
      const result = await repo.getLatestBaseline('tc1', 's1');
      expect(result).toEqual({ id: 'vb1', baseline_version: 3 });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.getLatestBaseline('tc1', 's1')).toBeNull();
    });
  });

  describe('getBaselineHistory', () => {
    it('returns all baselines for step', async () => {
      mockQuery.mockResolvedValue([{ id: 'vb2' }, { id: 'vb1' }]);
      const result = await repo.getBaselineHistory('tc1', 's1');
      expect(result).toHaveLength(2);
    });
  });

  describe('getBaselinesByTestCase', () => {
    it('returns all baselines for test case', async () => {
      mockQuery.mockResolvedValue([{ id: 'vb1' }]);
      const result = await repo.getBaselinesByTestCase('tc1');
      expect(result).toEqual([{ id: 'vb1' }]);
    });
  });

  describe('createBaseline', () => {
    it('creates baseline with next version', async () => {
      // First call: getBaselineHistory returns empty (no existing baselines)
      mockQuery
        .mockResolvedValueOnce([]) // getBaselineHistory
        .mockResolvedValueOnce([{ id: 'vb1', baseline_version: 1 }]); // INSERT
      const result = await repo.createBaseline({
        test_case_id: 'tc1',
        step_id: 's1',
        screenshot_path: '/path/img.png',
        screenshot_hash: 'hash123',
      } as any);
      expect(result).toEqual({ id: 'vb1', baseline_version: 1 });
    });

    it('increments version when baselines exist', async () => {
      mockQuery
        .mockResolvedValueOnce([{ baseline_version: 2 }]) // getBaselineHistory
        .mockResolvedValueOnce([{ id: 'vb2', baseline_version: 3 }]); // INSERT
      const result = await repo.createBaseline({
        test_case_id: 'tc1',
        step_id: 's1',
        screenshot_path: '/path/img.png',
        screenshot_hash: 'newhash',
      } as any);
      expect(result).toEqual({ id: 'vb2', baseline_version: 3 });
      // Verify that version 3 is passed
      const insertParams = mockQuery.mock.calls[1][1];
      expect(insertParams[4]).toBe(3); // nextVersion
    });
  });

  describe('updateBaseline', () => {
    it('updates non-locked baseline', async () => {
      mockQuery.mockResolvedValue([{ id: 'vb1' }]);
      const result = await repo.updateBaseline('vb1', {
        screenshot_path: '/new/path.png',
      });
      expect(result).toEqual({ id: 'vb1' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_locked = false'),
        ['/new/path.png', 'vb1'],
      );
    });

    it('falls back to getBaselineById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'vb1' }]);
      await repo.updateBaseline('vb1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['vb1'],
      );
    });

    it('returns null when not found or locked', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.updateBaseline('vb1', { screenshot_path: 'x' })).toBeNull();
    });
  });

  describe('getBaselineById', () => {
    it('returns baseline when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'vb1' }]);
      expect(await repo.getBaselineById('vb1')).toEqual({ id: 'vb1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.getBaselineById('missing')).toBeNull();
    });
  });

  describe('setBaselineLock', () => {
    it('returns true when lock toggled', async () => {
      mockQuery.mockResolvedValue([{ id: 'vb1' }]);
      expect(await repo.setBaselineLock('vb1', true)).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_locked = $1'),
        [true, 'vb1'],
      );
    });

    it('returns false when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.setBaselineLock('missing', true)).toBe(false);
    });
  });

  describe('deleteBaseline', () => {
    it('returns true when deleted', async () => {
      mockQuery.mockResolvedValue([{ id: 'vb1' }]);
      expect(await repo.deleteBaseline('vb1')).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_locked = false'),
        ['vb1'],
      );
    });

    it('returns false when not found or locked', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.deleteBaseline('missing')).toBe(false);
    });
  });

  // ============ Visual Comparisons ============

  describe('createComparison', () => {
    it('creates comparison', async () => {
      const comp = { id: 'vc1' };
      mockQuery.mockResolvedValue([comp]);
      const result = await repo.createComparison({
        execution_id: 'e1',
        step_id: 's1',
        current_screenshot_path: '/path.png',
        pixel_diff_score: 0.05,
      } as any);
      expect(result).toEqual(comp);
    });

    it('serializes ai_diff_analysis as JSON', async () => {
      mockQuery.mockResolvedValue([{ id: 'vc1' }]);
      await repo.createComparison({
        execution_id: 'e1',
        step_id: 's1',
        current_screenshot_path: '/p.png',
        pixel_diff_score: 0.1,
        ai_diff_analysis: { summary: 'layout shift' },
      } as any);
      const params = mockQuery.mock.calls[0][1];
      expect(params[6]).toBe(JSON.stringify({ summary: 'layout shift' }));
    });
  });

  describe('getComparisonsByExecution', () => {
    it('returns comparisons for execution', async () => {
      mockQuery.mockResolvedValue([{ id: 'vc1' }]);
      const result = await repo.getComparisonsByExecution('e1');
      expect(result).toEqual([{ id: 'vc1' }]);
    });
  });

  describe('getComparisonsByBaseline', () => {
    it('returns comparisons for baseline', async () => {
      mockQuery.mockResolvedValue([{ id: 'vc1' }]);
      const result = await repo.getComparisonsByBaseline('vb1');
      expect(result).toEqual([{ id: 'vc1' }]);
    });
  });

  describe('getRegressions', () => {
    it('returns regressions with default options', async () => {
      mockQuery.mockResolvedValue([{ id: 'vc1', is_regression: true }]);
      const result = await repo.getRegressions();
      expect(result).toEqual([{ id: 'vc1', is_regression: true }]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_regression = true'),
        [50, 0],
      );
    });

    it('applies ignored filter', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.getRegressions({ ignored: false });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ignored = $'),
        expect.arrayContaining([false]),
      );
    });

    it('applies severity filter', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.getRegressions({ severity: 'critical' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('regression_severity = $'),
        expect.arrayContaining(['critical']),
      );
    });

    it('uses custom limit and offset', async () => {
      mockQuery.mockResolvedValue([]);
      await repo.getRegressions({ limit: 10, offset: 5 });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [10, 5],
      );
    });
  });

  describe('getComparisonById', () => {
    it('returns comparison when found', async () => {
      mockQuery.mockResolvedValue([{ id: 'vc1' }]);
      expect(await repo.getComparisonById('vc1')).toEqual({ id: 'vc1' });
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.getComparisonById('missing')).toBeNull();
    });
  });

  describe('updateComparison', () => {
    it('updates ignored status', async () => {
      mockQuery.mockResolvedValue([{ id: 'vc1', ignored: true }]);
      const result = await repo.updateComparison('vc1', { ignored: true });
      expect(result).toEqual({ id: 'vc1', ignored: true });
    });

    it('falls back to getComparisonById when no updates', async () => {
      mockQuery.mockResolvedValue([{ id: 'vc1' }]);
      await repo.updateComparison('vc1', {});
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['vc1'],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await repo.updateComparison('missing', { ignored: true })).toBeNull();
    });
  });

  describe('promoteExecutionAsBaseline', () => {
    it('creates baselines for each step', async () => {
      // For each step: getBaselineHistory then createBaseline (getBaselineHistory + INSERT)
      mockQuery
        // Step 1: getLatestBaseline -> null
        .mockResolvedValueOnce([])
        // Step 1: createBaseline -> getBaselineHistory
        .mockResolvedValueOnce([])
        // Step 1: createBaseline -> INSERT
        .mockResolvedValueOnce([{ id: 'vb1' }])
        // Step 2: getLatestBaseline -> null
        .mockResolvedValueOnce([])
        // Step 2: createBaseline -> getBaselineHistory
        .mockResolvedValueOnce([])
        // Step 2: createBaseline -> INSERT
        .mockResolvedValueOnce([{ id: 'vb2' }]);
      const result = await repo.promoteExecutionAsBaseline('tc1', 'e1', [
        { stepId: 's1', screenshotPath: '/p1.png', screenshotHash: 'h1' },
        { stepId: 's2', screenshotPath: '/p2.png', screenshotHash: 'h2' },
      ]);
      expect(result).toHaveLength(2);
    });

    it('skips locked baselines', async () => {
      // Step 1: getLatestBaseline -> locked
      mockQuery.mockResolvedValueOnce([{ is_locked: true }]);
      const result = await repo.promoteExecutionAsBaseline('tc1', 'e1', [
        { stepId: 's1', screenshotPath: '/p1.png', screenshotHash: 'h1' },
      ]);
      expect(result).toEqual([]);
    });

    it('continues on error for individual steps', async () => {
      // Step 1: getLatestBaseline -> null, then createBaseline errors
      mockQuery
        .mockResolvedValueOnce([]) // getLatestBaseline for s1
        .mockResolvedValueOnce([]) // getBaselineHistory for s1
        .mockRejectedValueOnce(new Error('DB error')) // INSERT fails for s1
        // Step 2: succeeds
        .mockResolvedValueOnce([]) // getLatestBaseline for s2
        .mockResolvedValueOnce([]) // getBaselineHistory for s2
        .mockResolvedValueOnce([{ id: 'vb2' }]); // INSERT for s2
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await repo.promoteExecutionAsBaseline('tc1', 'e1', [
        { stepId: 's1', screenshotPath: '/p1.png', screenshotHash: 'h1' },
        { stepId: 's2', screenshotPath: '/p2.png', screenshotHash: 'h2' },
      ]);
      expect(result).toHaveLength(1);
      consoleSpy.mockRestore();
    });
  });
});
