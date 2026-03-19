import { query } from '../connection';

export interface UserStoryEntity {
  id: string;
  project_id: string;
  story: string;
  website_url: string | null;
  additional_context: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserStoryInput {
  project_id: string;
  story: string;
  website_url?: string;
  additional_context?: string;
  workspace_id?: string;
}

export interface UpdateUserStoryInput {
  story?: string;
  website_url?: string;
  additional_context?: string;
}

export class UserStoryRepository {
  /**
   * Create a new user story
   */
  async create(input: CreateUserStoryInput): Promise<UserStoryEntity> {
    const result = await query<UserStoryEntity>(
      `INSERT INTO user_stories (project_id, story, website_url, additional_context, workspace_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.project_id,
        input.story,
        input.website_url || null,
        input.additional_context || null,
        input.workspace_id || null
      ]
    );

    return result[0];
  }

  /**
   * Find user story by ID
   */
  async findById(id: string): Promise<UserStoryEntity | null> {
    const result = await query<UserStoryEntity>(
      'SELECT * FROM user_stories WHERE id = $1',
      [id]
    );

    return result[0] || null;
  }

  /**
   * Find all user stories for a project
   */
  async findByProjectId(projectId: string, offset: number = 0, limit: number = 100): Promise<UserStoryEntity[]> {
    return await query<UserStoryEntity>(
      'SELECT * FROM user_stories WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [projectId, limit, offset]
    );
  }

  /**
   * Get count of user stories for a project
   */
  async countByProjectId(projectId: string): Promise<number> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM user_stories WHERE project_id = $1',
      [projectId]
    );
    return parseInt(result[0]?.count || '0', 10);
  }

  /**
   * Update user story
   */
  async update(id: string, updates: UpdateUserStoryInput): Promise<UserStoryEntity | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.story !== undefined) {
      updatesList.push(`story = $${paramIndex++}`);
      values.push(updates.story);
    }
    if (updates.website_url !== undefined) {
      updatesList.push(`website_url = $${paramIndex++}`);
      values.push(updates.website_url);
    }
    if (updates.additional_context !== undefined) {
      updatesList.push(`additional_context = $${paramIndex++}`);
      values.push(updates.additional_context);
    }

    if (updatesList.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query<UserStoryEntity>(
      `UPDATE user_stories SET ${updatesList.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result[0] || null;
  }

  /**
   * Delete user story
   */
  async delete(id: string): Promise<boolean> {
    await query(
      'DELETE FROM user_stories WHERE id = $1',
      [id]
    );

    return true;
  }

  /**
   * Find user story with test case count
   */
  async findByIdWithStats(id: string): Promise<(UserStoryEntity & { test_case_count: number }) | null> {
    const result = await query<UserStoryEntity & { test_case_count: string }>(
      `SELECT us.*, 
              (SELECT COUNT(*) FROM test_cases WHERE user_story_id = us.id) as test_case_count
       FROM user_stories us
       WHERE us.id = $1`,
      [id]
    );

    if (!result[0]) return null;

    return {
      ...result[0],
      test_case_count: parseInt(result[0].test_case_count || '0', 10)
    };
  }

  /**
   * Find all user stories for a project with test case counts
   */
  async findByProjectIdWithStats(projectId: string, offset: number = 0, limit: number = 100): Promise<(UserStoryEntity & { test_case_count: number })[]> {
    const result = await query<UserStoryEntity & { test_case_count: string }>(
      `SELECT us.*, 
              (SELECT COUNT(*) FROM test_cases WHERE user_story_id = us.id) as test_case_count
       FROM user_stories us
       WHERE us.project_id = $1
       ORDER BY us.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [projectId, limit, offset]
    );

    return result.map(row => ({
      ...row,
      test_case_count: parseInt(row.test_case_count || '0', 10)
    }));
  }
}








