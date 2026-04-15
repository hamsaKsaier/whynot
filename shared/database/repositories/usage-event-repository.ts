import { query } from '../connection';

export interface UsageEventEntity {
  id: string;
  workspace_id: string;
  user_id: string | null;
  event_type: string;
  quantity: number;
  credits_consumed: bigint;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface CreateUsageEventInput {
  workspace_id: string;
  user_id?: string;
  event_type: string;
  quantity?: number;
  credits_consumed?: bigint;
  metadata?: Record<string, unknown>;
}

export interface AggregateByTypeRow {
  event_type: string;
  total_events: number;
  total_quantity: number;
  total_credits: bigint;
}

export interface AggregateByDayRow {
  day: string;
  total_events: number;
  total_quantity: number;
  total_credits: bigint;
}

export interface AggregateByDayAndTypeRow {
  day: string;
  event_type: string;
  total_events: number;
  total_quantity: number;
  total_credits: bigint;
}

export class UsageEventRepository {
  async insertBatch(events: CreateUsageEventInput[]): Promise<string[]> {
    if (events.length === 0) return [];

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const e of events) {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`,
      );
      values.push(
        e.workspace_id,
        e.user_id ?? null,
        e.event_type,
        e.quantity ?? 1,
        (e.credits_consumed ?? 0n).toString(),
        JSON.stringify(e.metadata ?? {}),
      );
      paramIndex += 6;
    }

    const rows = await query<{ id: string }>(
      `INSERT INTO usage_events (workspace_id, user_id, event_type, quantity, credits_consumed, metadata)
       VALUES ${placeholders.join(', ')}
       RETURNING id`,
      values,
    );

    return rows.map((r) => r.id);
  }

  async listByOrg(
    workspaceId: string,
    options: { cursor?: string; limit?: number; eventType?: string } = {},
  ): Promise<{ entries: UsageEventEntity[]; nextCursor: string | null }> {
    const fetchLimit = Math.min(options.limit ?? 50, 100);
    const conditions: string[] = ['workspace_id = $1'];
    const params: unknown[] = [workspaceId];
    let paramIndex = 2;

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

    if (options.eventType) {
      conditions.push(`event_type = $${paramIndex++}`);
      params.push(options.eventType);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    params.push(fetchLimit + 1);

    const rows = await query<UsageEventEntity>(
      `SELECT * FROM usage_events ${where} ORDER BY created_at DESC, id DESC LIMIT $${paramIndex}`,
      params,
    );

    const hasMore = rows.length > fetchLimit;
    const entries = hasMore ? rows.slice(0, fetchLimit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && entries.length > 0) {
      const last = entries[entries.length - 1];
      const ts = last.created_at instanceof Date ? last.created_at.toISOString() : String(last.created_at);
      nextCursor = Buffer.from(`${ts}|${last.id}`).toString('base64');
    }

    return { entries: entries.map(hydrate), nextCursor };
  }

  async listByUser(
    userId: string,
    options: { cursor?: string; limit?: number; eventType?: string } = {},
  ): Promise<{ entries: UsageEventEntity[]; nextCursor: string | null }> {
    const fetchLimit = Math.min(options.limit ?? 50, 100);
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];
    let paramIndex = 2;

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

    if (options.eventType) {
      conditions.push(`event_type = $${paramIndex++}`);
      params.push(options.eventType);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    params.push(fetchLimit + 1);

    const rows = await query<UsageEventEntity>(
      `SELECT * FROM usage_events ${where} ORDER BY created_at DESC, id DESC LIMIT $${paramIndex}`,
      params,
    );

    const hasMore = rows.length > fetchLimit;
    const entries = hasMore ? rows.slice(0, fetchLimit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && entries.length > 0) {
      const last = entries[entries.length - 1];
      const ts = last.created_at instanceof Date ? last.created_at.toISOString() : String(last.created_at);
      nextCursor = Buffer.from(`${ts}|${last.id}`).toString('base64');
    }

    return { entries: entries.map(hydrate), nextCursor };
  }

  async aggregateByType(
    workspaceId: string,
    since: Date,
  ): Promise<AggregateByTypeRow[]> {
    const rows = await query<{ event_type: string; total_events: string; total_quantity: string; total_credits: string }>(
      `SELECT event_type,
              COUNT(*)::text AS total_events,
              SUM(quantity)::text AS total_quantity,
              COALESCE(SUM(credits_consumed), 0)::text AS total_credits
       FROM usage_events
       WHERE workspace_id = $1 AND created_at >= $2
       GROUP BY event_type
       ORDER BY total_events DESC`,
      [workspaceId, since.toISOString()],
    );

    return rows.map((r) => ({
      event_type: r.event_type,
      total_events: parseInt(r.total_events, 10),
      total_quantity: parseInt(r.total_quantity, 10),
      total_credits: BigInt(r.total_credits),
    }));
  }

  async aggregateByDay(
    workspaceId: string,
    range: { from: Date; to: Date },
  ): Promise<AggregateByDayRow[]> {
    const rows = await query<{ day: string; total_events: string; total_quantity: string; total_credits: string }>(
      `SELECT date_trunc('day', created_at)::date::text AS day,
              COUNT(*)::text AS total_events,
              SUM(quantity)::text AS total_quantity,
              COALESCE(SUM(credits_consumed), 0)::text AS total_credits
       FROM usage_events
       WHERE workspace_id = $1 AND created_at >= $2 AND created_at <= $3
       GROUP BY day
       ORDER BY day ASC`,
      [workspaceId, range.from.toISOString(), range.to.toISOString()],
    );

    return rows.map((r) => ({
      day: r.day,
      total_events: parseInt(r.total_events, 10),
      total_quantity: parseInt(r.total_quantity, 10),
      total_credits: BigInt(r.total_credits),
    }));
  }

  async aggregateByDayAndType(
    workspaceId: string,
    range: { from: Date; to: Date },
  ): Promise<AggregateByDayAndTypeRow[]> {
    const rows = await query<{ day: string; event_type: string; total_events: string; total_quantity: string; total_credits: string }>(
      `SELECT date_trunc('day', created_at)::date::text AS day,
              event_type,
              COUNT(*)::text AS total_events,
              SUM(quantity)::text AS total_quantity,
              COALESCE(SUM(credits_consumed), 0)::text AS total_credits
       FROM usage_events
       WHERE workspace_id = $1 AND created_at >= $2 AND created_at <= $3
       GROUP BY day, event_type
       ORDER BY day ASC, event_type ASC`,
      [workspaceId, range.from.toISOString(), range.to.toISOString()],
    );

    return rows.map((r) => ({
      day: r.day,
      event_type: r.event_type,
      total_events: parseInt(r.total_events, 10),
      total_quantity: parseInt(r.total_quantity, 10),
      total_credits: BigInt(r.total_credits),
    }));
  }

  async summaryForOrg(
    workspaceId: string,
    range: { from: Date; to: Date },
  ): Promise<{ totalEvents: number; totalCharged: number; totalCredits: bigint }> {
    const rows = await query<{ total_events: string; total_charged: string; total_credits: string }>(
      `SELECT COUNT(*)::text AS total_events,
              COUNT(*) FILTER (WHERE credits_consumed > 0)::text AS total_charged,
              COALESCE(SUM(credits_consumed), 0)::text AS total_credits
       FROM usage_events
       WHERE workspace_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [workspaceId, range.from.toISOString(), range.to.toISOString()],
    );

    const row = rows[0];
    return {
      totalEvents: parseInt(row?.total_events ?? '0', 10),
      totalCharged: parseInt(row?.total_charged ?? '0', 10),
      totalCredits: BigInt(row?.total_credits ?? '0'),
    };
  }
}

function hydrate(row: UsageEventEntity): UsageEventEntity {
  return {
    ...row,
    credits_consumed: BigInt(row.credits_consumed),
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
  };
}
