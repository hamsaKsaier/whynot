import { query } from '../connection';

export interface QAMonitorEntity {
  id: string;
  workspace_id: string;
  name: string;
  target_url: string;
  cron_expression: string;
  quality_threshold: number;
  max_iterations: number;
  is_enabled: boolean;
  last_run_at: Date | null;
  next_run_at: Date | null;
  last_session_id: string | null;
  last_quality_score: number | null;
  last_status: 'pass' | 'fail' | 'running' | 'error' | null;
  consecutive_failures: number;
  notify_on_failure: boolean;
  notify_on_regression: boolean;
  login_credentials: any;
  document_context: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMonitorInput {
  workspace_id: string;
  name: string;
  target_url: string;
  cron_expression: string;
  quality_threshold?: number;
  max_iterations?: number;
  notify_on_failure?: boolean;
  notify_on_regression?: boolean;
  login_credentials?: any;
  document_context?: string;
}

export class QAMonitorRepository {
  async create(input: CreateMonitorInput): Promise<QAMonitorEntity> {
    const result = await query<QAMonitorEntity>(
      `INSERT INTO qa_monitors (
        workspace_id, name, target_url, cron_expression,
        quality_threshold, max_iterations,
        notify_on_failure, notify_on_regression,
        login_credentials, document_context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        input.workspace_id,
        input.name,
        input.target_url,
        input.cron_expression,
        input.quality_threshold ?? 80,
        input.max_iterations ?? 5,
        input.notify_on_failure ?? true,
        input.notify_on_regression ?? true,
        input.login_credentials ? JSON.stringify(input.login_credentials) : null,
        input.document_context || null,
      ]
    );
    return result[0];
  }

  async findById(id: string): Promise<QAMonitorEntity | null> {
    const result = await query<QAMonitorEntity>(
      'SELECT * FROM qa_monitors WHERE id = $1',
      [id]
    );
    return result[0] || null;
  }

  async findByWorkspace(workspaceId: string): Promise<QAMonitorEntity[]> {
    return query<QAMonitorEntity>(
      'SELECT * FROM qa_monitors WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId]
    );
  }

  async update(id: string, updates: Partial<QAMonitorEntity>): Promise<QAMonitorEntity | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      'name', 'target_url', 'cron_expression', 'quality_threshold',
      'max_iterations', 'is_enabled', 'last_run_at', 'next_run_at',
      'last_session_id', 'last_quality_score', 'last_status',
      'consecutive_failures', 'notify_on_failure', 'notify_on_regression',
      'login_credentials', 'document_context',
    ];

    for (const field of allowedFields) {
      if ((updates as any)[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex++}`);
        const val = (updates as any)[field];
        values.push(field === 'login_credentials' && val ? JSON.stringify(val) : val);
      }
    }

    if (setClauses.length === 0) return this.findById(id);

    setClauses.push('updated_at = NOW()');
    values.push(id);

    const result = await query<QAMonitorEntity>(
      `UPDATE qa_monitors SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM qa_monitors WHERE id = $1 RETURNING id',
      [id]
    );
    return result.length > 0;
  }

  /**
   * Find monitors that are due to run (next_run_at <= NOW and is_enabled)
   */
  async findDueMonitors(): Promise<QAMonitorEntity[]> {
    return query<QAMonitorEntity>(
      `SELECT * FROM qa_monitors
       WHERE is_enabled = true
       AND (next_run_at IS NULL OR next_run_at <= NOW())
       AND (last_status IS NULL OR last_status != 'running')
       ORDER BY next_run_at ASC NULLS FIRST
       LIMIT 10`,
      []
    );
  }

  /**
   * Get monitor history (recent sessions associated with this monitor)
   */
  async getHistory(monitorId: string, limit = 10): Promise<any[]> {
    return query(
      `SELECT s.id, s.target_url, s.status, s.quality_score,
              s.bugs_found, s.tests_generated, s.created_at, s.completed_at
       FROM qa_loop_sessions s
       JOIN qa_monitors m ON m.workspace_id = s.workspace_id AND m.target_url = s.target_url
       WHERE m.id = $1
       ORDER BY s.created_at DESC
       LIMIT $2`,
      [monitorId, limit]
    );
  }
}
