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

  async findCursorPaginated(options: {
    cursor?: string;
    limit?: number;
    actor_id?: string;
    action?: string;
    target_type?: string;
    target_id?: string;
    from?: string;
    to?: string;
  } = {}): Promise<{ entries: AuditLogEntity[]; nextCursor: string | null }> {
    const { limit = 50, actor_id, action, target_type, target_id, from, to } = options;
    const fetchLimit = Math.min(limit, 100);

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.cursor) {
      try {
        const decoded = Buffer.from(options.cursor, 'base64').toString('utf8');
        const [ts, id] = decoded.split('|');
        conditions.push(`(created_at, id) < ($${paramIndex}, $${paramIndex + 1})`);
        params.push(ts, id);
        paramIndex += 2;
      } catch {
        // invalid cursor — ignore
      }
    }

    if (actor_id) { conditions.push(`actor_id = $${paramIndex++}`); params.push(actor_id); }
    if (action) { conditions.push(`action = $${paramIndex++}`); params.push(action); }
    if (target_type) { conditions.push(`target_type = $${paramIndex++}`); params.push(target_type); }
    if (target_id) { conditions.push(`target_id = $${paramIndex++}`); params.push(target_id); }
    if (from) { conditions.push(`created_at >= $${paramIndex++}`); params.push(from); }
    if (to) { conditions.push(`created_at <= $${paramIndex++}`); params.push(to); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query<AuditLogEntity>(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC, id DESC LIMIT $${paramIndex}`,
      [...params, fetchLimit + 1]
    );

    const hasMore = rows.length > fetchLimit;
    const entries = hasMore ? rows.slice(0, fetchLimit) : rows;
    let nextCursor: string | null = null;
    if (hasMore && entries.length > 0) {
      const last = entries[entries.length - 1];
      const ts = last.created_at instanceof Date ? last.created_at.toISOString() : String(last.created_at);
      nextCursor = Buffer.from(`${ts}|${last.id}`).toString('base64');
    }

    return { entries, nextCursor };
  }
}
