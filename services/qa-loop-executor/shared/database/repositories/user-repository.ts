import { query } from '../connection';

export interface UserEntity {
  id: string;
  email: string | null;
  password_hash: string | null;
  name: string;
  avatar_url: string | null;
  github_id: string | null;
  google_id: string | null;
  role: 'user' | 'admin' | 'super_admin';
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  email?: string;
  password_hash?: string;
  name: string;
  avatar_url?: string;
  github_id?: string;
  google_id?: string;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  avatar_url?: string;
  github_id?: string;
  google_id?: string;
}

export class UserRepository {
  /**
   * Create a new user
   */
  async create(input: CreateUserInput): Promise<UserEntity> {
    const result = await query<UserEntity>(
      `INSERT INTO users (email, password_hash, name, avatar_url, github_id, google_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.email || null,
        input.password_hash || null,
        input.name,
        input.avatar_url || null,
        input.github_id || null,
        input.google_id || null
      ]
    );
    return result[0];
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<UserEntity | null> {
    const result = await query<UserEntity>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result[0] || null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    const result = await query<UserEntity>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result[0] || null;
  }

  /**
   * Find user by GitHub ID
   */
  async findByGithubId(githubId: string): Promise<UserEntity | null> {
    const result = await query<UserEntity>(
      'SELECT * FROM users WHERE github_id = $1',
      [githubId]
    );
    return result[0] || null;
  }

  /**
   * Find user by Google ID
   */
  async findByGoogleId(googleId: string): Promise<UserEntity | null> {
    const result = await query<UserEntity>(
      'SELECT * FROM users WHERE google_id = $1',
      [googleId]
    );
    return result[0] || null;
  }

  /**
   * Update user fields
   */
  async update(id: string, updates: UpdateUserInput): Promise<UserEntity | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.email !== undefined) {
      updatesList.push(`email = $${paramIndex++}`);
      values.push(updates.email);
    }
    if (updates.name !== undefined) {
      updatesList.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.avatar_url !== undefined) {
      updatesList.push(`avatar_url = $${paramIndex++}`);
      values.push(updates.avatar_url);
    }
    if (updates.github_id !== undefined) {
      updatesList.push(`github_id = $${paramIndex++}`);
      values.push(updates.github_id);
    }
    if (updates.google_id !== undefined) {
      updatesList.push(`google_id = $${paramIndex++}`);
      values.push(updates.google_id);
    }

    if (updatesList.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query<UserEntity>(
      `UPDATE users SET ${updatesList.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result[0] || null;
  }

  /**
   * Update user role
   */
  async updateRole(id: string, role: 'user' | 'admin' | 'super_admin'): Promise<UserEntity | null> {
    const result = await query<UserEntity>(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
      [role, id]
    );
    return result[0] || null;
  }

  /**
   * Find all users with pagination and optional search/filter
   */
  async findAllPaginated(
    offset: number,
    limit: number,
    filters?: { search?: string; role?: string }
  ): Promise<{ users: UserEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }
    if (filters?.role) {
      conditions.push(`role = $${paramIndex++}`);
      values.push(filters.role);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users ${whereClause}`,
      values
    );
    const total = parseInt(countResult[0]?.count || '0', 10);

    values.push(limit, offset);
    const users = await query<UserEntity>(
      `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    return { users, total };
  }

  /**
   * Count all users
   */
  async countAll(): Promise<number> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM users'
    );
    return parseInt(result[0]?.count || '0', 10);
  }
}
