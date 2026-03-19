import { query } from '../connection';

export interface IntegrationEntity {
  id: string;
  workspace_id: string;
  type: 'jira' | 'clickup' | 'linear';
  name: string;
  config: Record<string, any>; // API URL, token, project key etc.
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateIntegrationInput {
  workspace_id: string;
  type: 'jira' | 'clickup' | 'linear';
  name: string;
  config: Record<string, any>;
}

export interface BugTaskEntity {
  id: string;
  bug_id: string;
  integration_id: string;
  external_id: string;
  external_url: string | null;
  status: string;
  created_at: Date;
}

export interface CreateBugTaskInput {
  bug_id: string;
  integration_id: string;
  external_id: string;
  external_url?: string;
}

export class IntegrationRepository {
  /**
   * Create a new integration
   */
  async create(input: CreateIntegrationInput): Promise<IntegrationEntity> {
    const result = await query<IntegrationEntity>(
      `INSERT INTO integrations (workspace_id, type, name, config)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.workspace_id, input.type, input.name, JSON.stringify(input.config)]
    );
    return result[0];
  }

  /**
   * Find integration by ID
   */
  async findById(id: string): Promise<IntegrationEntity | null> {
    const result = await query<IntegrationEntity>(
      'SELECT * FROM integrations WHERE id = $1',
      [id]
    );
    return result[0] || null;
  }

  /**
   * List integrations for a workspace
   */
  async findByWorkspace(workspaceId: string): Promise<IntegrationEntity[]> {
    return query<IntegrationEntity>(
      'SELECT * FROM integrations WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId]
    );
  }

  /**
   * Update integration
   */
  async update(id: string, updates: Partial<Pick<IntegrationEntity, 'name' | 'config' | 'is_active'>>): Promise<IntegrationEntity | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.config !== undefined) {
      setClauses.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.config));
    }
    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }

    if (setClauses.length === 0) return this.findById(id);

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query<IntegrationEntity>(
      `UPDATE integrations SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result[0] || null;
  }

  /**
   * Delete integration
   */
  async delete(id: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM integrations WHERE id = $1 RETURNING id',
      [id]
    );
    return result.length > 0;
  }

  // ─── Bug Tasks ───

  /**
   * Create a bug task link
   */
  async createBugTask(input: CreateBugTaskInput): Promise<BugTaskEntity> {
    const result = await query<BugTaskEntity>(
      `INSERT INTO bug_tasks (bug_id, integration_id, external_id, external_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.bug_id, input.integration_id, input.external_id, input.external_url || null]
    );
    return result[0];
  }

  /**
   * Find bug tasks for a bug
   */
  async findBugTasks(bugId: string): Promise<BugTaskEntity[]> {
    return query<BugTaskEntity>(
      `SELECT bt.*, i.type as integration_type, i.name as integration_name
       FROM bug_tasks bt
       JOIN integrations i ON i.id = bt.integration_id
       WHERE bt.bug_id = $1
       ORDER BY bt.created_at DESC`,
      [bugId]
    );
  }

  /**
   * Find all bug tasks for a session's bugs
   */
  async findBugTasksBySession(sessionId: string): Promise<BugTaskEntity[]> {
    return query<BugTaskEntity>(
      `SELECT bt.*, i.type as integration_type, i.name as integration_name
       FROM bug_tasks bt
       JOIN integrations i ON i.id = bt.integration_id
       JOIN qa_loop_bugs b ON b.id = bt.bug_id
       WHERE b.session_id = $1
       ORDER BY bt.created_at DESC`,
      [sessionId]
    );
  }
}
