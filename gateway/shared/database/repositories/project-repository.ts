import { query } from '../connection';

export interface ProjectEntity {
  id: string;
  name: string;
  description: string | null;
  website_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  website_url?: string;
  workspace_id?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  website_url?: string;
}

export class ProjectRepository {
  /**
   * Create a new project
   */
  async create(input: CreateProjectInput): Promise<ProjectEntity> {
    const result = await query<ProjectEntity>(
      `INSERT INTO projects (name, description, website_url, workspace_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        input.name,
        input.description || null,
        input.website_url || null,
        input.workspace_id || null
      ]
    );

    return result[0];
  }

  /**
   * Find project by ID
   */
  async findById(id: string): Promise<ProjectEntity | null> {
    const result = await query<ProjectEntity>(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );

    return result[0] || null;
  }

  /**
   * Find project by ID scoped to a workspace (security: ownership check)
   */
  async findByIdForWorkspace(id: string, workspaceId: string): Promise<ProjectEntity | null> {
    const result = await query<ProjectEntity>(
      'SELECT * FROM projects WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId]
    );

    return result[0] || null;
  }

  /**
   * List all projects with pagination, optionally scoped to a workspace
   */
  async list(offset: number = 0, limit: number = 50, workspaceId?: string): Promise<ProjectEntity[]> {
    if (workspaceId) {
      return await query<ProjectEntity>(
        'SELECT * FROM projects WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [workspaceId, limit, offset]
      );
    }
    return await query<ProjectEntity>(
      'SELECT * FROM projects ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
  }

  /**
   * Get total count of projects, optionally scoped to a workspace
   */
  async count(workspaceId?: string): Promise<number> {
    if (workspaceId) {
      const result = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM projects WHERE workspace_id = $1',
        [workspaceId]
      );
      return parseInt(result[0]?.count || '0', 10);
    }
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM projects'
    );
    return parseInt(result[0]?.count || '0', 10);
  }

  /**
   * Update project
   */
  async update(id: string, updates: UpdateProjectInput): Promise<ProjectEntity | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updatesList.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      updatesList.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.website_url !== undefined) {
      updatesList.push(`website_url = $${paramIndex++}`);
      values.push(updates.website_url);
    }

    if (updatesList.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query<ProjectEntity>(
      `UPDATE projects SET ${updatesList.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result[0] || null;
  }

  /**
   * Delete project (cascades to user stories due to FK constraint)
   */
  async delete(id: string): Promise<boolean> {
    await query(
      'DELETE FROM projects WHERE id = $1',
      [id]
    );

    return true;
  }

  /**
   * Get project with user story count
   */
  async findByIdWithStats(id: string, workspaceId?: string): Promise<(ProjectEntity & { user_story_count: number }) | null> {
    const sql = workspaceId
      ? `SELECT p.*,
              (SELECT COUNT(*) FROM user_stories WHERE project_id = p.id) as user_story_count
         FROM projects p
         WHERE p.id = $1 AND p.workspace_id = $2`
      : `SELECT p.*,
              (SELECT COUNT(*) FROM user_stories WHERE project_id = p.id) as user_story_count
         FROM projects p
         WHERE p.id = $1`;

    const result = await query<ProjectEntity & { user_story_count: string }>(
      sql,
      workspaceId ? [id, workspaceId] : [id]
    );

    if (!result[0]) return null;

    return {
      ...result[0],
      user_story_count: parseInt(result[0].user_story_count || '0', 10)
    };
  }

  /**
   * List all projects with user story counts, optionally scoped to a workspace
   */
  async listWithStats(offset: number = 0, limit: number = 50, workspaceId?: string): Promise<(ProjectEntity & { user_story_count: number })[]> {
    const result = workspaceId
      ? await query<ProjectEntity & { user_story_count: string }>(
          `SELECT p.*,
                  (SELECT COUNT(*) FROM user_stories WHERE project_id = p.id) as user_story_count
           FROM projects p
           WHERE p.workspace_id = $1
           ORDER BY p.created_at DESC
           LIMIT $2 OFFSET $3`,
          [workspaceId, limit, offset]
        )
      : await query<ProjectEntity & { user_story_count: string }>(
          `SELECT p.*,
                  (SELECT COUNT(*) FROM user_stories WHERE project_id = p.id) as user_story_count
           FROM projects p
           ORDER BY p.created_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        );

    return result.map(row => ({
      ...row,
      user_story_count: parseInt(row.user_story_count || '0', 10)
    }));
  }
}








