import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../../shared/logger/logger';
import { QALoopRepository } from '../repositories/qa-loop-repository';
import { LoopOrchestrator } from '../loop-orchestrator';
import { RetestExecutor } from '../retest-executor';
import webhookRoutes from './webhook';
import { parseDocument, combineDocuments, ParsedDocument } from '../document-parser';
import { getPool } from '../../../../shared/database/connection';

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
      maxIterations = 100,
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
      testPriority
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
      }
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
        ...(loginCredentials ? { loginCredentials } : {})
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
    res.json({ success: true, status: 'running' });
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
      await orchestrator.stop();
      activeSessions.delete(id);
    }

    await qaLoopRepository.updateSessionStatus(id, 'cancelled');

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

// Save a QA Loop test case to the main test_cases table
router.post('/api/sessions/:id/test-cases/:tcId/save-to-project', async (req: Request, res: Response) => {
  try {
    const { id, tcId } = req.params;
    const workspaceId = req.headers['x-workspace-id'] as string | undefined;

    // Get the session to retrieve target_url and project info
    const session = await qaLoopRepository.getSession(id, workspaceId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get the QA Loop test case
    const qaTestCase = await qaLoopRepository.getTestCaseById(tcId);
    if (!qaTestCase || qaTestCase.session_id !== id) {
      return res.status(404).json({ error: 'Test case not found in this session' });
    }

    // Insert into the main test_cases table
    const testCaseId = uuidv4();
    const pool = getPool();
    const insertQuery = `
      INSERT INTO test_cases (
        id, name, description, website_url, user_story, steps, metadata, workspace_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      testCaseId,
      qaTestCase.name,
      qaTestCase.description || '',
      session.target_url,
      qaTestCase.description || `QA Loop generated test case from session ${id}`,
      JSON.stringify(qaTestCase.steps || []),
      JSON.stringify({
        category: qaTestCase.category,
        priority: qaTestCase.priority,
        risk_level: qaTestCase.risk_level,
        source: 'qa_loop',
        qa_loop_session_id: id,
        qa_loop_test_case_id: tcId,
      }),
      session.workspace_id || null,
    ]);

    logger.info('QA Loop test case saved to project', {
      sessionId: id,
      qaTestCaseId: tcId,
      savedTestCaseId: testCaseId,
    });

    res.status(201).json({
      success: true,
      testCase: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Failed to save test case to project', { error: error.message });
    res.status(500).json({ error: 'Failed to save test case', details: error.message });
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
