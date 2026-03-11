import { query } from '../connection';

export interface GitHubRepoEntity {
  id: string;
  workspace_id: string;
  owner: string;
  repo: string;
  default_branch: string;
  access_token: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AutoFixAttemptEntity {
  id: string;
  bug_id: string;
  github_repo_id: string;
  status: 'pending' | 'analyzing' | 'generating' | 'pr_created' | 'verified' | 'failed';
  branch_name: string | null;
  pr_number: number | null;
  pr_url: string | null;
  relevant_files: any;
  generated_diff: string | null;
  claude_reasoning: string | null;
  verification_status: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export class AutoFixRepository {
  // ─── GitHub Repos ───

  async createRepo(input: {
    workspace_id: string;
    owner: string;
    repo: string;
    default_branch?: string;
    access_token?: string;
  }): Promise<GitHubRepoEntity> {
    const result = await query<GitHubRepoEntity>(
      `INSERT INTO github_repos (workspace_id, owner, repo, default_branch, access_token)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (workspace_id, owner, repo)
       DO UPDATE SET access_token = EXCLUDED.access_token, updated_at = NOW()
       RETURNING *`,
      [input.workspace_id, input.owner, input.repo, input.default_branch || 'main', input.access_token || null]
    );
    return result[0];
  }

  async findRepoById(id: string): Promise<GitHubRepoEntity | null> {
    const result = await query<GitHubRepoEntity>(
      'SELECT * FROM github_repos WHERE id = $1',
      [id]
    );
    return result[0] || null;
  }

  async findReposByWorkspace(workspaceId: string): Promise<GitHubRepoEntity[]> {
    return query<GitHubRepoEntity>(
      'SELECT * FROM github_repos WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId]
    );
  }

  async deleteRepo(id: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM github_repos WHERE id = $1 RETURNING id',
      [id]
    );
    return result.length > 0;
  }

  // ─── Auto Fix Attempts ───

  async createAttempt(input: {
    bug_id: string;
    github_repo_id: string;
  }): Promise<AutoFixAttemptEntity> {
    const result = await query<AutoFixAttemptEntity>(
      `INSERT INTO auto_fix_attempts (bug_id, github_repo_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [input.bug_id, input.github_repo_id]
    );
    return result[0];
  }

  async updateAttempt(id: string, updates: Partial<AutoFixAttemptEntity>): Promise<AutoFixAttemptEntity | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ['status', 'branch_name', 'pr_number', 'pr_url', 'relevant_files', 'generated_diff', 'claude_reasoning', 'verification_status', 'error_message'];

    for (const field of allowedFields) {
      if ((updates as any)[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex++}`);
        const val = (updates as any)[field];
        values.push(field === 'relevant_files' ? JSON.stringify(val) : val);
      }
    }

    if (setClauses.length === 0) return this.findAttemptById(id);

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query<AutoFixAttemptEntity>(
      `UPDATE auto_fix_attempts SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result[0] || null;
  }

  async findAttemptById(id: string): Promise<AutoFixAttemptEntity | null> {
    const result = await query<AutoFixAttemptEntity>(
      'SELECT * FROM auto_fix_attempts WHERE id = $1',
      [id]
    );
    return result[0] || null;
  }

  async findAttemptsByBug(bugId: string): Promise<AutoFixAttemptEntity[]> {
    return query<AutoFixAttemptEntity>(
      'SELECT * FROM auto_fix_attempts WHERE bug_id = $1 ORDER BY created_at DESC',
      [bugId]
    );
  }
}
