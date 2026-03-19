import { query } from '../connection';

export interface AnnouncementEntity {
  id: string;
  title: string;
  body: string | null;
  type: 'info' | 'warning' | 'success' | 'error';
  is_active: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAnnouncementInput {
  title: string;
  body?: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  is_active?: boolean;
  starts_at?: Date;
  ends_at?: Date;
  created_by?: string;
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  is_active?: boolean;
  starts_at?: Date | null;
  ends_at?: Date | null;
}

export class AnnouncementRepository {
  async findAll(): Promise<AnnouncementEntity[]> {
    return query<AnnouncementEntity>('SELECT * FROM announcements ORDER BY created_at DESC');
  }

  async findActive(): Promise<AnnouncementEntity[]> {
    return query<AnnouncementEntity>(
      `SELECT * FROM announcements
       WHERE is_active = true
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())
       ORDER BY created_at DESC`
    );
  }

  async findById(id: string): Promise<AnnouncementEntity | null> {
    const rows = await query<AnnouncementEntity>('SELECT * FROM announcements WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async create(input: CreateAnnouncementInput): Promise<AnnouncementEntity> {
    const rows = await query<AnnouncementEntity>(
      `INSERT INTO announcements (title, body, type, is_active, starts_at, ends_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.title,
        input.body || null,
        input.type || 'info',
        input.is_active !== false,
        input.starts_at || null,
        input.ends_at || null,
        input.created_by || null,
      ]
    );
    return rows[0];
  }

  async update(id: string, input: UpdateAnnouncementInput): Promise<AnnouncementEntity | null> {
    const fields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) { fields.push(`title = $${paramIndex++}`); params.push(input.title); }
    if (input.body !== undefined) { fields.push(`body = $${paramIndex++}`); params.push(input.body); }
    if (input.type !== undefined) { fields.push(`type = $${paramIndex++}`); params.push(input.type); }
    if (input.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); params.push(input.is_active); }
    if (input.starts_at !== undefined) { fields.push(`starts_at = $${paramIndex++}`); params.push(input.starts_at); }
    if (input.ends_at !== undefined) { fields.push(`ends_at = $${paramIndex++}`); params.push(input.ends_at); }

    if (fields.length === 0) return this.findById(id);
    fields.push('updated_at = NOW()');

    const rows = await query<AnnouncementEntity>(
      `UPDATE announcements SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      [...params, id]
    );
    return rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>('DELETE FROM announcements WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  }
}
