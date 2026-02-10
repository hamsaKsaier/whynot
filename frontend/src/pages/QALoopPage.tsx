import React, { useState, useEffect } from 'react';
import { useToastContext } from '../contexts/ToastContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Alert } from '../components/common/Alert';
import {
  startQALoopSession,
  listQALoopSessions,
  getQALoopSession,
  pauseQALoopSession,
  resumeQALoopSession,
  stopQALoopSession,
  runRetest,
  checkExistingSession,
  uploadDocument,
  listDocuments,
  deleteDocument,
  toggleDocument,
  QALoopSession,
  QALoopTestCase,
  QALoopBug,
  QALoopPage as QAPage,
  QALoopDocument
} from '../services/qa-loop-api';
import { useQALoopStream } from '../hooks/useQALoopStream';
import {
  ChaosResultsTab,
  AnalysisTab,
  QualityDashboard,
  DocumentUpload,
  ChaosResult,
  ChaosSummary,
  RootCauseAnalysis,
  FailureCorrelation,
  QualityScore,
  RiskCounts,
  IterationHistory,
  UploadedDocument
} from '../components/QALoop';
import {
  FiPlay,
  FiPause,
  FiStopCircle,
  FiRefreshCw,
  FiGlobe,
  FiFileText,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiActivity,
  FiTarget,
  FiZap,
  FiChevronDown,
  FiChevronUp,
  FiTerminal,
  FiImage,
  FiShield,
  FiSearch,
  FiBarChart2,
  FiEye,
  FiEyeOff,
  FiLock,
  FiUser,
  FiInfo,
  FiUpload,
  FiTrash2,
  FiToggleLeft,
  FiToggleRight,
  FiMaximize2,
  FiMinimize2
} from 'react-icons/fi';

// Results Tabs Component with Chaos and Analysis
const ResultsTabs: React.FC<{
  testCases: QALoopTestCase[];
  bugs: QALoopBug[];
  pages: QAPage[];
  chaosResults: ChaosResult[];
  chaosSummary?: ChaosSummary;
  analyses: RootCauseAnalysis[];
  correlations: FailureCorrelation[];
  isRunning?: boolean;
}> = ({ testCases, bugs, pages, chaosResults, chaosSummary, analyses, correlations, isRunning }) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'bugs' | 'pages' | 'chaos' | 'analysis'>('tests');

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'passed': return <FiCheckCircle className="text-green-500" />;
      case 'failed': return <FiAlertTriangle className="text-red-500" />;
      default: return <FiClock className="text-gray-400" />;
    }
  };

  const vulnerabilitiesCount = chaosResults.filter(r => r.vulnerabilityConfirmed).length;

  return (
    <>
      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav className="flex gap-4 flex-wrap">
          <button
            onClick={() => setActiveTab('tests')}
            className={`pb-2 flex items-center gap-1 ${activeTab === 'tests'
              ? 'border-b-2 border-purple-500 text-purple-600 font-medium'
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FiFileText className="text-sm" />
            Tests ({testCases.length})
          </button>
          <button
            onClick={() => setActiveTab('bugs')}
            className={`pb-2 flex items-center gap-1 ${activeTab === 'bugs'
              ? 'border-b-2 border-red-500 text-red-600 font-medium'
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FiAlertTriangle className="text-sm" />
            Bugs ({bugs.length})
          </button>
          <button
            onClick={() => setActiveTab('pages')}
            className={`pb-2 flex items-center gap-1 ${activeTab === 'pages'
              ? 'border-b-2 border-blue-500 text-blue-600 font-medium'
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FiGlobe className="text-sm" />
            Pages ({pages.length})
          </button>
          <button
            onClick={() => setActiveTab('chaos')}
            className={`pb-2 flex items-center gap-1 ${activeTab === 'chaos'
              ? 'border-b-2 border-orange-500 text-orange-600 font-medium'
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FiShield className="text-sm" />
            Security ({vulnerabilitiesCount})
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`pb-2 flex items-center gap-1 ${activeTab === 'analysis'
              ? 'border-b-2 border-green-500 text-green-600 font-medium'
              : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FiSearch className="text-sm" />
            Analysis ({analyses.length})
          </button>
        </nav>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {activeTab === 'tests' && (
          <div className="space-y-2">
            {testCases.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No test cases generated yet
              </div>
            ) : (
              testCases.map((tc) => (
                <div key={tc.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(tc.last_run_status)}
                      <span className="font-medium text-gray-900 dark:text-white">{tc.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                        {tc.category}
                      </span>
                      <span className="text-xs text-gray-400">
                        P{tc.priority}
                      </span>
                    </div>
                  </div>
                  {tc.description && (
                    <p className="text-sm text-gray-500 mt-1 ml-6">{tc.description}</p>
                  )}
                  <div className="text-xs text-gray-400 mt-1 ml-6 flex items-center gap-3">
                    <span>{tc.steps?.length || 0} steps</span>
                    {tc.last_run_status && (
                      <span className={tc.last_run_status === 'passed' ? 'text-green-500' : 'text-red-500'}>
                        Last: {tc.last_run_status}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'bugs' && (
          <div className="space-y-2">
            {bugs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No bugs found yet - that's a good sign!
              </div>
            ) : (
              bugs.map((bug) => (
                <div key={bug.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 border-red-400">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white">{bug.title}</span>
                    <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(bug.severity)}`}>
                      {bug.severity}
                    </span>
                  </div>
                  {bug.description && (
                    <p className="text-sm text-gray-500 mt-1">{bug.description}</p>
                  )}
                  <div className="text-xs text-gray-400 mt-2 flex items-center gap-3">
                    {bug.category && <span>{bug.category}</span>}
                    {bug.page_url && (
                      <span className="truncate max-w-xs">{new URL(bug.page_url).pathname}</span>
                    )}
                    <span className={bug.status === 'open' ? 'text-red-500' : 'text-green-500'}>
                      {bug.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'pages' && (
          <div className="space-y-2">
            {pages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No pages explored yet
              </div>
            ) : (
              pages.map((page) => (
                <div key={page.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {page.is_explored ? (
                        <FiCheckCircle className="text-green-500" />
                      ) : (
                        <FiClock className="text-yellow-500" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white truncate max-w-md">
                        {page.title || new URL(page.url).pathname}
                      </span>
                    </div>
                    {page.page_type && (
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                        {page.page_type}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 ml-6 truncate">
                    {page.url}
                  </div>
                  {page.description && (
                    <p className="text-sm text-gray-500 mt-1 ml-6">{page.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'chaos' && (
          <ChaosResultsTab
            results={chaosResults}
            summary={chaosSummary}
            isRunning={isRunning}
          />
        )}

        {activeTab === 'analysis' && (
          <AnalysisTab
            analyses={analyses}
            correlations={correlations}
          />
        )}
      </div>
    </>
  );
};

export const QALoopPage: React.FC = () => {
  const { success, error: showError } = useToastContext();

  // Form state
  const [targetUrl, setTargetUrl] = useState('');
  const [qualityThreshold, setQualityThreshold] = useState(80);
  const [maxIterations, setMaxIterations] = useState(100);
  const [documentContext, setDocumentContext] = useState('');

  // Login credentials state (Phase 2)
  const [useLogin, setUseLogin] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState({
    email: '',
    password: '',
    loginUrl: '',
    emailSelector: '',
    passwordSelector: '',
    submitSelector: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  // Test priority state (Phase 5)
  const [testPriority, setTestPriority] = useState<'functional_first' | 'balanced' | 'security_first'>('functional_first');

  // Existing session state (Phase 3)
  const [existingSession, setExistingSession] = useState<{
    id: string;
    testCaseCount: number;
    bugsFound: number;
    completedAt: string;
  } | null>(null);
  const [useExisting, setUseExisting] = useState(false);

  // Documents state (Phase 4)
  const [documents, setDocuments] = useState<QALoopDocument[]>([]);

  // Session state
  const [sessions, setSessions] = useState<QALoopSession[]>([]);
  const [activeSession, setActiveSession] = useState<QALoopSession | null>(null);
  const [sessionTestCases, setSessionTestCases] = useState<QALoopTestCase[]>([]);
  const [sessionBugs, setSessionBugs] = useState<QALoopBug[]>([]);
  const [sessionPages, setSessionPages] = useState<QAPage[]>([]);

  // Phase 3-5 state
  const [chaosResults, setChaosResults] = useState<ChaosResult[]>([]);
  const [chaosSummary, setChaosSummary] = useState<ChaosSummary | undefined>();
  const [analyses, setAnalyses] = useState<RootCauseAnalysis[]>([]);
  const [correlations, setCorrelations] = useState<FailureCorrelation[]>([]);
  const [qualityScore, setQualityScore] = useState<QualityScore>({
    overall: 0,
    breakdown: { coverage: 0, stability: 0, security: 100, accessibility: 0, performance: 0 },
    trend: 'stable',
    scoreDelta: 0
  });
  const [risks, setRisks] = useState<RiskCounts>({ critical: 0, high: 0, medium: 0, low: 0 });
  const [iterationHistory, setIterationHistory] = useState<IterationHistory[]>([]);

  // UI state
  const [isStarting, setIsStarting] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const [showToolCalls, setShowToolCalls] = useState(true);
  const [showQualityDashboard, setShowQualityDashboard] = useState(true);
  const [expandedPreview, setExpandedPreview] = useState(false);

  // WebSocket stream
  const {
    isConnected,
    currentScreenshot,
    currentUrl,
    thinkingText,
    toolCalls,
    iteration,
    pagesDiscovered,
    pagesExplored,
    testsGenerated,
    bugsFound,
    sessionStatus,
    error: wsError,
    clearEvents
  } = useQALoopStream({
    sessionId: activeSession?.id,
    enabled: activeSession?.status === 'running'
  });

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Poll for session updates when active
  useEffect(() => {
    if (activeSession && activeSession.status === 'running') {
      const interval = setInterval(() => {
        loadSessionDetails(activeSession.id);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeSession?.id, activeSession?.status]);

  // Check for existing sessions when target URL changes (Phase 3)
  useEffect(() => {
    const checkUrl = async () => {
      if (!targetUrl || targetUrl.length < 10) {
        setExistingSession(null);
        return;
      }

      // Debounce - only check after user stops typing
      try {
        const result = await checkExistingSession(targetUrl);
        if (result.exists && result.session) {
          setExistingSession(result.session);
        } else {
          setExistingSession(null);
        }
      } catch {
        setExistingSession(null);
      }
    };

    const debounceTimer = setTimeout(checkUrl, 500);
    return () => clearTimeout(debounceTimer);
  }, [targetUrl]);

  // Load documents when session changes (Phase 4)
  useEffect(() => {
    if (activeSession) {
      loadDocuments(activeSession.id);
    } else {
      setDocuments([]);
    }
  }, [activeSession?.id]);

  const loadDocuments = async (sessionId: string) => {
    try {
      const result = await listDocuments(sessionId);
      setDocuments(result.documents || []);
    } catch {
      // Silently fail - documents may not be available
    }
  };

  const handleUploadDocument = async (file: File) => {
    if (!activeSession) return;
    try {
      await uploadDocument(activeSession.id, file);
      await loadDocuments(activeSession.id);
      success('Document uploaded');
    } catch (err: any) {
      showError('Failed to upload document');
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!activeSession) return;
    try {
      await deleteDocument(activeSession.id, docId);
      setDocuments(docs => docs.filter(d => d.id !== docId));
      success('Document deleted');
    } catch (err: any) {
      showError('Failed to delete document');
    }
  };

  const handleToggleDocument = async (docId: string, isActive: boolean) => {
    if (!activeSession) return;
    try {
      await toggleDocument(activeSession.id, docId, isActive);
      setDocuments(docs => docs.map(d =>
        d.id === docId ? { ...d, is_active: isActive } : d
      ));
    } catch (err: any) {
      showError('Failed to toggle document');
    }
  };

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const { sessions } = await listQALoopSessions({ limit: 20 });
      setSessions(sessions);

      // Check if there's a running session
      const runningSession = sessions.find(s => s.status === 'running');
      if (runningSession) {
        setActiveSession(runningSession);
        loadSessionDetails(runningSession.id);
      }
    } catch (err: any) {
      showError('Failed to load sessions');
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const details = await getQALoopSession(sessionId);
      setActiveSession(details.session);
      setSessionTestCases(details.testCases || []);
      setSessionBugs(details.bugs || []);
      setSessionPages(details.pages || []);

      // Update quality score from session
      if (details.session) {
        const session = details.session;
        // Calculate risks from bugs
        const bugs = details.bugs || [];
        setRisks({
          critical: bugs.filter(b => b.severity === 'critical').length,
          high: bugs.filter(b => b.severity === 'high').length,
          medium: bugs.filter(b => b.severity === 'medium').length,
          low: bugs.filter(b => b.severity === 'low').length
        });

        // Update quality score
        const pages = details.pages || [];
        const tests = details.testCases || [];
        const exploredCount = pages.filter(p => p.is_explored).length;
        const coverageScore = pages.length > 0 ? Math.round((exploredCount / pages.length) * 100) : 0;
        const passingTests = tests.filter(t => t.last_run_status === 'passed').length;
        const stabilityScore = tests.length > 0 ? Math.round((passingTests / tests.length) * 100) : 100;
        const securityBugs = bugs.filter(b => b.category === 'security');
        const securityScore = Math.max(0, 100 - (securityBugs.filter(b => b.severity === 'critical').length * 25 + securityBugs.filter(b => b.severity === 'high').length * 15));

        setQualityScore({
          overall: session.quality_score || 0,
          breakdown: {
            coverage: coverageScore,
            stability: stabilityScore,
            security: securityScore,
            accessibility: 80,
            performance: 80
          },
          trend: 'stable',
          scoreDelta: 0
        });

        // Add to iteration history
        if (session.iteration_count > 0) {
          setIterationHistory(prev => {
            const newEntry = {
              iteration: session.iteration_count,
              score: session.quality_score || 0,
              focus: 'explore',
              timestamp: new Date().toISOString()
            };
            // Keep last 10 entries
            const updated = [...prev.filter(h => h.iteration !== session.iteration_count), newEntry];
            return updated.slice(-10);
          });
        }
      }

      // Load chaos results and analyses if available
      // These would come from extended API endpoints
      // For now, extract security bugs as chaos results
      const securityBugs = (details.bugs || []).filter(b => b.category === 'security');
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
        reproductionSteps: bug.reproduction_steps || []
      })));

    } catch (err: any) {
      console.error('Failed to load session details:', err);
    }
  };

  const handleStartSession = async () => {
    if (!targetUrl) {
      showError('Please enter a target URL');
      return;
    }

    setIsStarting(true);
    clearEvents();

    try {
      // Build login credentials if enabled
      const loginCreds = useLogin && loginCredentials.email && loginCredentials.password
        ? {
          email: loginCredentials.email,
          password: loginCredentials.password,
          loginUrl: loginCredentials.loginUrl || undefined,
          emailSelector: loginCredentials.emailSelector || undefined,
          passwordSelector: loginCredentials.passwordSelector || undefined,
          submitSelector: loginCredentials.submitSelector || undefined
        }
        : undefined;

      const { session } = await startQALoopSession({
        targetUrl,
        qualityThreshold,
        maxIterations,
        documentContext: documentContext || undefined,
        loginCredentials: loginCreds,
        testPriority,
        sourceSessionId: useExisting && existingSession ? existingSession.id : undefined
      });

      setActiveSession(session);
      success('QA Loop session started!');
      loadSessions();

      // Reset existing session state
      setExistingSession(null);
      setUseExisting(false);
    } catch (err: any) {
      showError(err.message || 'Failed to start session');
    } finally {
      setIsStarting(false);
    }
  };

  const handlePauseSession = async () => {
    if (!activeSession) return;
    try {
      await pauseQALoopSession(activeSession.id);
      setActiveSession({ ...activeSession, status: 'paused' });
      success('Session paused');
    } catch (err: any) {
      showError('Failed to pause session');
    }
  };

  const handleResumeSession = async () => {
    if (!activeSession) return;
    try {
      await resumeQALoopSession(activeSession.id);
      setActiveSession({ ...activeSession, status: 'running' });
      success('Session resumed');
    } catch (err: any) {
      showError('Failed to resume session');
    }
  };

  const handleStopSession = async () => {
    if (!activeSession) return;
    try {
      await stopQALoopSession(activeSession.id);
      setActiveSession({ ...activeSession, status: 'cancelled' });
      success('Session stopped');
      loadSessions();
    } catch (err: any) {
      showError('Failed to stop session');
    }
  };

  const handleRetest = async (mode: 'quick' | 'smart') => {
    if (!activeSession) return;
    try {
      const result = await runRetest(activeSession.id, mode);
      success(`${mode === 'quick' ? 'Quick' : 'Smart'} retest started!`);
      // Load the new retest session
      loadSessionDetails(result.retestSessionId);
    } catch (err: any) {
      showError('Failed to start retest');
    }
  };

  const handleSelectSession = (session: QALoopSession) => {
    setActiveSession(session);
    loadSessionDetails(session.id);
    clearEvents();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-500';
      case 'completed': return 'text-green-500';
      case 'paused': return 'text-yellow-500';
      case 'failed': return 'text-red-500';
      case 'cancelled': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FiZap className="text-purple-500" />
            QA Loop
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Autonomous exploration and testing powered by AI. Point at a URL, let it explore overnight.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Start Form & Sessions */}
          <div className="space-y-6">
            {/* Start New Session */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FiPlay className="text-green-500" />
                Start New Exploration
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target URL
                  </label>
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Existing Session Prompt (Phase 3) */}
                {existingSession && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <FiRefreshCw className="text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Previous run found for this URL
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          {existingSession.testCaseCount} test cases | {existingSession.bugsFound} bugs | Last run: {new Date(existingSession.completedAt).toLocaleDateString()}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => setUseExisting(true)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${useExisting
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700'
                              }`}
                          >
                            Continue from last run
                          </button>
                          <button
                            type="button"
                            onClick={() => setUseExisting(false)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!useExisting
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700'
                              }`}
                          >
                            Start fresh
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {showAdvanced ? <FiChevronUp /> : <FiChevronDown />}
                  Advanced Options
                </button>

                {showAdvanced && (
                  <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                    {/* Test Priority (Phase 5) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                        Test Priority
                        <span className="group relative">
                          <FiInfo className="text-gray-400 cursor-help" size={14} />
                          <span className="invisible group-hover:visible absolute left-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                            <strong>Functional First:</strong> Focus on exploring functionality before security testing<br />
                            <strong>Balanced:</strong> Mix of exploration, security, and stability<br />
                            <strong>Security First:</strong> Start security testing earlier
                          </span>
                        </span>
                      </label>
                      <select
                        value={testPriority}
                        onChange={(e) => setTestPriority(e.target.value as any)}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="functional_first">Functional First (recommended)</option>
                        <option value="balanced">Balanced</option>
                        <option value="security_first">Security First</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Quality Threshold (%)
                      </label>
                      <Input
                        type="number"
                        min={50}
                        max={100}
                        value={qualityThreshold}
                        onChange={(e) => setQualityThreshold(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Max Iterations
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        value={maxIterations}
                        onChange={(e) => setMaxIterations(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    {/* Login Credentials (Phase 2) */}
                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                      <button
                        type="button"
                        onClick={() => setUseLogin(!useLogin)}
                        className="flex items-center gap-2 w-full text-left text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        {useLogin ? <FiToggleRight className="text-blue-500" size={20} /> : <FiToggleLeft className="text-gray-400" size={20} />}
                        <FiLock className="text-gray-500" size={14} />
                        Login (optional)
                      </button>

                      {useLogin && (
                        <div className="mt-3 space-y-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Use a test account only. Credentials are sent securely to the test runner.
                          </p>

                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Email / Username</label>
                            <div className="relative">
                              <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                              <Input
                                type="text"
                                placeholder="test@example.com"
                                value={loginCredentials.email}
                                onChange={(e) => setLoginCredentials(prev => ({ ...prev, email: e.target.value }))}
                                className="w-full pl-9"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Password</label>
                            <div className="relative">
                              <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                              <Input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={loginCredentials.password}
                                onChange={(e) => setLoginCredentials(prev => ({ ...prev, password: e.target.value }))}
                                className="w-full pl-9 pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Login URL (optional)</label>
                            <Input
                              type="text"
                              placeholder="Leave empty to use target URL"
                              value={loginCredentials.loginUrl}
                              onChange={(e) => setLoginCredentials(prev => ({ ...prev, loginUrl: e.target.value }))}
                              className="w-full text-sm"
                            />
                          </div>

                          <details className="text-xs">
                            <summary className="text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                              Custom selectors (advanced)
                            </summary>
                            <div className="mt-2 space-y-2">
                              <Input
                                type="text"
                                placeholder="Email selector (e.g., input[name='email'])"
                                value={loginCredentials.emailSelector}
                                onChange={(e) => setLoginCredentials(prev => ({ ...prev, emailSelector: e.target.value }))}
                                className="w-full text-xs"
                              />
                              <Input
                                type="text"
                                placeholder="Password selector"
                                value={loginCredentials.passwordSelector}
                                onChange={(e) => setLoginCredentials(prev => ({ ...prev, passwordSelector: e.target.value }))}
                                className="w-full text-xs"
                              />
                              <Input
                                type="text"
                                placeholder="Submit button selector"
                                value={loginCredentials.submitSelector}
                                onChange={(e) => setLoginCredentials(prev => ({ ...prev, submitSelector: e.target.value }))}
                                className="w-full text-xs"
                              />
                            </div>
                          </details>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Quick Context (paste)
                      </label>
                      <Textarea
                        placeholder="Paste API docs, user stories, or business rules here..."
                        value={documentContext}
                        onChange={(e) => setDocumentContext(e.target.value)}
                        rows={4}
                        className="w-full"
                      />
                    </div>

                    {/* Document Upload (Phase 4) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Documents (upload files)
                      </label>
                      <DocumentUpload
                        sessionId={activeSession?.id}
                        documents={documents.map(d => ({
                          id: d.id,
                          filename: d.filename,
                          fileType: d.file_type,
                          fileSizeBytes: d.file_size_bytes,
                          summary: d.summary || undefined,
                          chunkCount: d.chunk_count,
                          estimatedTokens: d.estimated_tokens || undefined,
                          isActive: d.is_active,
                          createdAt: d.created_at
                        }))}
                        onUpload={handleUploadDocument}
                        onDelete={handleDeleteDocument}
                        onToggle={handleToggleDocument}
                        disabled={!activeSession}
                      />
                      {!activeSession && (
                        <p className="text-xs text-gray-500 mt-1">Start a session to upload documents</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Upload PRDs, specs, or documentation to help the AI understand your application.
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleStartSession}
                  disabled={isStarting || !targetUrl}
                  className="w-full"
                >
                  {isStarting ? (
                    <span className="flex items-center gap-2">
                      <FiActivity className="animate-spin" />
                      Starting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <FiPlay />
                      Start Exploration
                    </span>
                  )}
                </Button>
              </div>
            </Card>

            {/* Recent Sessions */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FiClock className="text-blue-500" />
                Recent Sessions
              </h2>

              {isLoadingSessions ? (
                <div className="text-center py-4 text-gray-500">Loading...</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-4 text-gray-500">No sessions yet</div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${activeSession?.id === session.id
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md ring-1 ring-purple-300 dark:ring-purple-600'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {new URL(session.target_url).hostname}
                        </span>
                        <span className={`text-xs font-medium ${getStatusColor(session.status)}`}>
                          {session.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span>{session.pages_explored} pages</span>
                        <span>{session.tests_generated} tests</span>
                        <span>{session.bugs_found} bugs</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Middle Column - Live View */}
          <div className="lg:col-span-2 space-y-6">
            {activeSession ? (
              <>
                {/* Session Header */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <FiGlobe className="text-purple-500" />
                        {activeSession.target_url}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className={`flex items-center gap-1 ${getStatusColor(activeSession.status)}`}>
                          <FiActivity className={activeSession.status === 'running' ? 'animate-pulse' : ''} />
                          {activeSession.status}
                        </span>
                        <span>Iteration {iteration || activeSession.iteration_count}</span>
                        <span>Quality: {activeSession.quality_score}%</span>
                        {isConnected && <span className="text-green-500">Live</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeSession.status === 'running' && (
                        <Button variant="secondary" onClick={handlePauseSession}>
                          <FiPause className="mr-1" /> Pause
                        </Button>
                      )}
                      {activeSession.status === 'paused' && (
                        <Button variant="secondary" onClick={handleResumeSession}>
                          <FiPlay className="mr-1" /> Resume
                        </Button>
                      )}
                      {(activeSession.status === 'running' || activeSession.status === 'paused') && (
                        <Button variant="danger" onClick={handleStopSession}>
                          <FiStopCircle className="mr-1" /> Stop
                        </Button>
                      )}
                      {activeSession.status === 'completed' && (
                        <div className="flex gap-2">
                          <Button variant="secondary" onClick={() => handleRetest('quick')}>
                            <FiRefreshCw className="mr-1" /> Quick Retest
                          </Button>
                          <Button variant="secondary" onClick={() => handleRetest('smart')}>
                            <FiTarget className="mr-1" /> Smart Retest
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Stats Cards - Responsive grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
                  <Card className="p-4 text-center">
                    <FiGlobe className="mx-auto text-2xl text-blue-500 mb-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {pagesExplored.length || activeSession.pages_explored}
                    </div>
                    <div className="text-xs text-gray-500">Pages Explored</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <FiFileText className="mx-auto text-2xl text-green-500 mb-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {testsGenerated.length || activeSession.tests_generated}
                    </div>
                    <div className="text-xs text-gray-500">Tests Generated</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <FiAlertTriangle className="mx-auto text-2xl text-red-500 mb-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {bugsFound.length || activeSession.bugs_found}
                    </div>
                    <div className="text-xs text-gray-500">Bugs Found</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <FiShield className="mx-auto text-2xl text-orange-500 mb-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {chaosResults.filter(r => r.vulnerabilityConfirmed).length}
                    </div>
                    <div className="text-xs text-gray-500">Vulnerabilities</div>
                  </Card>
                  <Card className="p-4 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => setShowQualityDashboard(!showQualityDashboard)}>
                    <FiBarChart2 className="mx-auto text-2xl text-purple-500 mb-2" />
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {qualityScore.overall}%
                    </div>
                    <div className="text-xs text-gray-500">Quality Score</div>
                  </Card>
                </div>

                {/* Quality Dashboard (collapsible) */}
                {showQualityDashboard && (
                  <Card className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <FiBarChart2 className="text-purple-500" />
                      Quality Dashboard
                      <button
                        onClick={() => setShowQualityDashboard(false)}
                        className="ml-auto text-sm text-gray-500 hover:text-gray-700"
                      >
                        Hide
                      </button>
                    </h3>
                    <QualityDashboard
                      qualityScore={qualityScore}
                      risks={risks}
                      iterationHistory={iterationHistory}
                      currentIteration={iteration || activeSession.iteration_count}
                      targetThreshold={qualityThreshold}
                    />
                  </Card>
                )}

                {/* Live Browser Preview & AI Thinking */}
                <div className={`grid gap-6 ${expandedPreview ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {/* Browser Preview */}
                  <Card className={`p-4 ${expandedPreview ? 'col-span-full' : ''}`}>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <FiImage className="text-blue-500" />
                      Live Browser Preview
                      <button
                        onClick={() => setExpandedPreview(!expandedPreview)}
                        className="ml-auto text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={expandedPreview ? 'Minimize' : 'Maximize'}
                      >
                        {expandedPreview ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
                      </button>
                    </h3>
                    <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden ${expandedPreview ? 'h-96' : 'aspect-video'}`}>
                      {currentScreenshot ? (
                        <img
                          src={currentScreenshot}
                          alt="Browser preview"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                          {activeSession.status === 'running' ? (
                            <>
                              <FiActivity className="text-2xl mb-2 animate-pulse text-blue-500" />
                              <span className="text-sm">Preview will appear after the first page loads...</span>
                            </>
                          ) : (
                            <>
                              <FiImage className="text-2xl mb-2 opacity-50" />
                              <span className="text-sm">No preview available</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {currentUrl && (
                      <div className="mt-2 text-xs text-gray-500 truncate">
                        {currentUrl}
                      </div>
                    )}
                  </Card>

                  {/* AI Thinking - hidden when preview is expanded */}
                  {!expandedPreview && (
                    <Card className="p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <FiTerminal className="text-green-500" />
                        AI Thinking
                        <button
                          onClick={() => setShowThinking(!showThinking)}
                          className="ml-auto text-sm text-gray-500 hover:text-gray-700"
                        >
                          {showThinking ? 'Hide' : 'Show'}
                        </button>
                      </h3>
                      {showThinking && (
                        <div className="h-48 overflow-y-auto bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400">
                          {thinkingText || 'Waiting for AI response...'}
                        </div>
                      )}
                    </Card>
                  )}
                </div>

                {/* Tool Calls */}
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <FiActivity className="text-purple-500" />
                    Recent Tool Calls
                    <button
                      onClick={() => setShowToolCalls(!showToolCalls)}
                      className="ml-auto text-sm text-gray-500 hover:text-gray-700"
                    >
                      {showToolCalls ? 'Hide' : 'Show'}
                    </button>
                  </h3>
                  {showToolCalls && (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {toolCalls.length === 0 ? (
                        <div className="text-gray-500 text-sm">No tool calls yet</div>
                      ) : (
                        toolCalls.slice(-10).reverse().map((call, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                            <span className="font-mono text-purple-600 dark:text-purple-400">{call.tool}</span>
                            {call.result && (
                              <span className="text-green-500">✓</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </Card>

                {/* Results Tabs */}
                <Card className="p-4">
                  <ResultsTabs
                    testCases={sessionTestCases}
                    bugs={sessionBugs}
                    pages={sessionPages}
                    chaosResults={chaosResults}
                    chaosSummary={chaosSummary}
                    analyses={analyses}
                    correlations={correlations}
                    isRunning={activeSession.status === 'running'}
                  />
                </Card>
              </>
            ) : (
              /* No Active Session */
              <Card className="p-12 text-center">
                <FiZap className="mx-auto text-6xl text-purple-500 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Start Your First QA Loop
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Enter a URL on the left and let our AI autonomously explore your application,
                  generate test cases, and find bugs while you sleep.
                </p>
                <div className="flex justify-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <FiGlobe className="text-blue-500" /> Explores all pages
                  </div>
                  <div className="flex items-center gap-2">
                    <FiFileText className="text-green-500" /> Generates tests
                  </div>
                  <div className="flex items-center gap-2">
                    <FiAlertTriangle className="text-red-500" /> Finds bugs
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {wsError && (
          <Alert type="error" className="fixed bottom-4 right-4 max-w-md">
            {wsError}
          </Alert>
        )}
      </div>
    </div>
  );
};
