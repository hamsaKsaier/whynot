import { query } from '../connection';

export interface UserEntity {
  id: string;
  email: string | null;
  password_hash: string | null;
  name: string;
  avatar_url: string | null;
  github_id: string | null;
  google_id: string | null;
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
}
