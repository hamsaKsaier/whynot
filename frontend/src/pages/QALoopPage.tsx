/**
 * QALoopPage — orchestrates the QA Loop feature.
 *
 * After 5.1 decomposition this file holds only:
 *  - form / UI-toggle state that is truly local to the page
 *  - the "check existing session" side-effect (debounced URL probe)
 *  - wiring between useSessionManager and the four sub-components
 *
 * Heavy data/API logic lives in useSessionManager.
 * Heavy UI lives in SessionForm / SessionList / StatsBar / LiveMonitor.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useToastContext } from '../contexts/ToastContext';
import { Alert } from '../components/common/Alert';
import { Button } from '../components/common/Button';
import {
  FiZap, FiGlobe, FiActivity, FiPlay, FiPause,
  FiStopCircle, FiRefreshCw, FiTarget, FiMenu,
} from 'react-icons/fi';

import { checkExistingSession } from '../services/qa-loop-api';
import { useSessionManager, StartSessionParams } from '../hooks/useSessionManager';

import {
  SessionForm,
  SessionList,
  StatsBar,
  LiveMonitor,
  ExistingSessionInfo,
  ChaosResultsTab,
  AnalysisTab,
} from '../components/QALoop';

// ── Inline ResultsTabs (was already local to QALoopPage, kept here) ────────────
import { QALoopTestCase, QALoopBug, QALoopPage as QAPage } from '../services/qa-loop-api';
import {
  ChaosResult, ChaosSummary, RootCauseAnalysis, FailureCorrelation,
} from '../components/QALoop';
import {
  FiFileText, FiAlertTriangle, FiShield, FiSearch, FiCheckCircle, FiClock,
} from 'react-icons/fi';

function safePathname(url: string | undefined | null, fallback?: string): string {
  try {
    if (!url) return fallback ?? '';
    return new URL(url).pathname || fallback || url;
  } catch {
    return fallback ?? url ?? '';
  }
}

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

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high':     return 'text-orange-600 bg-orange-100';
      case 'medium':   return 'text-yellow-600 bg-yellow-100';
      case 'low':      return 'text-blue-600 bg-blue-100';
      default:         return 'text-gray-600 bg-gray-100';
    }
  };

  const statusIcon = (s: string | null) => {
    if (s === 'passed') return <FiCheckCircle className="text-green-500" />;
    if (s === 'failed') return <FiAlertTriangle className="text-red-500" />;
    return <FiClock className="text-gray-400" />;
  };

  const vulns = chaosResults.filter(r => r.vulnerabilityConfirmed).length;

  const tab = (id: typeof activeTab, label: string, count: number, icon: React.ReactNode, activeClass: string) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`pb-2 flex items-center gap-1 ${activeTab === id ? `border-b-2 ${activeClass} font-medium` : 'text-gray-500 hover:text-gray-700'}`}
    >
      {icon}
      {label} ({count})
    </button>
  );

  return (
    <>
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-4 flex-wrap">
          {tab('tests',    'Tests',    testCases.length, <FiFileText className="text-sm" />,     'border-purple-500 text-purple-600')}
          {tab('bugs',     'Bugs',     bugs.length,      <FiAlertTriangle className="text-sm" />, 'border-red-500 text-red-600')}
          {tab('pages',    'Pages',    pages.length,     <FiGlobe className="text-sm" />,         'border-blue-500 text-blue-600')}
          {tab('chaos',    'Security', vulns,            <FiShield className="text-sm" />,        'border-orange-500 text-orange-600')}
          {tab('analysis', 'Analysis', analyses.length,  <FiSearch className="text-sm" />,        'border-green-500 text-green-600')}
        </nav>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {activeTab === 'tests' && (
          <div className="space-y-2">
            {testCases.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No test cases generated yet</div>
            ) : testCases.map(tc => (
              <div key={tc.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(tc.last_run_status)}
                    <span className="font-medium text-gray-900">{tc.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">{tc.category}</span>
                    <span className="text-xs text-gray-400">P{tc.priority}</span>
                  </div>
                </div>
                {tc.description && <p className="text-sm text-gray-500 mt-1 ml-6">{tc.description}</p>}
                <div className="text-xs text-gray-400 mt-1 ml-6 flex items-center gap-3">
                  <span>{tc.steps?.length || 0} steps</span>
                  {tc.last_run_status && (
                    <span className={tc.last_run_status === 'passed' ? 'text-green-500' : 'text-red-500'}>
                      Last: {tc.last_run_status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'bugs' && (
          <div className="space-y-2">
            {bugs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No bugs found yet — that's a good sign!</div>
            ) : bugs.map(bug => (
              <div key={bug.id} className="p-3 bg-gray-50 rounded-lg border-l-4 border-red-400">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{bug.title}</span>
                  <span className={`text-xs px-2 py-1 rounded ${severityColor(bug.severity)}`}>{bug.severity}</span>
                </div>
                {bug.description && <p className="text-sm text-gray-500 mt-1">{bug.description}</p>}
                <div className="text-xs text-gray-400 mt-2 flex items-center gap-3">
                  {bug.category && <span>{bug.category}</span>}
                  {bug.page_url && <span className="truncate max-w-xs">{safePathname(bug.page_url)}</span>}
                  <span className={bug.status === 'open' ? 'text-red-500' : 'text-green-500'}>{bug.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'pages' && (
          <div className="space-y-2">
            {pages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No pages explored yet</div>
            ) : pages.map(page => (
              <div key={page.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {page.is_explored
                      ? <FiCheckCircle className="text-green-500" />
                      : <FiClock className="text-yellow-500" />
                    }
                    <span className="font-medium text-gray-900 truncate max-w-md">
                      {page.title || safePathname(page.url, page.url)}
                    </span>
                  </div>
                  {page.page_type && (
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">{page.page_type}</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1 ml-6 truncate">{page.url}</div>
                {page.description && <p className="text-sm text-gray-500 mt-1 ml-6">{page.description}</p>}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'chaos' && (
          <ChaosResultsTab results={chaosResults} summary={chaosSummary} isRunning={isRunning} />
        )}
        {activeTab === 'analysis' && (
          <AnalysisTab analyses={analyses} correlations={correlations} />
        )}
      </div>
    </>
  );
};

// ── Status helpers ─────────────────────────────────────────────────────────────
function getStatusColor(status: string): string {
  switch (status) {
    case 'running':   return 'text-blue-500';
    case 'completed': return 'text-green-500';
    case 'paused':    return 'text-yellow-500';
    case 'failed':    return 'text-red-500';
    case 'cancelled': return 'text-gray-500';
    default:          return 'text-gray-400';
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────
export const QALoopPage: React.FC = () => {
  const { success, error: showError } = useToastContext();

  // ── Session manager (data / API / stream) ──────────────────────────────────
  const {
    sessions, activeSession,
    sessionTestCases, sessionBugs, sessionPages,
    chaosResults, chaosSummary, analyses, correlations,
    qualityScore, risks, iterationHistory,
    documents, isStarting, isLoadingSessions,
    isLoadingDetails,            // 6.3
    hasMoreSessions,             // 6.6
    isLoadingMoreSessions,       // 6.6
    loadMoreSessions,            // 6.6
    handleStartSession, handlePauseSession, handleResumeSession,
    handleStopSession, handleRetest, handleSelectSession,
    handleUploadDocument, handleDeleteDocument, handleToggleDocument,
    isConnected, currentScreenshot, currentUrl, thinkingText,
    toolCalls, testRunActivity, iteration, pagesExplored, testsGenerated,
    streamBugsFound, currentPhase, currentMessage, costInfo, sessionStartTime,
    wsError,
  } = useSessionManager({ onSuccess: success, onError: showError });

  // ── Form state (local — only this page + SessionForm need it) ───────────────
  const [targetUrl,        setTargetUrl]        = useState('');
  const [qualityThreshold, setQualityThreshold] = useState(80);
  const [maxIterations,    setMaxIterations]    = useState(100);
  const [documentContext,  setDocumentContext]  = useState('');
  const [useLogin,         setUseLogin]         = useState(false);
  const [loginCredentials, setLoginCredentials] = useState({
    email: '', password: '', loginUrl: '',
    emailSelector: '', passwordSelector: '', submitSelector: '',
  });
  const [showPassword,  setShowPassword]  = useState(false);
  const [testPriority,  setTestPriority]  = useState<'functional_first' | 'balanced' | 'security_first'>('functional_first');
  const [existingSession, setExistingSession] = useState<ExistingSessionInfo | null>(null);
  const [useExisting,   setUseExisting]   = useState(false);

  // ── Cinema sidebar toggle (collapsed by default when session is running) ───
  const [showSidebar, setShowSidebar] = useState(false);

  // Auto-collapse when a new session becomes active
  useEffect(() => {
    if (activeSession) setShowSidebar(false);
  }, [activeSession?.id]);

  // ── 6.2: Stop-session confirmation state ──────────────────────────────────
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // ── 6.1: WS error auto-dismiss state ──────────────────────────────────────
  const [wsErrorDismissed, setWsErrorDismissed] = useState(false);

  // ── UI-toggle state ────────────────────────────────────────────────────────
  const [showAdvanced,          setShowAdvanced]          = useState(true);
  const [showOnboarding,        setShowOnboarding]        = useState(
    () => !localStorage.getItem('qa-loop-onboarding-seen')
  );
  const [showThinking,          setShowThinking]          = useState(true);
  const [showToolCalls,         setShowToolCalls]         = useState(true);
  const [showQualityDashboard,  setShowQualityDashboard]  = useState(true);
  const [expandedPreview,       setExpandedPreview]       = useState(false);

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem('qa-loop-onboarding-seen', '1');
    setShowOnboarding(false);
  }, []);

  // Reset form "existing session" prompt when a new session becomes active
  useEffect(() => {
    if (activeSession) {
      setExistingSession(null);
      setUseExisting(false);
    }
    // 6.2 — cancel any pending stop-confirmation when the active session changes
    setShowStopConfirm(false);
  }, [activeSession?.id]);

  // 6.1 — auto-dismiss the WS error alert after 8 s; reset on new error
  useEffect(() => {
    if (!wsError) return;
    setWsErrorDismissed(false);
    const timer = setTimeout(() => setWsErrorDismissed(true), 8_000);
    return () => clearTimeout(timer);
  }, [wsError]);

  // Debounced check for existing sessions on the entered URL (4.7 — AbortController)
  useEffect(() => {
    const controller = new AbortController();

    const check = async () => {
      if (!targetUrl || targetUrl.length < 10) { setExistingSession(null); return; }
      try {
        const result = await checkExistingSession(targetUrl, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setExistingSession(result.exists && result.session ? result.session : null);
        }
      } catch {
        if (!controller.signal.aborted) setExistingSession(null);
      }
    };

    const timer = setTimeout(check, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [targetUrl]);

  // Build start params and delegate to session manager
  const onStartClick = useCallback(() => {
    if (!targetUrl) { showError('Please enter a target URL'); return; }
    const loginCreds = useLogin && loginCredentials.email && loginCredentials.password
      ? {
          email:             loginCredentials.email,
          password:          loginCredentials.password,
          loginUrl:          loginCredentials.loginUrl          || undefined,
          emailSelector:     loginCredentials.emailSelector     || undefined,
          passwordSelector:  loginCredentials.passwordSelector  || undefined,
          submitSelector:    loginCredentials.submitSelector     || undefined,
        }
      : undefined;
    handleStartSession({
      targetUrl,
      qualityThreshold,
      maxIterations,
      documentContext: documentContext || undefined,
      loginCredentials: loginCreds,
      testPriority,
      sourceSessionId: useExisting && existingSession ? existingSession.id : undefined,
    });
  }, [
    targetUrl, qualityThreshold, maxIterations, documentContext,
    useLogin, loginCredentials, testPriority, useExisting, existingSession,
    handleStartSession, showError,
  ]);

  // ── Shared session form props ───────────────────────────────────────────────
  const sessionFormProps = {
    targetUrl, setTargetUrl,
    qualityThreshold, setQualityThreshold,
    maxIterations, setMaxIterations,
    documentContext, setDocumentContext,
    testPriority, setTestPriority,
    showAdvanced, setShowAdvanced,
    useLogin, setUseLogin,
    loginCredentials, setLoginCredentials,
    showPassword, setShowPassword,
    existingSession,
    useExisting, setUseExisting,
    documents,
    activeSession,
    onUpload: handleUploadDocument,
    onDelete: handleDeleteDocument,
    onToggle: handleToggleDocument,
    isStarting,
    onStart: onStartClick,
  };

  const sessionListProps = {
    sessions,
    activeSession,
    isLoading: isLoadingSessions,
    onSelect: handleSelectSession,
    hasMore: hasMoreSessions,
    isLoadingMore: isLoadingMoreSessions,
    onLoadMore: loadMoreSessions,
  };

  // ── WS error toast (shared between modes) ──────────────────────────────────
  const wsErrorToast = wsError && !wsErrorDismissed && (
    <Alert
      type="error"
      message={wsError}
      onClose={() => setWsErrorDismissed(true)}
      className="fixed bottom-4 right-4 max-w-md z-50 shadow-lg"
    />
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  // ══ CINEMA MODE — full-width immersive layout when session is active ════════
  if (activeSession) {
    return (
      <>
        {wsErrorToast}

        {/*
         * Escape the MainLayout's p-4 sm:p-6 padding so we get edge-to-edge.
         * bg-gray-950 gives a deep dark cinema feel.
         * overflow-hidden prevents the cinema container itself from adding scroll.
         */}
        <div
          className="flex flex-col bg-gray-950 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 overflow-hidden"
          style={{ height: 'calc(100vh - 64px)' }}
        >

          {/* ── Cinema Top Bar ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900/95 border-b border-gray-800/80 shrink-0 backdrop-blur-sm">

            {/* Sidebar toggle */}
            <button
              onClick={() => setShowSidebar(v => !v)}
              className="text-gray-400 hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-700/50 transition-colors shrink-0"
              title={showSidebar ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <FiMenu size={16} />
            </button>

            {/* Session URL */}
            <FiGlobe className="text-purple-400 shrink-0" size={14} />
            <span className="text-sm font-semibold text-gray-200 truncate max-w-xs">
              {activeSession.target_url}
            </span>

            {/* Status pill */}
            <span className={`flex items-center gap-1.5 text-xs shrink-0 px-2 py-0.5 rounded-full border ${
              activeSession.status === 'running'
                ? 'border-blue-700/50 bg-blue-950/50 text-blue-300'
                : activeSession.status === 'paused'
                ? 'border-yellow-700/50 bg-yellow-950/50 text-yellow-300'
                : activeSession.status === 'completed'
                ? 'border-green-700/50 bg-green-950/50 text-green-300'
                : 'border-gray-700/50 bg-gray-800/50 text-gray-400'
            }`}>
              <FiActivity
                size={11}
                className={activeSession.status === 'running' ? 'animate-pulse' : ''}
              />
              {activeSession.status}
            </span>

            {/* Iteration counter */}
            <span className="text-xs text-gray-500 shrink-0">
              Iter <span className="text-gray-300 font-semibold">{iteration || activeSession.iteration_count}</span>
            </span>

            {/* Quality score */}
            {activeSession.quality_score > 0 && (
              <span className="text-xs text-gray-500 shrink-0">
                Q: <span className="text-purple-300 font-semibold">{activeSession.quality_score}%</span>
              </span>
            )}

            {/* Live indicator */}
            {isConnected && (
              <span className="text-xs text-green-400 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            )}

            {/* ── Controls (right-aligned) ── */}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {activeSession.status === 'running' && (
                <Button variant="secondary" onClick={handlePauseSession}>
                  <FiPause className="mr-1" size={12} /> Pause
                </Button>
              )}
              {activeSession.status === 'paused' && (
                <Button variant="secondary" onClick={handleResumeSession}>
                  <FiPlay className="mr-1" size={12} /> Resume
                </Button>
              )}
              {(activeSession.status === 'running' || activeSession.status === 'paused') && (
                showStopConfirm ? (
                  <div className="flex items-center gap-2 bg-red-950/60 border border-red-800/60 rounded-lg px-3 py-1">
                    <span className="text-xs text-red-400 font-medium">Stop session?</span>
                    <Button
                      variant="danger"
                      onClick={() => { setShowStopConfirm(false); handleStopSession(); }}
                    >
                      Yes, stop
                    </Button>
                    <Button variant="secondary" onClick={() => setShowStopConfirm(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="danger" onClick={() => setShowStopConfirm(true)}>
                    <FiStopCircle className="mr-1" size={12} /> Stop
                  </Button>
                )
              )}
              {activeSession.status === 'completed' && (
                <>
                  <Button variant="secondary" onClick={() => handleRetest('quick')}>
                    <FiRefreshCw className="mr-1" size={12} /> Quick Retest
                  </Button>
                  <Button variant="secondary" onClick={() => handleRetest('smart')}>
                    <FiTarget className="mr-1" size={12} /> Smart Retest
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* ── Body: Sidebar + Main Area ──────────────────────────────────── */}
          <div className="flex flex-1 overflow-hidden relative">

            {/* Loading overlay while session details fetched */}
            {isLoadingDetails && (
              <div className="absolute inset-0 bg-gray-950/70 flex items-center justify-center z-20 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-gray-300 bg-gray-900 px-4 py-2 rounded-full shadow-xl border border-gray-700">
                  <FiRefreshCw className="animate-spin text-purple-400" size={14} />
                  <span className="text-sm font-medium">Loading session…</span>
                </div>
              </div>
            )}

            {/* ── Collapsible Sidebar ──────────────────────────────────────── */}
            <div
              className={`shrink-0 bg-gray-900/40 border-r border-gray-800/60 overflow-hidden transition-all duration-300 ease-in-out`}
              style={{ width: showSidebar ? '320px' : '0px' }}
            >
              <div className="w-80 h-full overflow-y-auto p-4 space-y-4">
                <SessionForm {...sessionFormProps} />
                <SessionList {...sessionListProps} />
              </div>
            </div>

            {/* ── Main Cinema Area ─────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">

                {/* Stats + Quality Dashboard */}
                <StatsBar
                  activeSession={activeSession}
                  pagesExplored={pagesExplored}
                  testsGenerated={testsGenerated}
                  bugsFound={streamBugsFound}
                  chaosResults={chaosResults}
                  qualityScore={qualityScore}
                  risks={risks}
                  iterationHistory={iterationHistory}
                  iteration={iteration}
                  qualityThreshold={qualityThreshold}
                  showQualityDashboard={showQualityDashboard}
                  onToggleQualityDashboard={() => setShowQualityDashboard(v => !v)}
                />

                {/* Live browser preview + AI thinking + tool calls */}
                <LiveMonitor
                  currentScreenshot={currentScreenshot}
                  currentUrl={currentUrl}
                  thinkingText={thinkingText}
                  toolCalls={toolCalls}
                  testRunActivity={testRunActivity}
                  isRunning={activeSession.status === 'running'}
                  showThinking={showThinking}       setShowThinking={setShowThinking}
                  showToolCalls={showToolCalls}     setShowToolCalls={setShowToolCalls}
                  expandedPreview={expandedPreview} setExpandedPreview={setExpandedPreview}
                  currentPhase={currentPhase}
                  currentMessage={currentMessage}
                  costInfo={costInfo}
                  sessionStartTime={sessionStartTime}
                  iteration={iteration || activeSession.iteration_count}
                  pagesExplored={pagesExplored.length || sessionPages.filter(p => p.is_explored).length}
                  testsGenerated={testsGenerated.length || sessionTestCases.length}
                  bugsFound={streamBugsFound?.length || sessionBugs.length}
                />

                {/* Results tabs — wrapped in a light-bg card for readability */}
                <div className="rounded-xl overflow-hidden border border-gray-700/40 bg-white shadow-sm">
                  <div className="p-4">
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
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ══ NORMAL MODE — centered form when no session active ═════════════════════
  return (
    <div>
      {wsErrorToast}

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FiZap className="text-purple-500" />
          QA Loop
        </h1>
        <p className="text-gray-600 mt-2">
          Autonomous exploration and testing powered by AI. Point at a URL, let it explore overnight.
        </p>
      </div>

      {/* First-run onboarding banner */}
      {showOnboarding && (
        <div className="max-w-3xl mx-auto mb-6 rounded-xl border border-primary-200 bg-gradient-to-r from-primary-50 to-purple-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FiZap className="text-primary-600" /> How QA Loop works
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-600">
                {[
                  { n: '1', title: 'Enter a URL',           sub: 'Any public or internal app' },
                  { n: '2', title: 'AI explores overnight',  sub: 'Clicks, forms, edge cases' },
                  { n: '3', title: 'See results',            sub: 'Bugs, tests, quality score' },
                ].map(({ n, title, sub }, i) => (
                  <React.Fragment key={n}>
                    {i > 0 && <div className="hidden sm:block text-gray-300 self-center">→</div>}
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold mt-0.5">{n}</span>
                      <div>
                        <p className="font-medium text-gray-800">{title}</p>
                        <p className="text-xs text-gray-500">{sub}</p>
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <button
              onClick={dismissOnboarding}
              className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
              aria-label="Dismiss"
            >
              Got it ✕
            </button>
          </div>
        </div>
      )}

      {/* Session form + list */}
      <div className="max-w-3xl mx-auto space-y-6">
        <SessionForm {...sessionFormProps} />
        <SessionList {...sessionListProps} />
      </div>
    </div>
  );
};
