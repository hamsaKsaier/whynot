/**
 * useSessionManager — encapsulates all QA Loop session state and API calls
 * so that QALoopPage.tsx and its child components stay pure presentation (5.1).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQALoopStream, TestRunActivity } from './useQALoopStream';
export type { TestRunActivity };
import {
  startQALoopSession,
  listQALoopSessions,
  getQALoopSession,
  pauseQALoopSession,
  resumeQALoopSession,
  stopQALoopSession,
  runRetest,
  uploadDocument,
  listDocuments,
  deleteDocument,
  toggleDocument,
  QALoopSession,
  QALoopTestCase,
  QALoopBug,
  QALoopPage as QAPage,
  QALoopDocument,
  LoginCredentials,
} from '../services/qa-loop-api';
import {
  ChaosResult,
  ChaosSummary,
  RootCauseAnalysis,
  FailureCorrelation,
  QualityScore,
  RiskCounts,
  IterationHistory,
} from '../components/QALoop';

export interface StartSessionParams {
  targetUrl: string;
  qualityThreshold: number;
  maxIterations: number;
  documentContext?: string;
  loginCredentials?: LoginCredentials;
  testPriority?: 'functional_first' | 'balanced' | 'security_first';
  sourceSessionId?: string;
  projectId?: string;
  config?: Record<string, any>;
}

interface UseSessionManagerOptions {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function useSessionManager({ onSuccess, onError }: UseSessionManagerOptions) {
  // ── Session list ─────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<QALoopSession[]>([]);
  const [activeSession, setActiveSession] = useState<QALoopSession | null>(null);
  const [sessionTestCases, setSessionTestCases] = useState<QALoopTestCase[]>([]);
  const [sessionBugs, setSessionBugs] = useState<QALoopBug[]>([]);
  const [sessionPages, setSessionPages] = useState<QAPage[]>([]);

  // ── Quality / analysis state ─────────────────────────────────────────────────
  const [chaosResults, setChaosResults] = useState<ChaosResult[]>([]);
  const [chaosSummary, setChaosSummary] = useState<ChaosSummary | undefined>();
  const [analyses, setAnalyses] = useState<RootCauseAnalysis[]>([]);
  const [correlations, setCorrelations] = useState<FailureCorrelation[]>([]);
  const [qualityScore, setQualityScore] = useState<QualityScore>({
    overall: 0,
    breakdown: { coverage: 0, stability: 0, security: 100, accessibility: 0, performance: 0 },
    trend: 'stable',
    scoreDelta: 0,
  });
  const [risks, setRisks] = useState<RiskCounts>({ critical: 0, high: 0, medium: 0, low: 0 });
  const [iterationHistory, setIterationHistory] = useState<IterationHistory[]>([]);

  // ── Documents ────────────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState<QALoopDocument[]>([]);

  // ── Loading flags ────────────────────────────────────────────────────────────
  const [isStarting, setIsStarting] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false); // 6.3
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false); // 6.6

  // ── Pagination state (6.6) ───────────────────────────────────────────────────
  const SESSION_PAGE_SIZE = 20;
  const [hasMoreSessions, setHasMoreSessions] = useState(false);
  const [sessionsOffset, setSessionsOffset] = useState(0);

  // Cache for completed/cancelled session details — never change so zero cost (4.6)
  const completedSessionCache = useRef<Map<string, any>>(new Map());

  // ── WebSocket auth token ───────────────────────────────────────────────────
  const [wsToken, setWsToken] = useState<string | undefined>();

  // ── WebSocket stream ─────────────────────────────────────────────────────────
  const {
    isConnected,
    currentScreenshot,
    currentUrl,
    thinkingText,
    toolCalls,
    testRunActivity,
    iteration,
    pagesDiscovered,
    pagesExplored,
    testsGenerated,
    bugsFound: streamBugsFound,
    sessionStatus,
    currentPhase,
    currentMessage,
    costInfo,
    sessionStartTime,
    error: wsError,
    clearEvents,
  } = useQALoopStream({
    sessionId: activeSession?.id,
    enabled: activeSession?.status === 'running',
    wsToken,
  });

  // ── applySessionDetails ──────────────────────────────────────────────────────
  const applySessionDetails = useCallback((details: any) => {
    setActiveSession(details.session);
    setSessionTestCases(details.testCases || []);
    setSessionBugs(details.bugs || []);
    setSessionPages(details.pages || []);

    if (details.session) {
      const session = details.session;
      const bugs: any[] = details.bugs || [];

      setRisks({
        critical: bugs.filter(b => b.severity === 'critical').length,
        high:     bugs.filter(b => b.severity === 'high').length,
        medium:   bugs.filter(b => b.severity === 'medium').length,
        low:      bugs.filter(b => b.severity === 'low').length,
      });

      const pages: any[] = details.pages || [];
      const tests: any[] = details.testCases || [];
      const exploredCount = pages.filter(p => p.is_explored).length;
      const coverageScore  = pages.length > 0 ? Math.round((exploredCount / pages.length) * 100) : 0;
      const executedTests  = tests.filter(t => t.last_run_status != null);
      const passingTests   = executedTests.filter(t => t.last_run_status === 'passed').length;
      const stabilityScore = executedTests.length > 0 ? Math.round((passingTests / executedTests.length) * 100) : 100;
      const secBugs        = bugs.filter(b => b.category === 'security');
      const securityScore  = Math.max(0, 100 - (
        secBugs.filter(b => b.severity === 'critical').length * 25 +
        secBugs.filter(b => b.severity === 'high').length * 15
      ));

      // 6.4 — accessibility & performance have no real data source yet; show N/A
      setQualityScore({
        overall: session.quality_score || 0,
        breakdown: { coverage: coverageScore, stability: stabilityScore, security: securityScore, accessibility: 0, performance: 0 },
        trend: 'stable',
        scoreDelta: 0,
      });

      if (session.iteration_count > 0) {
        setIterationHistory(prev => {
          const entry: IterationHistory = {
            iteration: session.iteration_count,
            score: session.quality_score || 0,
            focus: 'explore',
            timestamp: new Date().toISOString(),
          };
          return [...prev.filter(h => h.iteration !== session.iteration_count), entry].slice(-10);
        });
      }
    }

    // Map security bugs → chaos results so ChaosResultsTab gets data (5.9)
    const securityBugs: any[] = (details.bugs || []).filter((b: any) => b.category === 'security');
    setChaosResults(securityBugs.map(bug => ({
      id: bug.id,
      pageUrl: bug.page_url || '',
      attackCategory: bug.bug_type || 'security',
      attackName: bug.title,
      payloadUsed: '',
      result: 'vulnerable' as const,
      vulnerabilityConfirmed: true,
      severity: bug.severity,
      confidence: 0.8,
      reproductionSteps: bug.reproduction_steps || [],
    })));
  }, []);

  // ── loadSessionDetails ───────────────────────────────────────────────────────
  const loadSessionDetails = useCallback(async (sessionId: string) => {
    setIsLoadingDetails(true); // 6.3 — spinner while switching sessions
    try {
      // Return cached data for terminal sessions — they never change (4.6)
      if (completedSessionCache.current.has(sessionId)) {
        applySessionDetails(completedSessionCache.current.get(sessionId)!);
        return;
      }

      const details = await getQALoopSession(sessionId);

      const status = details.session?.status;
      if (status === 'completed' || status === 'cancelled' || status === 'failed') {
        completedSessionCache.current.set(sessionId, details);
      }

      applySessionDetails(details);
    } catch (err: any) {
      console.error('Failed to load session details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [applySessionDetails]);

  // ── loadDocuments ────────────────────────────────────────────────────────────
  const loadDocuments = useCallback(async (sessionId: string) => {
    try {
      const result = await listDocuments(sessionId);
      setDocuments(result.documents || []);
    } catch {
      // Silently fail — documents may not be available yet
    }
  }, []);

  // ── loadSessions ─────────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      // 6.6 — reset pagination to page 1
      const { sessions: list, total } = await listQALoopSessions({ limit: SESSION_PAGE_SIZE, offset: 0 });
      setSessions(list);
      setSessionsOffset(SESSION_PAGE_SIZE);
      setHasMoreSessions(list.length < total);

      const runningSession = list.find(s => s.status === 'running');
      if (runningSession) {
        setActiveSession(runningSession);
        loadSessionDetails(runningSession.id);
      }
    } catch {
      onError('Failed to load sessions');
    } finally {
      setIsLoadingSessions(false);
    }
  }, [loadSessionDetails, onError]);

  // ── loadMoreSessions (6.6) ────────────────────────────────────────────────────
  const loadMoreSessions = useCallback(async () => {
    if (isLoadingMoreSessions || !hasMoreSessions) return;
    setIsLoadingMoreSessions(true);
    try {
      const { sessions: list, total } = await listQALoopSessions({ limit: SESSION_PAGE_SIZE, offset: sessionsOffset });
      setSessions(prev => [...prev, ...list]);
      const newOffset = sessionsOffset + list.length;
      setSessionsOffset(newOffset);
      setHasMoreSessions(newOffset < total);
    } catch {
      onError('Failed to load more sessions');
    } finally {
      setIsLoadingMoreSessions(false);
    }
  }, [isLoadingMoreSessions, hasMoreSessions, sessionsOffset, onError]);

  // ── Session actions ──────────────────────────────────────────────────────────
  const handleStartSession = useCallback(async (params: StartSessionParams) => {
    setIsStarting(true);
    clearEvents();
    try {
      const result = await startQALoopSession({
        targetUrl:       params.targetUrl,
        qualityThreshold: params.qualityThreshold,
        maxIterations:   params.maxIterations,
        documentContext: params.documentContext,
        loginCredentials: params.loginCredentials,
        testPriority:    params.testPriority,
        sourceSessionId: params.sourceSessionId,
        projectId:       params.projectId,
        config:          params.config,
      });
      const { session } = result;
      // Store WS auth token for secure WebSocket connection
      if (result.wsToken) {
        setWsToken(result.wsToken);
      }
      setActiveSession(session);
      onSuccess('QA Loop session started!');
      loadSessions();

      // Auto-scroll to the live monitor after session starts
      setTimeout(() => {
        const target = document.querySelector(
          '.cinema-mode, .live-monitor-container, [class*="cinema"], [class*="live-monitor"]'
        );
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 800);
    } catch (err: any) {
      onError(err.message || 'Failed to start session');
    } finally {
      setIsStarting(false);
    }
  }, [clearEvents, onSuccess, onError, loadSessions]);

  const handlePauseSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      await pauseQALoopSession(activeSession.id);
      setActiveSession(prev => prev ? { ...prev, status: 'paused' } : prev);
      onSuccess('Session paused');
    } catch {
      onError('Failed to pause session');
    }
  }, [activeSession, onSuccess, onError]);

  const handleResumeSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      // Credentials are not persisted for security. Sessions requiring login
      // will run without authentication on resume. Re-enter credentials by
      // stopping and starting a new session if re-authentication is needed.
      const result = await resumeQALoopSession(activeSession.id);
      if (result.wsToken) {
        setWsToken(result.wsToken);
      }
      setActiveSession(prev => prev ? { ...prev, status: 'running' } : prev);
      onSuccess('Session resumed');
    } catch {
      onError('Failed to resume session');
    }
  }, [activeSession, onSuccess, onError]);

  const handleStopSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      await stopQALoopSession(activeSession.id);
      setActiveSession(prev => prev ? { ...prev, status: 'cancelled' } : prev);
      onSuccess('Session stopped');
      loadSessions();
    } catch {
      onError('Failed to stop session');
    }
  }, [activeSession, onSuccess, onError, loadSessions]);

  const handleRetest = useCallback(async (mode: 'quick' | 'smart') => {
    if (!activeSession) return;
    try {
      const result = await runRetest(activeSession.id, mode);
      onSuccess(`${mode === 'quick' ? 'Quick' : 'Smart'} retest started!`);
      loadSessionDetails(result.retestSessionId);
    } catch {
      onError('Failed to start retest');
    }
  }, [activeSession, onSuccess, onError, loadSessionDetails]);

  const handleSelectSession = useCallback((session: QALoopSession) => {
    setActiveSession(session);
    loadSessionDetails(session.id);
    clearEvents();
  }, [loadSessionDetails, clearEvents]);

  // ── Document actions ─────────────────────────────────────────────────────────
  const handleUploadDocument = useCallback(async (file: File) => {
    if (!activeSession) return;
    try {
      await uploadDocument(activeSession.id, file);
      await loadDocuments(activeSession.id);
      onSuccess('Document uploaded');
    } catch {
      onError('Failed to upload document');
    }
  }, [activeSession, onSuccess, onError, loadDocuments]);

  const handleDeleteDocument = useCallback(async (docId: string) => {
    if (!activeSession) return;
    try {
      await deleteDocument(activeSession.id, docId);
      setDocuments(docs => docs.filter(d => d.id !== docId));
      onSuccess('Document deleted');
    } catch {
      onError('Failed to delete document');
    }
  }, [activeSession, onSuccess, onError]);

  const handleToggleDocument = useCallback(async (docId: string, isActive: boolean) => {
    if (!activeSession) return;
    try {
      await toggleDocument(activeSession.id, docId, isActive);
      setDocuments(docs => docs.map(d => d.id === docId ? { ...d, is_active: isActive } : d));
    } catch {
      onError('Failed to toggle document');
    }
  }, [activeSession, onError]);

  // ── Side-effects ─────────────────────────────────────────────────────────────

  // Initial load
  useEffect(() => {
    loadSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling while session is running — every 5 s without WS, every 10 s with WS.
  // Even with WS connected we need periodic REST refreshes so the Tests / Bugs /
  // Pages tabs stay up-to-date (WS only emits lightweight events, not full objects).
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') return;
    const interval = setInterval(() => {
      loadSessionDetails(activeSession.id);
    }, isConnected ? 10_000 : 5_000);
    return () => clearInterval(interval);
  }, [activeSession?.id, activeSession?.status, isConnected, loadSessionDetails]);

  // Load documents when active session changes
  useEffect(() => {
    if (activeSession) {
      loadDocuments(activeSession.id);
    } else {
      setDocuments([]);
    }
  }, [activeSession?.id, loadDocuments]);

  // ── Expose ───────────────────────────────────────────────────────────────────
  return {
    // Session list
    sessions,
    activeSession,
    sessionTestCases,
    sessionBugs,
    sessionPages,
    // Quality / analysis
    chaosResults,
    chaosSummary,
    analyses,
    correlations,
    qualityScore,
    risks,
    iterationHistory,
    // Documents
    documents,
    // Loading
    isStarting,
    isLoadingSessions,
    isLoadingDetails,        // 6.3
    isLoadingMoreSessions,   // 6.6
    // Pagination (6.6)
    hasMoreSessions,
    loadMoreSessions,
    // Actions
    loadSessions,
    loadSessionDetails,
    handleStartSession,
    handlePauseSession,
    handleResumeSession,
    handleStopSession,
    handleRetest,
    handleSelectSession,
    handleUploadDocument,
    handleDeleteDocument,
    handleToggleDocument,
    // Stream
    isConnected,
    currentScreenshot,
    currentUrl,
    thinkingText,
    toolCalls,
    testRunActivity,
    iteration,
    pagesDiscovered,
    pagesExplored,
    testsGenerated,
    streamBugsFound,
    sessionStatus,
    currentPhase,
    currentMessage,
    costInfo,
    sessionStartTime,
    wsError,
    clearEvents,
  };
}
