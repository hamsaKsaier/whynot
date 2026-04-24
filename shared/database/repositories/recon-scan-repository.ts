import { query } from '../connection';

export type ReconScanStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'stuck';

export interface ReconScanEntity {
  id: string;
  workspace_id: string;
  project_id: string;
  environment_id: string;
  target_url: string;
  status: ReconScanStatus;
  created_by_user_id: string;
  started_at: Date | null;
  completed_at: Date | null;
  cancel_requested_at: Date | null;
  last_heartbeat_at: Date | null;
  config_yaml: string | null;
  error_message: string | null;
  total_cost_credits: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateReconScanInput {
  workspace_id: string;
  project_id: string;
  environment_id: string;
  target_url: string;
  created_by_user_id: string;
  config_yaml?: string;
}

export interface ListReconScansOptions {
  workspace_id: string;
  project_id?: string;
  status?: ReconScanStatus;
  offset?: number;
  limit?: number;
}

export class ReconScanRepository {
  async create(input: CreateReconScanInput): Promise<ReconScanEntity> {
    const rows = await query<ReconScanEntity>(
      `INSERT INTO recon_scans
        (workspace_id, project_id, environment_id, target_url, status,
         created_by_user_id, config_yaml)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6)
       RETURNING *`,
      [
        input.workspace_id,
        input.project_id,
        input.environment_id,
        input.target_url,
        input.created_by_user_id,
        input.config_yaml ?? null,
      ],
    );
    return rows[0];
  }

  async findById(id: string, workspaceId: string): Promise<ReconScanEntity | null> {
    const rows = await query<ReconScanEntity>(
      `SELECT * FROM recon_scans WHERE id = $1 AND workspace_id = $2`,
      [id, workspaceId],
    );
    return rows[0] ?? null;
  }

  async list(options: ListReconScansOptions): Promise<ReconScanEntity[]> {
    const { workspace_id, project_id, status, offset = 0, limit = 50 } = options;
    const conditions: string[] = ['workspace_id = $1'];
    const params: unknown[] = [workspace_id];
    let idx = 2;
    if (project_id) {
      conditions.push(`project_id = $${idx++}`);
      params.push(project_id);
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }
    params.push(limit, offset);
    return query<ReconScanEntity>(
      `SELECT * FROM recon_scans WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );
  }

  async updateStatus(
    id: string,
    status: ReconScanStatus,
    extras: { error_message?: string | null } = {},
  ): Promise<ReconScanEntity | null> {
    const setClauses: string[] = ['status = $2'];
    const params: unknown[] = [id, status];
    let idx = 3;

    if (status === 'running') {
      setClauses.push(`started_at = COALESCE(started_at, now())`);
    }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      setClauses.push(`completed_at = now()`);
    }
    if (extras.error_message !== undefined) {
      setClauses.push(`error_message = $${idx++}`);
      params.push(extras.error_message);
    }

    const rows = await query<ReconScanEntity>(
      `UPDATE recon_scans SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    );
    return rows[0] ?? null;
  }

  async touchHeartbeat(id: string): Promise<void> {
    await query(
      `UPDATE recon_scans SET last_heartbeat_at = now() WHERE id = $1`,
      [id],
    );
  }

  async requestCancel(id: string, workspaceId: string): Promise<ReconScanEntity | null> {
    const rows = await query<ReconScanEntity>(
      `UPDATE recon_scans
         SET cancel_requested_at = now()
       WHERE id = $1 AND workspace_id = $2
         AND status IN ('pending','running')
       RETURNING *`,
      [id, workspaceId],
    );
    return rows[0] ?? null;
  }

  async addCostCredits(id: string, credits: number): Promise<void> {
    await query(
      `UPDATE recon_scans SET total_cost_credits = total_cost_credits + $2 WHERE id = $1`,
      [id, credits],
    );
  }

  async countCreatedSince(workspaceId: string, since: Date): Promise<number> {
    const rows = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM recon_scans
       WHERE workspace_id = $1 AND created_at >= $2`,
      [workspaceId, since.toISOString()],
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }
}
