import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../../shared/logger/logger';
import { QALoopRepository } from '../repositories/qa-loop-repository';
import { LoopOrchestrator } from '../loop-orchestrator';
import { MCPBrowser } from '../mcp-browser';
import { RetestExecutor } from '../retest-executor';
import webhookRoutes from './webhook';
import { generateWsToken } from './websocket';
import { parseDocument, combineDocuments, ParsedDocument } from '../document-parser';

const router = Router();
const logger = createLogger('qa-loop-routes');
const qaLoopRepository = new QALoopRepository();

// Active sessions map for managing running loops
const activeSessions = new Map<string, LoopOrchestrator>();

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'qa-loop-executor',
    activeSessions: activeSessions.size
  });
});

// Start a new QA Loop session
router.post('/api/sessions', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;
    const {
      projectId,
      workspace_id: bodyWorkspaceId,
      targetUrl,
      mode = 'explore',
      qualityThreshold = 80,
      maxIterations = 3,
      maxDurationHours = 12,
      documentContext,
      config = {},
      loginCredentials,
      testPriority = 'functional_first',
      sourceSessionId
    } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: 'targetUrl is required' });
    }

    // Prefer header over body, fallback to body field
    const resolvedWorkspaceId = workspaceId || bodyWorkspaceId || undefined;

    // Create session in database with extended config
    const sessionConfig = {
      ...config,
      testPriority,
      hasLoginCredentials: !!loginCredentials
    };

    const session = await qaLoopRepository.createSession({
      projectId,
      workspaceId: resolvedWorkspaceId,
      targetUrl,
      mode,
      qualityThreshold,
      maxIterations,
      maxDurationHours,
      documentContext,
      config: sessionConfig
    });

    // Clone from source session if provided (Phase 3)
    if (sourceSessionId) {
      await qaLoopRepository.cloneSessionData(sourceSessionId, session.id);
      logger.info('Cloned session data from source', { sourceSessionId, newSessionId: session.id });
    }

    logger.info('QA Loop session created', { sessionId: session.id, targetUrl, mode, testPriority });

    // Load project context for knowledge base injection (Feature 9)
    let projectContext: any = undefined;
    let userPrd: string | undefined = undefined;
    if (projectId) {
      try {
        const ctx = await qaLoopRepository.getProjectContext(projectId);
        if (ctx.context && Object.keys(ctx.context).length > 0) {
          projectContext = ctx.context;
        }
        if (ctx.userPrd) {
          userPrd = ctx.userPrd;
        }
        const hasContext = !!projectContext;
        const knownPages = projectContext?.known_pages?.length || 0;
        logger.info('Project context loaded', {
          projectId,
          hasContext,
          knownPages,
          hasUserPrd: !!userPrd,
          knownBugs: projectContext?.known_bugs?.length || 0,
          totalScans: projectContext?.total_scans || 0,
        });
      } catch (err: any) {
        logger.warn('Failed to load project context', { projectId, error: err.message });
      }
    }

    // Start the loop orchestrator
    const orchestrator = new LoopOrchestrator(session.id, {
      targetUrl,
      mode,
      qualityThreshold,
      maxIterations,
      maxDurationHours,
      documentContext,
      config: sessionConfig,
      loginCredentials,
      testPriority,
      workspaceId: resolvedWorkspaceId,
      projectContext,
      userPrd,
    });

    activeSessions.set(session.id, orchestrator);

    // Start exploration asynchronously; clean up the entry if the orchestrator crashes (3.3)
    orchestrator.start().catch(error => {
      logger.error('QA Loop failed', { sessionId: session.id, error: error.message });
      activeSessions.delete(session.id);
    });

    res.status(201).json({
      success: true,
      session: {
        id: session.id,
        targetUrl,
        mode,
        status: 'running',
        qualityThreshold,
        maxIterations
      },
      wsToken: generateWsToken(session.id)
    });
  } catch (error: any) {
    logger.error('Failed to start QA Loop session', { error: error.message });
    res.status(500).json({ error: 'Failed to start QA Loop session', details: error.message });
  }
});

// List all sessions
router.get('/api/sessions', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;
    const { projectId, workspace_id: queryWorkspaceId, status, limit = 20, offset = 0 } = req.query;
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const offsetNum = Math.max(Number(offset) || 0, 0);

    const resolvedWorkspaceId = workspaceId || (queryWorkspaceId as string) || undefined;

    const sessions = await qaLoopRepository.listSessions({
      projectId: projectId as string,
      workspaceId: resolvedWorkspaceId,
      status: status as string,
      limit: limitNum,
      offset: offsetNum
    });

    res.json(sessions);
  } catch (error: any) {
    logger.error('Failed to list sessions', { error: error.message, stack: error.stack });
    res.status(500).json({
      error: 'Failed to list sessions',
      details: error.message || String(error)
    });
  }
});

// Check for existing session by base URL (Phase 3)
router.get('/api/sessions/check-existing', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;
    const { baseUrl, workspace_id: queryWorkspaceId } = req.query;

    if (!baseUrl || typeof baseUrl !== 'string') {
      return res.status(400).json({ error: 'baseUrl query parameter is required' });
    }

    const resolvedWorkspaceId = workspaceId || (queryWorkspaceId as string) || undefined;

    // Normalize to get origin (protocol + host)
    let normalizedUrl: string;
    try {
      normalizedUrl = new URL(baseUrl).origin;
    } catch {
      normalizedUrl = baseUrl; // Use as-is if not a valid URL
    }

    const existing = await qaLoopRepository.findLatestCompletedByBaseUrl(normalizedUrl, resolvedWorkspaceId);

    if (existing) {
      res.json({
        exists: true,
        session: {
          id: existing.id,
          testCaseCount: existing.tests_generated,
          bugsFound: existing.bugs_found,
          completedAt: existing.completed_at
        }
      });
    } else {
      res.json({ exists: false });
    }
  } catch (error: any) {
    logger.error('Failed to check existing session', { error: error.message });
    res.status(500).json({ error: 'Failed to check existing session' });
  }
});

// Get session details
router.get('/api/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;
    const session = await qaLoopRepository.getSession(id, workspaceId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get related data
    const [pages, testCases, bugs, notes] = await Promise.all([
      qaLoopRepository.getPages(id),
      qaLoopRepository.getTestCases(id),
      qaLoopRepository.getBugs(id),
      qaLoopRepository.getNotes(id)
    ]);

    res.json({
      session,
      pages,
      testCases,
      bugs,
      notes,
      isActive: activeSessions.has(id)
    });
  } catch (error: any) {
    logger.error('Failed to get session', { error: error.message });
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Pause session
router.post('/api/sessions/:id/pause', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orchestrator = activeSessions.get(id);

    if (!orchestrator) {
      return res.status(404).json({ error: 'Session not active' });
    }

    await orchestrator.pause();
    await qaLoopRepository.updateSessionStatus(id, 'paused');

    // Auto-create test suite from whatever was discovered before the pause
    const testSuiteId = await qaLoopRepository.createTestSuiteFromSession(id).catch((err) => {
      logger.error('Failed to create test suite on pause', { sessionId: id, error: err.message });
      return null;
    });
    if (testSuiteId) {
      const testCases = await qaLoopRepository.getTestCases(id).catch(() => []);
      logger.info(`Test suite created with ${testCases.length} test cases`, { sessionId: id, testSuiteId });
    }

    // Update project context with discoveries from this session
    await qaLoopRepository.updateProjectContextFromSession(id).catch((err) => {
      logger.warn('Failed to update project context on pause', { sessionId: id, error: err.message });
    });

    logger.info('QA Loop session paused', { sessionId: id });
    res.json({ success: true, status: 'paused' });
  } catch (error: any) {
    logger.error('Failed to pause session', { error: error.message });
    res.status(500).json({ error: 'Failed to pause session' });
  }
});

// Resume session
router.post('/api/sessions/:id/resume', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orchestrator = activeSessions.get(id);

    if (!orchestrator) {
      // Try to recreate orchestrator from saved state
      const session = await qaLoopRepository.getSession(id);
      if (!session || session.status !== 'paused') {
        return res.status(404).json({ error: 'Session not found or not paused' });
      }

      // loginCredentials can be optionally re-supplied in the resume body so the
      // orchestrator can re-establish the browser session without re-testing auth.
      const { loginCredentials } = req.body || {};

      const newOrchestrator = new LoopOrchestrator(id, {
        targetUrl: session.target_url,
        mode: session.mode,
        qualityThreshold: session.quality_threshold,
        maxIterations: session.max_iterations,
        maxDurationHours: session.max_duration_hours,
        documentContext: session.document_context,
        config: session.config,
        testPriority: session.config?.testPriority,
        // Resume-specific flags
        isResume: true,
        resumeFromIteration: session.iteration_count || 0,
        // Re-inject login credentials if the client supplies them (needed to
        // re-login after the browser context was destroyed)
        ...(loginCredentials ? { loginCredentials } : {}),
        workspaceId: session.workspace_id || undefined,
      });

      activeSessions.set(id, newOrchestrator);
      newOrchestrator.start().catch(error => {
        logger.error('QA Loop resume failed', { sessionId: id, error: error.message });
        activeSessions.delete(id);
      });

      logger.info('QA Loop session resumed from paused state', {
        sessionId: id,
        resumeFromIteration: session.iteration_count,
        hasLoginCredentials: !!loginCredentials
      });
    } else {
      await orchestrator.resume();
    }

    await qaLoopRepository.updateSessionStatus(id, 'running');

    logger.info('QA Loop session resumed', { sessionId: id });
    res.json({ success: true, status: 'running', wsToken: generateWsToken(id) });
  } catch (error: any) {
    logger.error('Failed to resume session', { error: error.message });
    res.status(500).json({ error: 'Failed to resume session' });
  }
});

// Stop session
router.post('/api/sessions/:id/stop', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orchestrator = activeSessions.get(id);

    if (orchestrator) {
      try {
        await orchestrator.stop();
      } catch (stopErr: any) {
        logger.warn('Orchestrator stop threw, cleaning up anyway', {
          sessionId: id,
          error: stopErr.message
        });
      }
      activeSessions.delete(id);
    }

    // Force-cleanup any lingering browser processes for this session
    // (belt-and-suspenders — orchestrator.stop() should have done this already)
    await MCPBrowser.forceCleanup(id).catch(() => {});

    await qaLoopRepository.updateSessionStatus(id, 'cancelled');
    // Auto-create test suite from whatever was discovered before the stop
    await qaLoopRepository.createTestSuiteFromSession(id).catch((err) => {
      logger.warn('Failed to create test suite on stop', { sessionId: id, error: err.message });
    });

    // Update project context with discoveries from this session
    await qaLoopRepository.updateProjectContextFromSession(id).catch((err) => {
      logger.warn('Failed to update project context on stop', { sessionId: id, error: err.message });
    });

    logger.info('QA Loop session stopped', { sessionId: id });
    res.json({ success: true, status: 'cancelled' });
  } catch (error: any) {
    logger.error('Failed to stop session', { error: error.message });
    res.status(500).json({ error: 'Failed to stop session' });
  }
});

// Run retest
router.post('/api/sessions/:id/retest', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { mode = 'quick' } = req.body;

    const session = await qaLoopRepository.getSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Create a new retest session
    const retestSession = await qaLoopRepository.createSession({
      projectId: session.project_id,
      targetUrl: session.target_url,
      mode: mode === 'smart' ? 'smart_retest' : 'retest',
      qualityThreshold: session.quality_threshold,
      maxIterations: 1, // Retest is single pass
      documentContext: session.document_context,
      config: { ...session.config, sourceSessionId: id }
    });

    // Start retest executor
    const retestExecutor = new RetestExecutor(retestSession.id, id, mode);

    retestExecutor.run().then(async (results) => {
      await qaLoopRepository.updateSessionStatus(retestSession.id, 'completed');
      await qaLoopRepository.createTestSuiteFromSession(retestSession.id).catch((err: any) => {
        logger.error('Failed to create test suite from retest', { sessionId: retestSession.id, error: err.message });
      });
      logger.info('Retest completed', { sessionId: retestSession.id, results });
    }).catch(async (error) => {
      await qaLoopRepository.updateSessionStatus(retestSession.id, 'failed');
      logger.error('Retest failed', { sessionId: retestSession.id, error: error.message });
    });

    res.status(201).json({
      success: true,
      retestSessionId: retestSession.id,
      mode,
      status: 'running'
    });
  } catch (error: any) {
    logger.error('Failed to start retest', { error: error.message });
    res.status(500).json({ error: 'Failed to start retest' });
  }
});

// Retest a single bug's test case
router.post('/api/bugs/:bugId/retest', async (req: Request, res: Response) => {
  try {
    const { bugId } = req.params;

    // Look up the bug to find its session and linked test case
    const pool = (qaLoopRepository as any).pool;
    const bugResult = await pool.query(
      `SELECT b.*, b.regression_test_id, b.discovered_by_test_case_id
       FROM qa_loop_bugs b WHERE b.id = $1`,
      [bugId]
    );
    if (bugResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bug not found' });
    }
    const bug = bugResult.rows[0];
    const testCaseId = bug.discovered_by_test_case_id || bug.regression_test_id;

    if (!testCaseId) {
      return res.status(400).json({ error: 'Bug has no linked test case to retest' });
    }

    const testCase = await qaLoopRepository.getTestCaseById(testCaseId);
    if (!testCase) {
      return res.status(404).json({ error: 'Linked test case not found' });
    }

    // Create a mini retest session
    const session = await qaLoopRepository.getSession(bug.session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const retestSession = await qaLoopRepository.createSession({
      projectId: session.project_id || undefined,
      targetUrl: session.target_url,
      mode: 'retest',
      qualityThreshold: 80,
      maxIterations: 1,
      config: { sourceSessionId: bug.session_id, singleBugRetest: true, bugId }
    });

    // Clone just this one test case into the new session (including playwright_code)
    await pool.query(
      `INSERT INTO qa_loop_test_cases (id, session_id, project_id, name, description, category, priority, risk_level, steps, selectors, source, source_page_url, playwright_code)
       SELECT gen_random_uuid(), $2, project_id, name, description, category, priority, risk_level, steps, selectors, 'retest', source_page_url, playwright_code
       FROM qa_loop_test_cases WHERE id = $1`,
      [testCaseId, retestSession.id]
    );

    // Run the retest executor for this single test
    const retestExecutor = new RetestExecutor(retestSession.id, bug.session_id, 'quick');
    retestExecutor.run().then(async (results) => {
      await qaLoopRepository.updateSessionStatus(retestSession.id, 'completed');

      // Check the test run result to update the bug status
      const testRuns = await qaLoopRepository.getTestRuns(retestSession.id);
      const passed = testRuns.length > 0 && testRuns.every((r: any) => r.status === 'passed');
      if (passed) {
        await pool.query(
          `UPDATE qa_loop_bugs SET status = 'fixed', verified_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [bugId]
        );
      } else {
        await pool.query(
          `UPDATE qa_loop_bugs SET status = 'confirmed' WHERE id = $1 AND status = 'open'`,
          [bugId]
        );
      }
      logger.info('Bug retest completed', { bugId, retestSessionId: retestSession.id, passed });
    }).catch(async (error) => {
      await qaLoopRepository.updateSessionStatus(retestSession.id, 'failed');
      logger.error('Bug retest failed', { bugId, error: error.message });
    });

    res.status(201).json({
      success: true,
      retestSessionId: retestSession.id,
      testCaseId,
      status: 'running'
    });
  } catch (error: any) {
    logger.error('Failed to retest bug', { error: error.message });
    res.status(500).json({ error: 'Failed to retest bug' });
  }
});

// Get project test suite hierarchy: suites > test cases > bugs
router.get('/api/projects/:projectId/test-suite-hierarchy', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const pool = (qaLoopRepository as any).pool;

    // Get all QA sessions that have a test_suite_id for this project
    const sessionsResult = await pool.query(
      `SELECT s.id, s.target_url, s.status, s.test_suite_id, s.quality_score,
              s.tests_generated, s.bugs_found, s.created_at, s.completed_at,
              ts.name as suite_name, ts.description as suite_description
       FROM qa_loop_sessions s
       LEFT JOIN test_suites ts ON s.test_suite_id = ts.id
       WHERE s.project_id = $1 AND s.test_suite_id IS NOT NULL
       ORDER BY s.created_at DESC`,
      [projectId]
    );

    const suites = [];
    for (const session of sessionsResult.rows) {
      // Get test cases for this session's suite
      const testCasesResult = await pool.query(
        `SELECT id, name, description, category, priority, risk_level, steps,
                last_run_status, last_run_at, pass_count, fail_count, source, created_at
         FROM qa_loop_test_cases
         WHERE test_suite_id = $1
         ORDER BY priority DESC, created_at ASC`,
        [session.test_suite_id]
      );

      // Get bugs for this session
      const bugsResult = await pool.query(
        `SELECT id, title, description, severity, category, bug_type, page_url,
                reproduction_steps, evidence_screenshots, status, root_cause,
                suggested_fix, video_path, regression_test_id, discovered_by_test_case_id,
                created_at
         FROM qa_loop_bugs
         WHERE session_id = $1
         ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at DESC`,
        [session.id]
      );

      // Group bugs by their linked test case
      const bugsByTestCase = new Map<string, any[]>();
      const unlinkedBugs: any[] = [];
      for (const bug of bugsResult.rows) {
        const tcId = bug.discovered_by_test_case_id || bug.regression_test_id;
        if (tcId) {
          if (!bugsByTestCase.has(tcId)) bugsByTestCase.set(tcId, []);
          bugsByTestCase.get(tcId)!.push(bug);
        } else {
          unlinkedBugs.push(bug);
        }
      }

      // Attach bugs to test cases
      const testCasesWithBugs = testCasesResult.rows.map((tc: any) => ({
        ...tc,
        bugs: bugsByTestCase.get(tc.id) || []
      }));

      suites.push({
        id: session.test_suite_id,
        session_id: session.id,
        name: session.suite_name,
        description: session.suite_description,
        target_url: session.target_url,
        status: session.status,
        quality_score: session.quality_score,
        tests_generated: session.tests_generated,
        bugs_found: session.bugs_found,
        created_at: session.created_at,
        completed_at: session.completed_at,
        is_qa_generated: true,
        test_cases: testCasesWithBugs,
        unlinked_bugs: unlinkedBugs,
      });
    }

    res.json({ suites });
  } catch (error: any) {
    logger.error('Failed to get project test suite hierarchy', { error: error.message });
    res.status(500).json({ error: 'Failed to get project test suite hierarchy' });
  }
});

// Get test cases for a session
router.get('/api/sessions/:id/test-cases', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const testCases = await qaLoopRepository.getTestCases(id);
    res.json({ testCases });
  } catch (error: any) {
    logger.error('Failed to get test cases', { error: error.message });
    res.status(500).json({ error: 'Failed to get test cases' });
  }
});

// Get bugs for a session
router.get('/api/sessions/:id/bugs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bugs = await qaLoopRepository.getBugs(id);
    res.json({ bugs });
  } catch (error: any) {
    logger.error('Failed to get bugs', { error: error.message });
    res.status(500).json({ error: 'Failed to get bugs' });
  }
});

// Get explored pages for a session
router.get('/api/sessions/:id/pages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pages = await qaLoopRepository.getPages(id);
    res.json({ pages });
  } catch (error: any) {
    logger.error('Failed to get pages', { error: error.message });
    res.status(500).json({ error: 'Failed to get pages' });
  }
});

// Get test run results
router.get('/api/sessions/:id/test-runs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const testRuns = await qaLoopRepository.getTestRuns(id);
    res.json({ testRuns });
  } catch (error: any) {
    logger.error('Failed to get test runs', { error: error.message });
    res.status(500).json({ error: 'Failed to get test runs' });
  }
});

// ==================== DOCUMENT ENDPOINTS (Phase 7) ====================

// Upload a document to a session
router.post('/api/sessions/:id/documents', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;
    const { filename, content, contentBase64 } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }

    if (!content && !contentBase64) {
      return res.status(400).json({ error: 'content or contentBase64 is required' });
    }

    // Verify session exists and belongs to this workspace
    const session = await qaLoopRepository.getSession(id, workspaceId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Pass raw Buffer so binary files (PDFs) are not corrupted by
    // a lossy .toString('utf-8') conversion — parseDocument accepts Buffer (5.7)
    let documentContent: string | Buffer;
    if (contentBase64) {
      documentContent = Buffer.from(contentBase64, 'base64');
    } else {
      documentContent = content as string;
    }

    // Parse the document
    const parsedDoc = await parseDocument(filename, documentContent);

    // Save to database
    const document = await qaLoopRepository.addDocument(id, {
      filename: parsedDoc.filename,
      fileType: parsedDoc.fileType,
      fileSizeBytes: parsedDoc.fileSizeBytes,
      content: parsedDoc.content,
      summary: parsedDoc.summary,
      chunkCount: parsedDoc.chunkCount
    });

    logger.info('Document uploaded', {
      sessionId: id,
      documentId: document.id,
      filename,
      fileType: parsedDoc.fileType,
      tokens: parsedDoc.metadata.estimatedTokens
    });

    res.status(201).json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        fileType: document.file_type,
        fileSizeBytes: document.file_size_bytes,
        summary: document.summary,
        chunkCount: document.chunk_count,
        estimatedTokens: parsedDoc.metadata.estimatedTokens,
        createdAt: document.created_at
      }
    });
  } catch (error: any) {
    logger.error('Failed to upload document', { error: error.message });
    res.status(500).json({ error: 'Failed to upload document', details: error.message });
  }
});

// List documents for a session
router.get('/api/sessions/:id/documents', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { activeOnly } = req.query;

    const documents = await qaLoopRepository.getDocuments(id, {
      activeOnly: activeOnly === 'true'
    });

    res.json({
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        fileType: doc.file_type,
        fileSizeBytes: doc.file_size_bytes,
        summary: doc.summary,
        chunkCount: doc.chunk_count,
        isActive: doc.is_active,
        createdAt: doc.created_at
      }))
    });
  } catch (error: any) {
    logger.error('Failed to list documents', { error: error.message });
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// Get combined document context for a session (for system prompt).
// MUST be defined BEFORE /:docId so Express matches the literal "combined" path
// instead of treating it as a docId parameter (3.7).
router.get('/api/sessions/:id/documents/combined', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { maxTokens } = req.query;

    const documents = await qaLoopRepository.getDocuments(id, { activeOnly: true });

    if (documents.length === 0) {
      return res.json({ context: '', documentCount: 0, estimatedTokens: 0 });
    }

    // Convert to ParsedDocument format
    const parsedDocs: ParsedDocument[] = documents.map(doc => ({
      filename: doc.filename,
      fileType: doc.file_type as any,
      fileSizeBytes: doc.file_size_bytes,
      content: doc.content || '',
      summary: doc.summary || '',
      chunks: [],
      chunkCount: doc.chunk_count || 1,
      metadata: {
        headings: [],
        wordCount: (doc.content || '').split(/\s+/).length,
        characterCount: (doc.content || '').length,
        estimatedTokens: Math.ceil((doc.content || '').length / 4),
        hasCodeBlocks: false,
        hasTables: false
      }
    }));

    const combined = combineDocuments(parsedDocs, parseInt(maxTokens as string) || 50000);

    res.json({
      context: combined,
      documentCount: documents.length,
      estimatedTokens: Math.ceil(combined.length / 4)
    });
  } catch (error: any) {
    logger.error('Failed to get combined documents', { error: error.message });
    res.status(500).json({ error: 'Failed to get combined documents' });
  }
});

// Get a specific document
router.get('/api/sessions/:id/documents/:docId', async (req: Request, res: Response) => {
  try {
    const { id, docId } = req.params;
    const { includeContent } = req.query;

    const document = await qaLoopRepository.getDocument(docId);

    if (!document || document.session_id !== id) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const response: any = {
      id: document.id,
      filename: document.filename,
      fileType: document.file_type,
      fileSizeBytes: document.file_size_bytes,
      summary: document.summary,
      chunkCount: document.chunk_count,
      isActive: document.is_active,
      createdAt: document.created_at
    };

    if (includeContent === 'true') {
      response.content = document.content;
    }

    res.json({ document: response });
  } catch (error: any) {
    logger.error('Failed to get document', { error: error.message });
    res.status(500).json({ error: 'Failed to get document' });
  }
});

// Toggle document active state
router.patch('/api/sessions/:id/documents/:docId', async (req: Request, res: Response) => {
  try {
    const { id, docId } = req.params;
    const { isActive } = req.body;

    const document = await qaLoopRepository.getDocument(docId);

    if (!document || document.session_id !== id) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await qaLoopRepository.updateDocument(docId, { isActive });

    logger.info('Document updated', { sessionId: id, documentId: docId, isActive });

    res.json({ success: true, isActive });
  } catch (error: any) {
    logger.error('Failed to update document', { error: error.message });
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete a document
router.delete('/api/sessions/:id/documents/:docId', async (req: Request, res: Response) => {
  try {
    const { id, docId } = req.params;

    const document = await qaLoopRepository.getDocument(docId);

    if (!document || document.session_id !== id) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await qaLoopRepository.deleteDocument(docId);

    logger.info('Document deleted', { sessionId: id, documentId: docId });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete document', { error: error.message });
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ==================== PLAYWRIGHT EXPORT ENDPOINTS ====================

// Export single test case as Playwright .spec.ts file
router.get('/api/test-cases/:testCaseId/export-playwright', async (req: Request, res: Response) => {
  try {
    const { testCaseId } = req.params;
    const testCase = await qaLoopRepository.getTestCaseById(testCaseId);

    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found' });
    }

    if (!testCase.playwright_code) {
      return res.status(404).json({ error: 'No Playwright code available for this test case' });
    }

    // Get session for target URL
    const session = await qaLoopRepository.getSession(testCase.session_id);
    const targetUrl = session?.target_url || 'unknown';

    // Mask any hardcoded credentials
    let code = testCase.playwright_code;
    code = maskCredentials(code);

    // Wrap raw commands with test() for valid .spec.ts export
    const wrappedCode = wrapWithTestRunner(code, testCase.name);

    const header = generateExportHeader(targetUrl);
    const fullCode = `${header}\n${wrappedCode}\n`;
    const filename = sanitizeFilename(testCase.name) + '.spec.ts';

    res.setHeader('Content-Type', 'text/typescript');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(fullCode);
  } catch (error: any) {
    logger.error('Failed to export test case Playwright code', { error: error.message });
    res.status(500).json({ error: 'Failed to export Playwright code' });
  }
});

// Export entire test suite as combined Playwright file
router.get('/api/test-suites/:suiteId/export-playwright', async (req: Request, res: Response) => {
  try {
    const { suiteId } = req.params;
    const pool = (qaLoopRepository as any).pool;

    // Get suite info
    const suiteResult = await pool.query(
      'SELECT ts.name, ts.description FROM test_suites ts WHERE ts.id = $1',
      [suiteId]
    );

    if (suiteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Test suite not found' });
    }

    const suiteName = suiteResult.rows[0].name;

    // Get all test cases in this suite that have playwright_code
    const testCasesResult = await pool.query(
      `SELECT tc.name, tc.playwright_code, tc.source_page_url
       FROM qa_loop_test_cases tc
       WHERE tc.test_suite_id = $1 AND tc.playwright_code IS NOT NULL
       ORDER BY tc.priority DESC, tc.created_at ASC`,
      [suiteId]
    );

    if (testCasesResult.rows.length === 0) {
      return res.status(404).json({ error: 'No test cases with Playwright code found in this suite' });
    }

    // Get target URL from session linked to the suite
    const sessionResult = await pool.query(
      'SELECT target_url FROM qa_loop_sessions WHERE test_suite_id = $1 LIMIT 1',
      [suiteId]
    );
    const targetUrl = sessionResult.rows[0]?.target_url || 'unknown';

    // Build combined file: wrap each test case's raw commands in a test() block
    const header = generateExportHeader(targetUrl);
    let combinedTests = '';

    for (const tc of testCasesResult.rows) {
      let code = tc.playwright_code as string;
      code = maskCredentials(code);

      // Strip any legacy import statements and test() wrappers
      const rawCode = stripImportsAndTestWrapper(code);

      combinedTests += `\n  // --- ${tc.name} ---\n`;
      combinedTests += `  test('${tc.name.replace(/'/g, "\\'")}', async ({ page }) => {\n`;
      combinedTests += rawCode.split('\n').map((l: string) => `    ${l}`).join('\n') + '\n';
      combinedTests += `  });\n`;
    }

    const fullCode = `${header}
import { test, expect } from '@playwright/test';

test.describe('${suiteName.replace(/'/g, "\\'")}', () => {
${combinedTests}
});
`;

    const filename = sanitizeFilename(suiteName) + '.spec.ts';

    res.setHeader('Content-Type', 'text/typescript');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(fullCode);
  } catch (error: any) {
    logger.error('Failed to export test suite Playwright code', { error: error.message });
    res.status(500).json({ error: 'Failed to export Playwright suite' });
  }
});

/**
 * Strip any legacy import statements and test()/describe() wrappers from
 * Playwright code, returning only the raw page commands.
 */
function stripImportsAndTestWrapper(code: string): string {
  // Remove import statements
  let stripped = code.replace(/^import\s+.*?;\s*$/gm, '').trim();

  // Remove test('...', async ({ page }) => { ... }) wrapper
  const testWrapperRegex = /test\s*\([^,]+,\s*async\s*\(\s*\{\s*page[^}]*\}\s*\)\s*=>\s*\{/;
  const match = stripped.match(testWrapperRegex);
  if (match) {
    const startIdx = stripped.indexOf(match[0]);
    stripped = stripped.slice(0, startIdx) + stripped.slice(startIdx + match[0].length);

    // Remove the final closing `});`
    const lastClosing = stripped.lastIndexOf('});');
    if (lastClosing !== -1) {
      stripped = stripped.slice(0, lastClosing) + stripped.slice(lastClosing + 3);
    }
    stripped = stripped.trim();
  }

  return stripped;
}

/**
 * Wrap raw Playwright commands with import + test() for .spec.ts export.
 */
function wrapWithTestRunner(rawCode: string, testName: string): string {
  // Strip any legacy wrappers first to avoid double-wrapping
  const cleanCode = stripImportsAndTestWrapper(rawCode);
  const escapedName = testName.replace(/'/g, "\\'");

  return `import { test, expect } from '@playwright/test';

test('${escapedName}', async ({ page }) => {
${cleanCode.split('\n').map((l: string) => `  ${l}`).join('\n')}
});
`;
}

// Helper: generate export header
function generateExportHeader(targetUrl: string): string {
  return `// Auto-generated by WhyNot
// Date: ${new Date().toISOString()}
// Target URL: ${targetUrl}
//
// Run with: npx playwright test ${sanitizeFilename('this-file')}.spec.ts
`;
}

// Helper: mask credentials in code
function maskCredentials(code: string): string {
  // Replace any hardcoded-looking username/email strings near fill/type calls
  // But preserve process.env references
  return code
    .replace(/process\.env\.TEST_USERNAME/g, 'process.env.TEST_USERNAME')
    .replace(/process\.env\.TEST_PASSWORD/g, 'process.env.TEST_PASSWORD');
}

// Helper: sanitize filename
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// Mount webhook routes last so /api/sessions and other session routes are matched first (webhook has auth middleware)
router.use('/api', webhookRoutes);

/**
 * Called by index.ts SIGTERM/SIGINT handlers to gracefully stop all running
 * orchestrators before the process exits (3.1).
 */
export async function shutdownActiveSessions(): Promise<void> {
  logger.info('Graceful shutdown: stopping all active sessions', { count: activeSessions.size });
  const shutdownPromises = Array.from(activeSessions.entries()).map(async ([sessionId, orchestrator]) => {
    try {
      await orchestrator.stop();
      logger.info('Session stopped on shutdown', { sessionId });
    } catch (error: any) {
      logger.warn('Failed to stop session on shutdown', { sessionId, error: error.message });
    }
  });
  await Promise.allSettled(shutdownPromises);
  activeSessions.clear();
}

export default router;
