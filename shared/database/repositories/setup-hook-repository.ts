import { query } from '../connection';
import { SetupHook, TestStep } from '../../types';

export interface SetupHookEntity {
  id: string;
  name: string;
  level: 'global' | 'suite' | 'test_case';
  steps: any; // JSONB
  enabled: boolean;
  test_case_id: string | null;
  folder_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSetupHookInput {
  name: string;
  level: 'global' | 'suite' | 'test_case';
  steps: TestStep[];
  enabled?: boolean;
  test_case_id?: string | null;
  folder_id?: string | null;
}

export interface UpdateSetupHookInput {
  name?: string;
  steps?: TestStep[];
  enabled?: boolean;
}

export class SetupHookRepository {
  /**
   * Create a new setup hook
   */
  async create(input: CreateSetupHookInput): Promise<SetupHookEntity> {
    const result = await query<SetupHookEntity>(
      `INSERT INTO setup_hooks (name, level, steps, enabled, test_case_id, folder_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.name,
        input.level,
        JSON.stringify(input.steps),
        input.enabled !== undefined ? input.enabled : true,
        input.test_case_id || null,
        input.folder_id || null
      ]
    );
    
    return result[0];
  }

  /**
   * Find setup hook by ID
   */
  async findById(id: string): Promise<SetupHookEntity | null> {
    const result = await query<SetupHookEntity>(
      'SELECT * FROM setup_hooks WHERE id = $1',
      [id]
    );
    
    return result[0] || null;
  }

  /**
   * Find global setup hooks
   */
  async findByLevel(level: 'global' | 'suite' | 'test_case'): Promise<SetupHookEntity[]> {
    try {
      return await query<SetupHookEntity>(
        'SELECT * FROM setup_hooks WHERE level = $1 AND enabled = true ORDER BY created_at ASC',
        [level]
      );
    } catch (err: any) {
      if (err.code === '42P01') return []; // Table doesn't exist yet — treat as no hooks
      throw err;
    }
  }

  /**
   * Find setup hooks for a specific test case
   */
  async findByTestCaseId(testCaseId: string): Promise<SetupHookEntity[]> {
    try {
      return await query<SetupHookEntity>(
        'SELECT * FROM setup_hooks WHERE test_case_id = $1 AND enabled = true ORDER BY created_at ASC',
        [testCaseId]
      );
    } catch (err: any) {
      if (err.code === '42P01') return [];
      throw err;
    }
  }

  /**
   * Find setup hooks for a specific folder
   */
  async findByFolderId(folderId: string): Promise<SetupHookEntity[]> {
    try {
      return await query<SetupHookEntity>(
        'SELECT * FROM setup_hooks WHERE folder_id = $1 AND enabled = true ORDER BY created_at ASC',
        [folderId]
      );
    } catch (err: any) {
      if (err.code === '42P01') return [];
      throw err;
    }
  }

  /**
   * Get all setup hooks for a test case (includes global, suite, and test_case level)
   */
  async findAllForTestCase(testCaseId: string, folderId?: string | null): Promise<{
    global: SetupHookEntity[];
    suite: SetupHookEntity[];
    testCase: SetupHookEntity[];
  }> {
    const global = await this.findByLevel('global');
    
    let suite: SetupHookEntity[] = [];
    if (folderId) {
      suite = await this.findByFolderId(folderId);
    }
    
    const testCase = await this.findByTestCaseId(testCaseId);

    return { global, suite, testCase };
  }

  /**
   * List all setup hooks
   */
  async list(offset: number = 0, limit: number = 100): Promise<SetupHookEntity[]> {
    return await query<SetupHookEntity>(
      'SELECT * FROM setup_hooks ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
  }

  /**
   * Update setup hook
   */
  async update(id: string, updates: UpdateSetupHookInput): Promise<SetupHookEntity | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updatesList.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.steps !== undefined) {
      updatesList.push(`steps = $${paramIndex++}`);
      values.push(JSON.stringify(updates.steps));
    }
    if (updates.enabled !== undefined) {
      updatesList.push(`enabled = $${paramIndex++}`);
      values.push(updates.enabled);
    }

    if (updatesList.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query<SetupHookEntity>(
      `UPDATE setup_hooks SET ${updatesList.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result[0] || null;
  }

  /**
   * Delete setup hook
   */
  async delete(id: string): Promise<boolean> {
    await query(
      'DELETE FROM setup_hooks WHERE id = $1',
      [id]
    );
    
    return true;
  }
}






