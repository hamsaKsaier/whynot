import { query } from '../connection';

export interface FolderEntity {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateFolderInput {
  project_id: string;
  name: string;
  color?: string;
}

export interface UpdateFolderInput {
  name?: string;
  color?: string;
}

export class FolderRepository {
  /**
   * Create a new folder
   */
  async create(input: CreateFolderInput): Promise<FolderEntity> {
    const result = await query<FolderEntity>(
      `INSERT INTO user_story_folders (project_id, name, color)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [
        input.project_id,
        input.name,
        input.color || '#6366f1'
      ]
    );

    return result[0];
  }

  /**
   * Find folder by ID
   */
  async findById(id: string): Promise<FolderEntity | null> {
    const result = await query<FolderEntity>(
      'SELECT * FROM user_story_folders WHERE id = $1',
      [id]
    );

    return result[0] || null;
  }

  /**
   * List all folders for a project
   */
  async listByProject(projectId: string): Promise<FolderEntity[]> {
    return await query<FolderEntity>(
      'SELECT * FROM user_story_folders WHERE project_id = $1 ORDER BY name ASC',
      [projectId]
    );
  }

  /**
   * List folders with user story count
   */
  async listByProjectWithStats(projectId: string): Promise<(FolderEntity & { user_story_count: number })[]> {
    const result = await query<FolderEntity & { user_story_count: string }>(
      `SELECT f.*, 
              (SELECT COUNT(*) FROM user_stories WHERE folder_id = f.id) as user_story_count
       FROM user_story_folders f
       WHERE f.project_id = $1
       ORDER BY f.name ASC`,
      [projectId]
    );

    return result.map(row => ({
      ...row,
      user_story_count: parseInt(row.user_story_count || '0', 10)
    }));
  }

  /**
   * Update folder
   */
  async update(id: string, updates: UpdateFolderInput): Promise<FolderEntity | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updatesList.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.color !== undefined) {
      updatesList.push(`color = $${paramIndex++}`);
      values.push(updates.color);
    }

    if (updatesList.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query<FolderEntity>(
      `UPDATE user_story_folders SET ${updatesList.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result[0] || null;
  }

  /**
   * Delete folder (user stories will have folder_id set to NULL due to FK constraint)
   */
  async delete(id: string): Promise<boolean> {
    await query(
      'DELETE FROM user_story_folders WHERE id = $1',
      [id]
    );

    return true;
  }

  /**
   * Assign a user story to a folder
   */
  async assignUserStoryToFolder(userStoryId: string, folderId: string | null): Promise<boolean> {
    await query(
      'UPDATE user_stories SET folder_id = $1 WHERE id = $2',
      [folderId, userStoryId]
    );

    return true;
  }

  /**
   * Get user stories in a folder
   */
  async getUserStoriesInFolder(folderId: string): Promise<string[]> {
    const result = await query<{ id: string }>(
      'SELECT id FROM user_stories WHERE folder_id = $1',
      [folderId]
    );

    return result.map(row => row.id);
  }
}






