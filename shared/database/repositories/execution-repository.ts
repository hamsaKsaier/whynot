import { query, transaction } from '../connection';
import { ExecutionResult, StepResult } from '../../types';
import { PoolClient } from 'pg';

export interface ExecutionEntity {
  id: string;
  test_case_id: string;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  total_duration_ms: number | null;
  error: string | null;
  screenshots: string[] | null;
  created_at: Date;
}

export interface StepResultEntity {
  id: string;
  execution_id: string;
  step_id: string;
  success: boolean;
  execution_time_ms: number;
  error: string | null;
  screenshot_path: string | null;
  element_found: boolean | null;
  selector_used: any | null; // JSONB
  created_at: Date;
}

export class ExecutionRepository {
  /**
   * Create a new execution
   */
  async create(execution: ExecutionResult): Promise<ExecutionEntity> {
    return await transaction(async (client) => {
      // Convert started_at from ISO string to Date if needed
      let startedAt: Date;
      if (typeof execution.started_at === 'string') {
        startedAt = new Date(execution.started_at);
      } else {
        // Assume it's already a Date or use current time as fallback
        startedAt = execution.started_at ? (execution.started_at as any as Date) : new Date();
      }

      // Convert completed_at from ISO string to Date if needed
      let completedAt: Date | null = null;
      if (execution.completed_at) {
        if (typeof execution.completed_at === 'string') {
          completedAt = new Date(execution.completed_at);
        } else {
          completedAt = execution.completed_at as any as Date;
        }
      }

      // Insert execution
      const execResult = await client.query<ExecutionEntity>(
        `INSERT INTO executions (id, test_case_id, status, started_at, completed_at, total_duration_ms, error, screenshots)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          execution.execution_id,
          execution.test_case_id,
          execution.status,
          startedAt,
          completedAt,
          execution.total_duration_ms,
          execution.error || null,
          execution.screenshots || []
        ]
      );

      // Insert step results
      if (execution.steps && execution.steps.length > 0) {
        for (const step of execution.steps) {
          await client.query(
            `INSERT INTO step_results (execution_id, step_id, success, execution_time_ms, error, screenshot_path, element_found, selector_used)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              execution.execution_id,
              step.step_id,
              step.success,
              step.execution_time_ms,
              step.error || null,
              step.screenshot_path || null,
              step.element_found ?? null,
              step.selector_used ? JSON.stringify(step.selector_used) : null
            ]
          );
        }
      }

      return execResult.rows[0];
    });
  }

  /**
   * Find execution by ID
   */
  async findById(id: string): Promise<ExecutionEntity | null> {
    const result = await query<ExecutionEntity>(
      'SELECT * FROM executions WHERE id = $1',
      [id]
    );

    return result[0] || null;
  }

  /**
   * Find step results for an execution
   */
  async findStepResults(executionId: string): Promise<StepResultEntity[]> {
    return await query<StepResultEntity>(
      'SELECT * FROM step_results WHERE execution_id = $1 ORDER BY created_at ASC',
      [executionId]
    );
  }

  /**
   * Find executions by test case ID
   */
  async findByTestCaseId(testCaseId: string, limit: number = 50): Promise<ExecutionEntity[]> {
    return await query<ExecutionEntity>(
      'SELECT * FROM executions WHERE test_case_id = $1 ORDER BY started_at DESC LIMIT $2',
      [testCaseId, limit]
    );
  }

  /**
   * List all executions with pagination
   */
  async list(offset: number = 0, limit: number = 50): Promise<ExecutionEntity[]> {
    return await query<ExecutionEntity>(
      'SELECT * FROM executions ORDER BY started_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
  }

  /**
   * Get execution with step results
   */
  async findByIdWithSteps(id: string): Promise<{
    execution: ExecutionEntity;
    steps: StepResultEntity[];
  } | null> {
    const execution = await this.findById(id);
    if (!execution) {
      return null;
    }

    const steps = await this.findStepResults(id);
    return { execution, steps };
  }

  /**
   * Update execution status
   */
  async updateStatus(
    id: string,
    status: string,
    completedAt?: Date,
    error?: string
  ): Promise<ExecutionEntity | null> {
    const updates: string[] = [`status = $1`];
    const values: any[] = [status];
    let paramIndex = 2;

    if (completedAt) {
      updates.push(`completed_at = $${paramIndex++}`);
      values.push(completedAt);
    }
    if (error !== undefined) {
      updates.push(`error = $${paramIndex++}`);
      values.push(error);
    }

    values.push(id);
    const result = await query<ExecutionEntity>(
      `UPDATE executions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result[0] || null;
  }
}

