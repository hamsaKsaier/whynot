import { query } from '../connection';

export interface WorkspaceEntity {
  id: string;
  name: string;
  owner_id: string;
  created_at: Date;
}

export interface CreateWorkspaceInput {
  name: string;
  owner_id: string;
}

export class WorkspaceRepository {
  /**
   * Create a new workspace
   */
  async create(input: CreateWorkspaceInput): Promise<WorkspaceEntity> {
    const result = await query<WorkspaceEntity>(
      `INSERT INTO workspaces (name, owner_id)
       VALUES ($1, $2)
       RETURNING *`,
      [input.name, input.owner_id]
    );
    return result[0];
  }

  /**
   * Find workspace by ID
   */
  async findById(id: string): Promise<WorkspaceEntity | null> {
    const result = await query<WorkspaceEntity>(
      'SELECT * FROM workspaces WHERE id = $1',
      [id]
    );
    return result[0] || null;
  }

  /**
   * Find all workspaces owned by a user
   */
  async findAllByUserId(userId: string): Promise<WorkspaceEntity[]> {
    return await query<WorkspaceEntity>(
      'SELECT * FROM workspaces WHERE owner_id = $1 ORDER BY created_at ASC',
      [userId]
    );
  }

  /**
   * Rename a workspace
   */
  async update(id: string, name: string): Promise<WorkspaceEntity | null> {
    const result = await query<WorkspaceEntity>(
      'UPDATE workspaces SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    );
    return result[0] || null;
  }

  /**
   * Delete a workspace (caller must ensure it is not user's only workspace)
   */
  async delete(id: string): Promise<boolean> {
    await query('DELETE FROM workspaces WHERE id = $1', [id]);
    return true;
  }

  /**
   * Count workspaces owned by a user
   */
  async countByUserId(userId: string): Promise<number> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM workspaces WHERE owner_id = $1',
      [userId]
    );
    return parseInt(result[0]?.count || '0', 10);
  }
}
