import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getPool } from '../../../shared/database/connection';
import { createLogger } from '../../../shared/logger/logger';

const logger = createLogger('qa-loop-repository');

export interface CreateSessionParams {
  projectId?: string;
  workspaceId?: string;
  targetUrl: string;
  mode: string;
  qualityThreshold?: number;
  maxIterations?: number;
  maxDurationHours?: number;
  documentContext?: string;
  config?: Record<string, any>;
}

export interface QALoopSession {
  id: string;
  project_id: string | null;
  workspace_id: string | null;
  target_url: string;
  mode: string;
  status: string;
  quality_score: number;
  quality_threshold: number;
  iteration_count: number;
  max_iterations: number;
  max_duration_hours: number;
  config: Record<string, any>;
  document_context: string | null;
  error_message: string | null;
  pages_explored: number;
  tests_generated: number;
  bugs_found: number;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface QALoopPage {
  id: string;
  session_id: string;
  project_id: string | null;
  url: string;
  url_pattern: string | null;
  page_type: string | null;
  title: string | null;
  html_hash: string | null;
  screenshot_path: string | null;
  description: string | null;
  discovered_elements: Record<string, any>;
  is_explored: boolean;
  priority: number;
  explored_at: Date | null;
  created_at: Date;
}

export interface QALoopTestCase {
  id: string;
  session_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  category: string;
  priority: number;
  risk_level: string;
  steps: any[];
  selectors: Record<string, any>;
  source: string;
  source_page_url: string | null;
  is_active: boolean;
  last_run_status: string | null;
  last_run_at: Date | null;
  playwright_code: string | null;
  confidence_score: number | null;
  total_runs: number;
  pass_count: number;
  created_at: Date;
}

export interface QALoopBug {
  id: string;
  session_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  severity: string;
  category: string | null;
  bug_type: string | null;
  page_url: string | null;
  reproduction_steps: any[];
  evidence_screenshots: any[];
  root_cause: string | null;
  suggested_fix: string | null;
  status: string;
  created_at: Date;
}

export interface QALoopNote {
  id: string;
  session_id: string;
  note: string;
  category: string;
  iteration_number: number | null;
  page_url: string | null;
  is_resolved: boolean;
  created_at: Date;
}

export interface QALoopTestRun {
  id: string;
  session_id: string;
  test_case_id: string;
  status: string;
  duration_ms: number | null;
  steps_completed: number;
  failure_step_index: number | null;
  failure_reason: string | null;
  self_healed: boolean;
  executed_at: Date;
}

export class QALoopRepository {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  // Session methods
  async createSession(params: CreateSessionParams): Promise<QALoopSession> {
    const id = uuidv4();
    const query = `
      INSERT INTO qa_loop_sessions (
        id, project_id, workspace_id, target_url, mode, quality_threshold,
        max_iterations, max_duration_hours, document_context, config,
        status, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'running', CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      id,
      params.projectId || null,
      params.workspaceId || null,
      params.targetUrl,
      params.mode,
      params.qualityThreshold || 80,
      params.maxIterations || 100,
      params.maxDurationHours || 12,
      params.documentContext || null,
      JSON.stringify(params.config || {})
    ]);

    logger.info('Created QA Loop session', { sessionId: id, workspaceId: params.workspaceId });
    return result.rows[0];
  }

  async getSession(id: string, workspaceId?: string): Promise<QALoopSession | null> {
    const query = workspaceId
      ? 'SELECT * FROM qa_loop_sessions WHERE id = $1 AND (workspace_id = $2 OR workspace_id IS NULL)'
      : 'SELECT * FROM qa_loop_sessions WHERE id = $1';
    const params = workspaceId ? [id, workspaceId] : [id];
    const result = await this.pool.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Find the most recent completed session for a base URL (Phase 3)
   * Optionally scoped to a specific workspace.
   */
  async findLatestCompletedByBaseUrl(baseUrl: string, workspaceId?: string): Promise<QALoopSession | null> {
    const query = workspaceId
      ? `SELECT * FROM qa_loop_sessions
         WHERE target_url LIKE $1 || '%' AND status = 'completed'
           AND (workspace_id = $2 OR workspace_id IS NULL)
         ORDER BY completed_at DESC LIMIT 1`
      : `SELECT * FROM qa_loop_sessions
         WHERE target_url LIKE $1 || '%' AND status = 'completed'
         ORDER BY completed_at DESC LIMIT 1`;
    const params = workspaceId ? [baseUrl, workspaceId] : [baseUrl];
    const result = await this.pool.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Clone test cases and pages from a source session to a new session (Phase 3)
   */
  async cloneSessionData(sourceId: string, targetId: string): Promise<void> {
    logger.info('Cloning session data', { sourceId, targetId });

    // Clone test cases (including playwright_code)
    await this.pool.query(`
      INSERT INTO qa_loop_test_cases (id, session_id, name, description, category, priority, risk_level, steps, selectors, source, source_page_url, playwright_code)
      SELECT gen_random_uuid(), $2, name, description, category, priority, risk_level, steps, selectors, source, source_page_url, playwright_code
      FROM qa_loop_test_cases WHERE session_id = $1
    `, [sourceId, targetId]);

    // Clone pages (mark as unexplored so they get re-explored)
    await this.pool.query(`
      INSERT INTO qa_loop_pages (id, session_id, url, title, page_type, description, is_explored, priority)
      SELECT gen_random_uuid(), $2, url, title, page_type, description, false, priority
      FROM qa_loop_pages WHERE session_id = $1
    `, [sourceId, targetId]);

    logger.info('Session data cloned successfully', { sourceId, targetId });
  }

  async listSessions(params: {
    projectId?: string;
    workspaceId?: string;
    status?: string;
    limit: number;
    offset: number;
  }): Promise<{ sessions: QALoopSession[]; total: number }> {
    let whereClause = '1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.workspaceId) {
      whereClause += ` AND (workspace_id = $${paramIndex++} OR workspace_id IS NULL)`;
      queryParams.push(params.workspaceId);
    }
    if (params.projectId) {
      whereClause += ` AND project_id = $${paramIndex++}`;
      queryParams.push(params.projectId);
    }
    if (params.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      queryParams.push(params.status);
    }

    const countQuery = `SELECT COUNT(*) FROM qa_loop_sessions WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT * FROM qa_loop_sessions 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    queryParams.push(params.limit, params.offset);

    const result = await this.pool.query(query, queryParams);
    return { sessions: result.rows, total };
  }

  async updateSessionStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    const isTerminalStatus = ['completed', 'failed', 'cancelled'].includes(status);

    const query = isTerminalStatus
      ? `UPDATE qa_loop_sessions 
         SET status = $2, error_message = $3, completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`
      : `UPDATE qa_loop_sessions 
         SET status = $2, error_message = $3
         WHERE id = $1`;

    await this.pool.query(query, [id, status, errorMessage || null]);
  }

  async updateSessionVideoPath(id: string, videoPath: string): Promise<void> {
    await this.pool.query(
      'UPDATE qa_loop_sessions SET video_path = $2 WHERE id = $1',
      [id, videoPath]
    );
    logger.info('Updated session video path', { sessionId: id, videoPath });
  }

  async updateSessionProgress(id: string, progress: {
    iterationCount?: number;
    qualityScore?: number;
    pagesExplored?: number;
    testsGenerated?: number;
    bugsFound?: number;
  }): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (progress.iterationCount !== undefined) {
      updates.push(`iteration_count = $${paramIndex++}`);
      params.push(progress.iterationCount);
    }
    if (progress.qualityScore !== undefined) {
      updates.push(`quality_score = $${paramIndex++}`);
      params.push(progress.qualityScore);
    }
    if (progress.pagesExplored !== undefined) {
      updates.push(`pages_explored = $${paramIndex++}`);
      params.push(progress.pagesExplored);
    }
    if (progress.testsGenerated !== undefined) {
      updates.push(`tests_generated = $${paramIndex++}`);
      params.push(progress.testsGenerated);
    }
    if (progress.bugsFound !== undefined) {
      updates.push(`bugs_found = $${paramIndex++}`);
      params.push(progress.bugsFound);
    }

    if (updates.length > 0) {
      const query = `UPDATE qa_loop_sessions SET ${updates.join(', ')} WHERE id = $1`;
      await this.pool.query(query, params);
    }
  }

  // Page methods
  async addPage(sessionId: string, page: {
    url: string;
    projectId?: string;
    title?: string;
    pageType?: string;
    htmlHash?: string;
    screenshotPath?: string;
    description?: string;
    discoveredElements?: Record<string, any>;
    priority?: number;
  }): Promise<QALoopPage> {
    const id = uuidv4();
    const query = `
      INSERT INTO qa_loop_pages (
        id, session_id, project_id, url, title, page_type,
        html_hash, screenshot_path, description, discovered_elements, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (session_id, url) DO UPDATE SET
        title = COALESCE(EXCLUDED.title, qa_loop_pages.title),
        page_type = COALESCE(EXCLUDED.page_type, qa_loop_pages.page_type),
        html_hash = COALESCE(EXCLUDED.html_hash, qa_loop_pages.html_hash),
        screenshot_path = COALESCE(EXCLUDED.screenshot_path, qa_loop_pages.screenshot_path),
        description = COALESCE(EXCLUDED.description, qa_loop_pages.description),
        discovered_elements = COALESCE(EXCLUDED.discovered_elements, qa_loop_pages.discovered_elements),
        priority = COALESCE(EXCLUDED.priority, qa_loop_pages.priority),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      id,
      sessionId,
      page.projectId || null,
      page.url,
      page.title || null,
      page.pageType || null,
      page.htmlHash || null,
      page.screenshotPath || null,
      page.description || null,
      JSON.stringify(page.discoveredElements || {}),
      page.priority || 50
    ]);

    return result.rows[0];
  }

  async markPageExplored(sessionId: string, url: string, analysis: {
    description?: string;
    discoveredElements?: Record<string, any>;
    pageType?: string;
  }): Promise<void> {
    const query = `
      UPDATE qa_loop_pages 
      SET is_explored = true,
          explored_at = CURRENT_TIMESTAMP,
          description = COALESCE($3, description),
          discovered_elements = COALESCE($4, discovered_elements),
          page_type = COALESCE($5, page_type)
      WHERE session_id = $1 AND url = $2
    `;
    await this.pool.query(query, [
      sessionId,
      url,
      analysis.description || null,
      analysis.discoveredElements ? JSON.stringify(analysis.discoveredElements) : null,
      analysis.pageType || null
    ]);
  }

  async getPages(sessionId: string, options?: { explored?: boolean }): Promise<QALoopPage[]> {
    let query = 'SELECT * FROM qa_loop_pages WHERE session_id = $1';
    const params: any[] = [sessionId];

    if (options?.explored !== undefined) {
      query += ' AND is_explored = $2';
      params.push(options.explored);
    }

    query += ' ORDER BY priority DESC, created_at ASC';
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getUnexploredPages(sessionId: string): Promise<QALoopPage[]> {
    return this.getPages(sessionId, { explored: false });
  }

  async getExploredPages(sessionId: string): Promise<QALoopPage[]> {
    return this.getPages(sessionId, { explored: true });
  }

  // Test case methods
  async addTestCase(sessionId: string, testCase: {
    projectId?: string;
    name: string;
    description?: string;
    category?: string;
    priority?: number;
    riskLevel?: string;
    steps: any[];
    selectors?: Record<string, any>;
    source?: string;
    sourcePageUrl?: string;
    observedResult?: 'pass' | 'fail';
    playwrightCode?: string;
  }): Promise<QALoopTestCase> {
    const id = uuidv4();
    const query = `
      INSERT INTO qa_loop_test_cases (
        id, session_id, project_id, name, description, category,
        priority, risk_level, steps, selectors, source, source_page_url,
        observed_result, playwright_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      id,
      sessionId,
      testCase.projectId || null,
      testCase.name,
      testCase.description || null,
      testCase.category || 'functional',
      testCase.priority || 50,
      testCase.riskLevel || 'medium',
      JSON.stringify(testCase.steps),
      JSON.stringify(testCase.selectors || {}),
      testCase.source || 'exploration',
      testCase.sourcePageUrl || null,
      testCase.observedResult || null,
      testCase.playwrightCode || null
    ]);

    logger.info('Added test case', { sessionId, testCaseId: id, name: testCase.name, observedResult: testCase.observedResult });
    return result.rows[0];
  }

  async getTestCases(sessionId: string, options?: { active?: boolean; category?: string }): Promise<QALoopTestCase[]> {
    let query = 'SELECT * FROM qa_loop_test_cases WHERE session_id = $1';
    const params: any[] = [sessionId];
    let paramIndex = 2;

    if (options?.active !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      params.push(options.active);
    }
    if (options?.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(options.category);
    }

    query += ' ORDER BY priority DESC, created_at ASC';
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getTestCaseById(testCaseId: string): Promise<QALoopTestCase | null> {
    const query = 'SELECT * FROM qa_loop_test_cases WHERE id = $1';
    const result = await this.pool.query(query, [testCaseId]);
    return result.rows[0] || null;
  }

  async updateTestCaseSteps(testCaseId: string, updates: {
    steps: any[];
    correctionSource?: string;
  }): Promise<void> {
    const query = `
      UPDATE qa_loop_test_cases
      SET steps = $2,
          source = COALESCE($3, source)
      WHERE id = $1
    `;
    await this.pool.query(query, [
      testCaseId,
      JSON.stringify(updates.steps),
      updates.correctionSource || null
    ]);
    logger.info('Updated test case steps (self-healing)', { testCaseId, correctionSource: updates.correctionSource });
  }

  async updateTestCaseSelectors(testCaseId: string, selectors: Record<string, any>): Promise<void> {
    const query = 'UPDATE qa_loop_test_cases SET selectors = $2 WHERE id = $1';
    await this.pool.query(query, [testCaseId, JSON.stringify(selectors)]);
  }

  async updateTestCaseLastRun(testCaseId: string, status: string, durationMs?: number): Promise<void> {
    // Compute pass/fail increments in TypeScript to avoid PostgreSQL "inconsistent
    // types deduced for parameter $2" error that occurs when the same parameter
    // appears in both a SET clause and a CASE expression in the same query.
    const passIncrement = status === 'passed' ? 1 : 0;
    const failIncrement = status === 'failed' ? 1 : 0;
    const totalIncrement = (status === 'passed' || status === 'failed') ? 1 : 0;
    const query = `
      UPDATE qa_loop_test_cases
      SET last_run_status    = $2,
          last_run_at        = CURRENT_TIMESTAMP,
          last_run_duration_ms = $3,
          pass_count         = pass_count + $4,
          fail_count         = fail_count + $5,
          total_runs         = COALESCE(total_runs, 0) + $6,
          confidence_score   = CASE
            WHEN (COALESCE(total_runs, 0) + $6) > 0
            THEN ROUND(((COALESCE(pass_count, 0) + $4)::DECIMAL / (COALESCE(total_runs, 0) + $6)) * 100, 2)
            ELSE NULL
          END
      WHERE id = $1
    `;
    await this.pool.query(query, [testCaseId, status, durationMs || null, passIncrement, failIncrement, totalIncrement]);
  }

  /**
   * Get confidence score for a test case based on its pass/fail history.
   */
  async getTestCaseConfidence(testCaseId: string): Promise<{
    confidence: number | null;
    totalRuns: number;
    passRate: number;
  }> {
    const query = `
      SELECT confidence_score, total_runs, pass_count
      FROM qa_loop_test_cases
      WHERE id = $1
    `;
    const result = await this.pool.query(query, [testCaseId]);
    if (result.rows.length === 0) {
      return { confidence: null, totalRuns: 0, passRate: 0 };
    }
    const row = result.rows[0];
    const totalRuns = row.total_runs || 0;
    const passCount = row.pass_count || 0;
    const passRate = totalRuns > 0 ? (passCount / totalRuns) * 100 : 0;
    return {
      confidence: row.confidence_score ? parseFloat(row.confidence_score) : null,
      totalRuns,
      passRate,
    };
  }

  // Bug methods

  /**
   * Compute a stable fingerprint for deduplication.
   * Bugs with the same session + page + category + bug_type are treated as duplicates.
   */
  private computeBugFingerprint(
    sessionId: string,
    pageUrl?: string,
    category?: string,
    bugType?: string
  ): string {
    const raw = `${sessionId}:${pageUrl ?? ''}:${category ?? ''}:${bugType ?? ''}`;
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  /**
   * Save a bug, skipping (and returning the existing record) if an identical
   * bug (same page, category and type) was already recorded for this session.
   */
  async addBug(sessionId: string, bug: {
    projectId?: string;
    title: string;
    description?: string;
    severity?: string;
    category?: string;
    bugType?: string;
    pageUrl?: string;
    reproductionSteps?: any[];
    evidenceScreenshots?: any[];
    rootCause?: string;
    suggestedFix?: string;
    iterationFound?: number;
    videoPath?: string;
  }): Promise<QALoopBug> {
    // 🔴 Fix: Fingerprint-based deduplication — same page + category + bug_type = duplicate
    const fingerprint = this.computeBugFingerprint(
      sessionId,
      bug.pageUrl,
      bug.category,
      bug.bugType
    );

    const dupCheck = await this.pool.query<{ id: string }>(`
      SELECT id FROM qa_loop_bugs
      WHERE session_id = $1
        AND (page_url  IS NOT DISTINCT FROM $2)
        AND (category  IS NOT DISTINCT FROM $3)
        AND (bug_type  IS NOT DISTINCT FROM $4)
      LIMIT 1
    `, [
      sessionId,
      bug.pageUrl  ?? null,
      bug.category ?? null,
      bug.bugType  ?? null
    ]);

    if (dupCheck.rows.length > 0) {
      logger.debug('Duplicate bug skipped (fingerprint match)', {
        sessionId,
        fingerprint,
        title: bug.title,
        existingId: dupCheck.rows[0].id
      });
      const existing = await this.pool.query<QALoopBug>(
        'SELECT * FROM qa_loop_bugs WHERE id = $1',
        [dupCheck.rows[0].id]
      );
      return existing.rows[0];
    }

    const id = uuidv4();
    const query = `
      INSERT INTO qa_loop_bugs (
        id, session_id, project_id, title, description, severity,
        category, bug_type, page_url, reproduction_steps, evidence_screenshots,
        root_cause, suggested_fix, iteration_found, video_path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      id,
      sessionId,
      bug.projectId || null,
      bug.title,
      bug.description || null,
      bug.severity || 'medium',
      bug.category || null,
      bug.bugType || null,
      bug.pageUrl || null,
      JSON.stringify(bug.reproductionSteps || []),
      JSON.stringify(bug.evidenceScreenshots || []),
      bug.rootCause || null,
      bug.suggestedFix || null,
      bug.iterationFound || null,
      bug.videoPath || null
    ]);

    logger.info('Added bug', { sessionId, bugId: id, title: bug.title, severity: bug.severity });
    return result.rows[0];
  }

  async getBugs(sessionId: string, options?: { status?: string; severity?: string }): Promise<QALoopBug[]> {
    let query = 'SELECT * FROM qa_loop_bugs WHERE session_id = $1';
    const params: any[] = [sessionId];
    let paramIndex = 2;

    if (options?.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(options.status);
    }
    if (options?.severity) {
      query += ` AND severity = $${paramIndex++}`;
      params.push(options.severity);
    }

    query += ' ORDER BY CASE severity WHEN \'critical\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END, created_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // Note methods
  async addNote(sessionId: string, note: {
    note: string;
    category?: string;
    iterationNumber?: number;
    pageUrl?: string;
  }): Promise<QALoopNote> {
    const id = uuidv4();
    const query = `
      INSERT INTO qa_loop_notes (id, session_id, note, category, iteration_number, page_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      id,
      sessionId,
      note.note,
      note.category || 'general',
      note.iterationNumber || null,
      note.pageUrl || null
    ]);

    return result.rows[0];
  }

  async getNotes(sessionId: string, options?: { category?: string; resolved?: boolean }): Promise<QALoopNote[]> {
    let query = 'SELECT * FROM qa_loop_notes WHERE session_id = $1';
    const params: any[] = [sessionId];
    let paramIndex = 2;

    if (options?.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(options.category);
    }
    if (options?.resolved !== undefined) {
      query += ` AND is_resolved = $${paramIndex++}`;
      params.push(options.resolved);
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  // Test run methods
  async addTestRun(sessionId: string, testCaseId: string, result: {
    status: string;
    durationMs?: number;
    stepsTotal?: number;
    stepsCompleted?: number;
    failureStepIndex?: number;
    failureReason?: string;
    failureType?: string;
    screenshots?: any[];
    selfHealed?: boolean;
    healedSelectors?: any[];
    observedResult?: string;
    isMismatch?: boolean;
  }): Promise<QALoopTestRun> {
    const id = uuidv4();
    const query = `
      INSERT INTO qa_loop_test_runs (
        id, session_id, test_case_id, status, duration_ms,
        steps_total, steps_completed, failure_step_index, failure_reason,
        failure_type, screenshots, self_healed, healed_selectors,
        observed_result, is_mismatch
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const dbResult = await this.pool.query(query, [
      id,
      sessionId,
      testCaseId,
      result.status,
      result.durationMs || null,
      result.stepsTotal || 0,
      result.stepsCompleted || 0,
      result.failureStepIndex || null,
      result.failureReason || null,
      result.failureType || null,
      JSON.stringify(result.screenshots || []),
      result.selfHealed || false,
      JSON.stringify(result.healedSelectors || []),
      result.observedResult || null,
      result.isMismatch || false
    ]);

    // Update test case with last run info
    await this.updateTestCaseLastRun(testCaseId, result.status, result.durationMs);

    // When a test case fails, mark linked bugs as 'confirmed' (verified by test execution)
    if (result.status === 'failed' || result.status === 'error') {
      try {
        await this.pool.query(
          `UPDATE qa_loop_bugs SET status = 'confirmed', verified_at = CURRENT_TIMESTAMP
           WHERE (discovered_by_test_case_id = $1 OR regression_test_id = $1)
             AND status = 'open'`,
          [testCaseId]
        );
      } catch (err: any) {
        logger.warn('Failed to confirm bugs from test failure', { testCaseId, error: err.message });
      }
    }

    return dbResult.rows[0];
  }

  async getTestRuns(sessionId: string): Promise<QALoopTestRun[]> {
    const query = `
      SELECT tr.*, tc.name as test_case_name
      FROM qa_loop_test_runs tr
      JOIN qa_loop_test_cases tc ON tr.test_case_id = tc.id
      WHERE tr.session_id = $1
      ORDER BY tr.executed_at DESC
    `;
    const result = await this.pool.query(query, [sessionId]);
    return result.rows;
  }

  // Iteration tracking (enhanced for Phase 6 & 8)
  async addIteration(sessionId: string, iteration: {
    iterationNumber: number;
    focusArea?: string;
    pagesExplored?: number;
    testsGenerated?: number;
    bugsFound?: number;
    toolCalls?: number;
    tokensUsed?: number;
    costUsd?: number;
    durationMs?: number;
    completionReason?: string;
    errorMessage?: string;
    // Phase 6 & 8: Model and cost tracking
    modelUsed?: string;
    inputTokens?: number;
    outputTokens?: number;
    costCents?: number;
  }): Promise<void> {
    const id = uuidv4();
    const query = `
      INSERT INTO qa_loop_iterations (
        id, session_id, iteration_number, focus_area, pages_explored,
        tests_generated, bugs_found, tool_calls, tokens_used, cost_usd,
        duration_ms, completion_reason, error_message, started_at, completed_at,
        model_used, input_tokens, output_tokens, cost_cents
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $14, $15, $16, $17)
    `;

    await this.pool.query(query, [
      id,
      sessionId,
      iteration.iterationNumber,
      iteration.focusArea || null,
      iteration.pagesExplored || 0,
      iteration.testsGenerated || 0,
      iteration.bugsFound || 0,
      iteration.toolCalls || 0,
      iteration.tokensUsed || 0,
      iteration.costUsd || 0,
      iteration.durationMs || null,
      iteration.completionReason || null,
      iteration.errorMessage || null,
      iteration.modelUsed || null,
      iteration.inputTokens || 0,
      iteration.outputTokens || 0,
      iteration.costCents || 0
    ]);
  }

  // ==================== DOCUMENT METHODS (Phase 7) ====================

  async addDocument(sessionId: string, document: {
    filename: string;
    fileType: string;
    fileSizeBytes: number;
    content: string;
    summary: string;
    chunkCount: number;
  }): Promise<QALoopDocument> {
    const id = uuidv4();
    const query = `
      INSERT INTO qa_loop_documents (
        id, session_id, filename, file_type, file_size_bytes,
        content, summary, chunk_count, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      id,
      sessionId,
      document.filename,
      document.fileType,
      document.fileSizeBytes,
      document.content,
      document.summary,
      document.chunkCount
    ]);

    logger.info('Added document', { sessionId, documentId: id, filename: document.filename });
    return result.rows[0];
  }

  async getDocuments(sessionId: string, options?: { activeOnly?: boolean }): Promise<QALoopDocument[]> {
    let query = 'SELECT * FROM qa_loop_documents WHERE session_id = $1';
    const params: any[] = [sessionId];

    if (options?.activeOnly) {
      query += ' AND is_active = true';
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getDocument(documentId: string): Promise<QALoopDocument | null> {
    const query = 'SELECT * FROM qa_loop_documents WHERE id = $1';
    const result = await this.pool.query(query, [documentId]);
    return result.rows[0] || null;
  }

  async updateDocument(documentId: string, updates: { isActive?: boolean }): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [documentId];
    let paramIndex = 2;

    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(updates.isActive);
    }

    if (setClauses.length === 0) return;

    const query = `UPDATE qa_loop_documents SET ${setClauses.join(', ')} WHERE id = $1`;
    await this.pool.query(query, params);
  }

  async deleteDocument(documentId: string): Promise<void> {
    const query = 'DELETE FROM qa_loop_documents WHERE id = $1';
    await this.pool.query(query, [documentId]);
  }

  // ==================== TEST RUN HISTORY (Phase 2A) ====================

  async getTestRunsForCase(testCaseId: string): Promise<any[]> {
    const query = `
      SELECT * FROM qa_loop_test_runs
      WHERE test_case_id = $1
      ORDER BY executed_at DESC
    `;
    const result = await this.pool.query(query, [testCaseId]);
    return result.rows;
  }

  // ==================== ROOT CAUSE ANALYSIS (Phase 2B) ====================

  async saveRootCauseAnalysis(sessionId: string, failureId: string, analysis: {
    category: string;
    subCategory?: string;
    confidence: number;
    rootCause: string;
    hypothesis?: string;
    consoleErrors?: any[];
    networkIssues?: any[];
    minimalSteps?: string[];
    environmentFactors?: string[];
    fixSuggestion?: string;
    preventionSuggestion?: string;
    testImprovement?: string;
  }): Promise<void> {
    const id = uuidv4();
    const query = `
      INSERT INTO qa_loop_root_cause_analysis (
        id, session_id, failure_id, failure_type,
        category, sub_category, confidence, root_cause, hypothesis,
        console_errors, network_issues, minimal_steps, environment_factors,
        fix_suggestion, prevention_suggestion, test_improvement
      ) VALUES ($1,$2,$3,'test_failure',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `;
    await this.pool.query(query, [
      id, sessionId, failureId,
      analysis.category, analysis.subCategory || null, analysis.confidence,
      analysis.rootCause, analysis.hypothesis || null,
      JSON.stringify(analysis.consoleErrors || []),
      JSON.stringify(analysis.networkIssues || []),
      JSON.stringify(analysis.minimalSteps || []),
      JSON.stringify(analysis.environmentFactors || []),
      analysis.fixSuggestion || null,
      analysis.preventionSuggestion || null,
      analysis.testImprovement || null
    ]);
  }

  // ==================== CHAOS RESULTS (Phase 3D) ====================

  async saveChaosResult(sessionId: string, result: {
    pageUrl: string;
    elementSelector?: string;
    elementType?: string;
    attackCategory: string;
    attackName: string;
    payloadUsed?: string;
    resultStatus: string;
    vulnerabilityConfirmed: boolean;
    severity?: string;
    confidence: number;
    reproductionSteps?: string[];
    errorMessage?: string;
  }): Promise<void> {
    const id = uuidv4();
    const query = `
      INSERT INTO qa_loop_chaos_results (
        id, session_id, page_url, element_selector, element_type,
        attack_category, attack_name, payload_used,
        result, vulnerability_confirmed,
        severity, confidence, reproduction_steps, error_message
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `;
    await this.pool.query(query, [
      id, sessionId,
      result.pageUrl, result.elementSelector || null, result.elementType || null,
      result.attackCategory, result.attackName, result.payloadUsed || null,
      result.resultStatus, result.vulnerabilityConfirmed,
      result.severity || null, result.confidence,
      JSON.stringify(result.reproductionSteps || []),
      result.errorMessage || null
    ]);
  }

  /**
   * Auto-create a test suite from a completed QA Loop session.
   * Creates a test_suite under the project's first user_story (or a default one),
   * then links all qa_loop_test_cases to it.
   * Returns the created test_suite ID.
   */
  async createTestSuiteFromSession(sessionId: string): Promise<string | null> {
    const session = await this.getSession(sessionId);
    if (!session || !session.project_id) {
      logger.warn('Cannot create test suite: session not found or no project', { sessionId });
      return null;
    }

    const projectId = session.project_id;
    const targetUrl = session.target_url;
    const date = new Date().toISOString().split('T')[0];
    const suiteName = `QA Scan — ${date} — ${targetUrl}`;

    try {
      // Find or create a user story for QA-generated suites
      let userStoryResult = await this.pool.query(
        `SELECT id FROM user_stories WHERE project_id = $1 AND story LIKE 'QA Loop Auto-Generated%' LIMIT 1`,
        [projectId]
      );

      let userStoryId: string;
      if (userStoryResult.rows.length > 0) {
        userStoryId = userStoryResult.rows[0].id;
      } else {
        // Create a placeholder user story for QA-generated content
        const usResult = await this.pool.query(
          `INSERT INTO user_stories (id, project_id, story, website_url, workspace_id)
           VALUES (gen_random_uuid(), $1, $2, $3, $4)
           RETURNING id`,
          [projectId, 'QA Loop Auto-Generated Tests', targetUrl, session.workspace_id || null]
        );
        userStoryId = usResult.rows[0].id;
      }

      // Create the test suite
      const suiteResult = await this.pool.query(
        `INSERT INTO test_suites (id, user_story_id, name, description)
         VALUES (gen_random_uuid(), $1, $2, $3)
         RETURNING id`,
        [userStoryId, suiteName, `Auto-generated from QA Loop session ${sessionId}`]
      );
      const testSuiteId = suiteResult.rows[0].id;

      // Link the session to this test suite
      await this.pool.query(
        `UPDATE qa_loop_sessions SET test_suite_id = $2 WHERE id = $1`,
        [sessionId, testSuiteId]
      );

      // Link all QA-generated test cases to this suite
      await this.pool.query(
        `UPDATE qa_loop_test_cases SET test_suite_id = $2 WHERE session_id = $1`,
        [sessionId, testSuiteId]
      );

      // Sync QA Loop test cases into the standard test_cases table
      // so Architecture Flow (which reads from test_cases) can display them.
      await this.pool.query(
        `INSERT INTO test_cases (id, name, description, website_url, user_story, steps, metadata, test_suite_id, user_story_id, workspace_id, playwright_code, created_at, updated_at)
         SELECT
           gen_random_uuid(),
           q.name,
           COALESCE(q.description, ''),
           $3,
           'QA Loop Auto-Generated Tests',
           q.steps,
           jsonb_build_object(
             'source', 'qa_loop',
             'session_id', q.session_id::text,
             'category', q.category,
             'risk_level', q.risk_level,
             'last_run_status', q.last_run_status,
             'confidence_score', q.confidence_score
           ),
           $2,
           $4,
           $5,
           q.playwright_code,
           q.created_at,
           q.updated_at
         FROM qa_loop_test_cases q
         WHERE q.session_id = $1
         RETURNING id, name`,
        [sessionId, testSuiteId, targetUrl, userStoryId, session.workspace_id || '00000000-0000-0000-0000-000000000000']
      ).then(async (insertResult) => {
        // Link each standard test_case back to its qa_loop_test_case via standard_test_case_id
        // Match by name since we just inserted them
        if (insertResult.rows.length > 0) {
          const standardIds = insertResult.rows.map((r: any) => r.id);
          await this.pool.query(
            `UPDATE qa_loop_test_cases ql
             SET standard_test_case_id = tc.id
             FROM (
               SELECT id, name FROM test_cases WHERE id = ANY($1::uuid[])
             ) tc
             WHERE ql.session_id = $2 AND ql.name = tc.name AND ql.standard_test_case_id IS NULL`,
            [standardIds, sessionId]
          );
        }
      });

      // Count linked items
      const countResult = await this.pool.query(
        `SELECT
           (SELECT COUNT(*) FROM qa_loop_test_cases WHERE session_id = $1) as test_count,
           (SELECT COUNT(*) FROM qa_loop_bugs WHERE session_id = $1) as bug_count`,
        [sessionId]
      );
      const { test_count, bug_count } = countResult.rows[0];

      logger.info('Auto-created test suite from QA session', {
        sessionId,
        testSuiteId,
        projectId,
        testCount: test_count,
        bugCount: bug_count
      });

      return testSuiteId;
    } catch (err: any) {
      // Log the full error with stack trace so failures are visible in logs
      logger.error('Failed to create test suite from session', {
        sessionId,
        error: err.message || err,
        stack: err.stack,
        code: err.code,
        detail: err.detail,    // PostgreSQL error detail
        constraint: err.constraint,
        table: err.table,
      });
      // Re-throw so callers can handle or log the failure instead of silently losing data
      throw err;
    }
  }

  /**
   * Update the project's persistent context after a QA session completes.
   * Merges new data: discovered pages, found bugs, test coverage, scan history.
   */
  async updateProjectContextFromSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session || !session.project_id) {
      logger.warn('Cannot update project context: no project linked', { sessionId });
      return;
    }

    const projectId = session.project_id;

    try {
      // Gather session data
      const [pagesResult, bugsResult, testsResult] = await Promise.all([
        this.pool.query(`SELECT url, is_explored FROM qa_loop_pages WHERE session_id = $1`, [sessionId]),
        this.pool.query(`SELECT id, title, severity, status, page_url, category FROM qa_loop_bugs WHERE session_id = $1`, [sessionId]),
        this.pool.query(`SELECT id, name, category, last_run_status, source_page_url FROM qa_loop_test_cases WHERE session_id = $1`, [sessionId]),
      ]);

      const discoveredPages = pagesResult.rows.map((r: any) => ({
        url: r.url,
        explored: r.is_explored,
      }));
      const bugs = bugsResult.rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        severity: r.severity,
        status: r.status,
        page_url: r.page_url,
        category: r.category,
      }));
      const testCoverage = testsResult.rows.map((r: any) => ({
        name: r.name,
        category: r.category,
        status: r.last_run_status,
        page_url: r.source_page_url,
      }));

      // Read current context
      const contextResult = await this.pool.query(
        `SELECT context FROM projects WHERE id = $1`,
        [projectId]
      );
      const currentContext = contextResult.rows[0]?.context || {};

      // Merge known pages (dedupe by URL)
      const existingPages: Record<string, any> = {};
      for (const p of (currentContext.known_pages || [])) {
        existingPages[p.url] = p;
      }
      for (const p of discoveredPages) {
        existingPages[p.url] = { ...existingPages[p.url], ...p };
      }

      // Merge known bugs (dedupe by title)
      const existingBugs: Record<string, any> = {};
      for (const b of (currentContext.known_bugs || [])) {
        existingBugs[b.title] = b;
      }
      for (const b of bugs) {
        existingBugs[b.title] = b;
      }

      // Add scan to history
      const scanHistory = currentContext.scan_history || [];
      scanHistory.push({
        session_id: sessionId,
        target_url: session.target_url,
        completed_at: new Date().toISOString(),
        pages_found: discoveredPages.length,
        bugs_found: bugs.length,
        tests_generated: testCoverage.length,
        status: session.status,
      });

      // Build merged context
      const mergedContext = {
        known_pages: Object.values(existingPages),
        known_bugs: Object.values(existingBugs),
        test_coverage: testCoverage,
        scan_history: scanHistory.slice(-20), // Keep last 20 scans
        last_scan_at: new Date().toISOString(),
        total_scans: (currentContext.total_scans || 0) + 1,
        app_info: currentContext.app_info || {},
      };

      // Write merged context back
      await this.pool.query(
        `UPDATE projects SET context = $2, updated_at = NOW() WHERE id = $1`,
        [projectId, JSON.stringify(mergedContext)]
      );

      logger.info('Updated project context from session', {
        sessionId,
        projectId,
        pagesCount: Object.keys(existingPages).length,
        bugsCount: Object.keys(existingBugs).length,
        testsCount: testCoverage.length,
      });
    } catch (err: any) {
      logger.error('Failed to update project context', {
        sessionId,
        projectId,
        error: err.message,
        stack: err.stack,
      });
      // Non-fatal — don't throw, let session completion proceed
    }
  }

  /**
   * Get project context for injection into Claude's prompt.
   */
  async getProjectContext(projectId: string): Promise<{ context: any; userPrd: string }> {
    const result = await this.pool.query(
      `SELECT context, user_prd FROM projects WHERE id = $1`,
      [projectId]
    );
    if (result.rows.length === 0) {
      return { context: {}, userPrd: '' };
    }
    return {
      context: result.rows[0].context || {},
      userPrd: result.rows[0].user_prd || '',
    };
  }
}

// Document interface
export interface QALoopDocument {
  id: string;
  session_id: string;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  content: string | null;
  summary: string | null;
  chunk_count: number;
  is_active: boolean;
  created_at: Date;
}
