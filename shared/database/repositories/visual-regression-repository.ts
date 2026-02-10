import { query, transaction } from '../connection';
import { VisualBaseline, VisualComparison, AIVisualDiffAnalysis } from '../../types';
import { PoolClient } from 'pg';

export interface VisualBaselineEntity {
  id: string;
  test_case_id: string;
  step_id: string;
  screenshot_path: string;
  screenshot_hash: string;
  baseline_version: number;
  execution_id: string | null;
  is_locked: boolean;
  created_at: Date;
  created_by: string;
}

export interface VisualComparisonEntity {
  id: string;
  execution_id: string;
  step_id: string;
  baseline_id: string | null;
  current_screenshot_path: string;
  diff_image_path: string | null;
  pixel_diff_score: number;
  ai_diff_analysis: AIVisualDiffAnalysis | null;
  is_regression: boolean;
  regression_severity: 'low' | 'medium' | 'high' | 'critical' | null;
  ignored: boolean;
  created_at: Date;
}

export class VisualRegressionRepository {
  // ============ Visual Baselines ============

  /**
   * Get the latest baseline for a test case and step
   */
  async getLatestBaseline(
    testCaseId: string,
    stepId: string
  ): Promise<VisualBaselineEntity | null> {
    const result = await query<VisualBaselineEntity>(
      `SELECT * FROM visual_baselines
       WHERE test_case_id = $1 AND step_id = $2
       ORDER BY baseline_version DESC
       LIMIT 1`,
      [testCaseId, stepId]
    );
    
    return result[0] || null;
  }

  /**
   * Get all baselines for a test case and step (version history)
   */
  async getBaselineHistory(
    testCaseId: string,
    stepId: string
  ): Promise<VisualBaselineEntity[]> {
    return await query<VisualBaselineEntity>(
      `SELECT * FROM visual_baselines
       WHERE test_case_id = $1 AND step_id = $2
       ORDER BY baseline_version DESC`,
      [testCaseId, stepId]
    );
  }

  /**
   * Get all baselines for a test case
   */
  async getBaselinesByTestCase(testCaseId: string): Promise<VisualBaselineEntity[]> {
    return await query<VisualBaselineEntity>(
      `SELECT * FROM visual_baselines
       WHERE test_case_id = $1
       ORDER BY step_id, baseline_version DESC`,
      [testCaseId]
    );
  }

  /**
   * Create a new baseline
   */
  async createBaseline(baseline: Partial<VisualBaseline>): Promise<VisualBaselineEntity> {
    // Get next version number
    const existingBaselines = await this.getBaselineHistory(
      baseline.test_case_id!,
      baseline.step_id!
    );
    const nextVersion = existingBaselines.length > 0 
      ? existingBaselines[0].baseline_version + 1 
      : 1;

    const result = await query<VisualBaselineEntity>(
      `INSERT INTO visual_baselines (
        test_case_id, step_id, screenshot_path, screenshot_hash,
        baseline_version, execution_id, is_locked, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        baseline.test_case_id!,
        baseline.step_id!,
        baseline.screenshot_path!,
        baseline.screenshot_hash!,
        nextVersion,
        baseline.execution_id || null,
        baseline.is_locked ?? false,
        baseline.created_by || 'system'
      ]
    );
    
    return result[0];
  }

  /**
   * Update baseline (only if not locked)
   */
  async updateBaseline(
    baselineId: string,
    updates: Partial<Pick<VisualBaseline, 'screenshot_path' | 'screenshot_hash' | 'execution_id'>>
  ): Promise<VisualBaselineEntity | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.screenshot_path !== undefined) {
      updatesList.push(`screenshot_path = $${paramIndex++}`);
      values.push(updates.screenshot_path);
    }
    if (updates.screenshot_hash !== undefined) {
      updatesList.push(`screenshot_hash = $${paramIndex++}`);
      values.push(updates.screenshot_hash);
    }
    if (updates.execution_id !== undefined) {
      updatesList.push(`execution_id = $${paramIndex++}`);
      values.push(updates.execution_id || null);
    }

    if (updatesList.length === 0) {
      return this.getBaselineById(baselineId);
    }

    values.push(baselineId);
    const result = await query<VisualBaselineEntity>(
      `UPDATE visual_baselines 
       SET ${updatesList.join(', ')}
       WHERE id = $${paramIndex} AND is_locked = false
       RETURNING *`,
      values
    );

    return result[0] || null;
  }

  /**
   * Get baseline by ID
   */
  async getBaselineById(baselineId: string): Promise<VisualBaselineEntity | null> {
    const result = await query<VisualBaselineEntity>(
      'SELECT * FROM visual_baselines WHERE id = $1',
      [baselineId]
    );
    
    return result[0] || null;
  }

  /**
   * Lock or unlock a baseline
   */
  async setBaselineLock(baselineId: string, isLocked: boolean): Promise<boolean> {
    const result = await query(
      'UPDATE visual_baselines SET is_locked = $1 WHERE id = $2 RETURNING id',
      [isLocked, baselineId]
    );
    
    return result.length > 0;
  }

  /**
   * Delete baseline (only if not locked)
   */
  async deleteBaseline(baselineId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM visual_baselines WHERE id = $1 AND is_locked = false RETURNING id',
      [baselineId]
    );
    
    return result.length > 0;
  }

  // ============ Visual Comparisons ============

  /**
   * Create a visual comparison record
   */
  async createComparison(comparison: Partial<VisualComparison>): Promise<VisualComparisonEntity> {
    const result = await query<VisualComparisonEntity>(
      `INSERT INTO visual_comparisons (
        execution_id, step_id, baseline_id, current_screenshot_path,
        diff_image_path, pixel_diff_score, ai_diff_analysis,
        is_regression, regression_severity, ignored
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        comparison.execution_id!,
        comparison.step_id!,
        comparison.baseline_id || null,
        comparison.current_screenshot_path!,
        comparison.diff_image_path || null,
        comparison.pixel_diff_score!,
        comparison.ai_diff_analysis ? JSON.stringify(comparison.ai_diff_analysis) : null,
        comparison.is_regression ?? false,
        comparison.regression_severity || null,
        comparison.ignored ?? false
      ]
    );
    
    return result[0];
  }

  /**
   * Get comparisons for an execution
   */
  async getComparisonsByExecution(executionId: string): Promise<VisualComparisonEntity[]> {
    return await query<VisualComparisonEntity>(
      `SELECT * FROM visual_comparisons
       WHERE execution_id = $1
       ORDER BY created_at ASC`,
      [executionId]
    );
  }

  /**
   * Get comparisons by baseline
   */
  async getComparisonsByBaseline(baselineId: string): Promise<VisualComparisonEntity[]> {
    return await query<VisualComparisonEntity>(
      `SELECT * FROM visual_comparisons
       WHERE baseline_id = $1
       ORDER BY created_at DESC`,
      [baselineId]
    );
  }

  /**
   * Get all visual regressions (paginated)
   */
  async getRegressions(
    options: {
      ignored?: boolean;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<VisualComparisonEntity[]> {
    const conditions: string[] = ['is_regression = true'];
    const values: any[] = [];
    let paramIndex = 1;

    if (options.ignored !== undefined) {
      conditions.push(`ignored = $${paramIndex++}`);
      values.push(options.ignored);
    }

    if (options.severity) {
      conditions.push(`regression_severity = $${paramIndex++}`);
      values.push(options.severity);
    }

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    values.push(limit, offset);

    return await query<VisualComparisonEntity>(
      `SELECT * FROM visual_comparisons
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );
  }

  /**
   * Get comparison by ID
   */
  async getComparisonById(comparisonId: string): Promise<VisualComparisonEntity | null> {
    const result = await query<VisualComparisonEntity>(
      'SELECT * FROM visual_comparisons WHERE id = $1',
      [comparisonId]
    );
    
    return result[0] || null;
  }

  /**
   * Update comparison (e.g., mark as ignored)
   */
  async updateComparison(
    comparisonId: string,
    updates: Partial<Pick<VisualComparison, 'ignored' | 'regression_severity'>>
  ): Promise<VisualComparisonEntity | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.ignored !== undefined) {
      updatesList.push(`ignored = $${paramIndex++}`);
      values.push(updates.ignored);
    }
    if (updates.regression_severity !== undefined) {
      updatesList.push(`regression_severity = $${paramIndex++}`);
      values.push(updates.regression_severity || null);
    }

    if (updatesList.length === 0) {
      return this.getComparisonById(comparisonId);
    }

    values.push(comparisonId);
    const result = await query<VisualComparisonEntity>(
      `UPDATE visual_comparisons 
       SET ${updatesList.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result[0] || null;
  }

  /**
   * Promote execution screenshots as baselines (bulk operation)
   */
  async promoteExecutionAsBaseline(
    testCaseId: string,
    executionId: string,
    stepScreenshots: Array<{ stepId: string; screenshotPath: string; screenshotHash: string }>
  ): Promise<VisualBaselineEntity[]> {
    const createdBaselines: VisualBaselineEntity[] = [];

    for (const { stepId, screenshotPath, screenshotHash } of stepScreenshots) {
      try {
        // Check if baseline exists and is not locked
        const existingBaseline = await this.getLatestBaseline(testCaseId, stepId);
        
        if (existingBaseline && existingBaseline.is_locked) {
          // Skip if locked
          continue;
        }

        // Create new baseline version
        const baseline = await this.createBaseline({
          test_case_id: testCaseId,
          step_id: stepId,
          screenshot_path: screenshotPath,
          screenshot_hash: screenshotHash,
          execution_id: executionId,
          is_locked: false,
          created_by: 'system'
        });

        createdBaselines.push(baseline);
      } catch (error: any) {
        // Log error but continue with other steps
        console.error(`Failed to create baseline for step ${stepId}:`, error.message);
      }
    }

    return createdBaselines;
  }
}
