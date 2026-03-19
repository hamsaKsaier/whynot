import { query } from '../connection';

export interface AuditLogEntity {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface CreateAuditLogInput {
  actor_id?: string;
  actor_email?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export class AuditRepository {
  async log(input: CreateAuditLogInput): Promise<void> {
    await query(
      `INSERT INTO audit_log (actor_id, actor_email, action, target_type, target_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.actor_id || null,
        input.actor_email || null,
        input.action,
        input.target_type || null,
        input.target_id || null,
        JSON.stringify(input.details || {}),
        input.ip_address || null,
        input.user_agent || null,
      ]
    );
  }

  async findAll(options: {
    offset?: number;
    limit?: number;
    actor_id?: string;
    action?: string;
    target_type?: string;
    target_id?: string;
  } = {}): Promise<{ entries: AuditLogEntity[]; total: number }> {
    const { offset = 0, limit = 50, actor_id, action, target_type, target_id } = options;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (actor_id) { conditions.push(`actor_id = $${paramIndex++}`); params.push(actor_id); }
    if (action) { conditions.push(`action = $${paramIndex++}`); params.push(action); }
    if (target_type) { conditions.push(`target_type = $${paramIndex++}`); params.push(target_type); }
    if (target_id) { conditions.push(`target_id = $${paramIndex++}`); params.push(target_id); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRows = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_log ${where}`,
      params
    );
    const total = parseInt(countRows[0].count, 10);

    const entries = await query<AuditLogEntity>(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return { entries, total };
  }
}
