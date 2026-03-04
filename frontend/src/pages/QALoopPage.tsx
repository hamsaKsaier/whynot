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
import { Card }  from '../components/common/Card';
import { Button } from '../components/common/Button';
import {
  FiZap, FiGlobe, FiActivity, FiPlay, FiPause,
  FiStopCircle, FiRefreshCw, FiTarget,
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
    handleStartSession, handlePauseSession, handleResumeSession,
    handleStopSession, handleRetest, handleSelectSession,
    handleUploadDocument, handleDeleteDocument, handleToggleDocument,
    isConnected, currentScreenshot, currentUrl, thinkingText,
    toolCalls, iteration, pagesExplored, testsGenerated,
    streamBugsFound, wsError,
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
  }, [activeSession?.id]);

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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div>
        {/* Header */}
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
        {showOnboarding && !activeSession && (
          <div className="max-w-3xl mx-auto mb-6 rounded-xl border border-primary-200 bg-gradient-to-r from-primary-50 to-purple-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FiZap className="text-primary-600" /> How QA Loop works
                </h3>
                <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-600">
                  {[
                    { n: '1', title: 'Enter a URL',          sub: 'Any public or internal app' },
                    { n: '2', title: 'AI explores overnight', sub: 'Clicks, forms, edge cases' },
                    { n: '3', title: 'See results',           sub: 'Bugs, tests, quality score' },
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

        {/* Two-column layout when a session is active, single-column otherwise */}
        <div className={activeSession ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : 'max-w-3xl mx-auto space-y-6'}>

          {/* Left column — form + session list */}
          <div className="space-y-6">
            <SessionForm
              targetUrl={targetUrl}             setTargetUrl={setTargetUrl}
              qualityThreshold={qualityThreshold} setQualityThreshold={setQualityThreshold}
              maxIterations={maxIterations}       setMaxIterations={setMaxIterations}
              documentContext={documentContext}    setDocumentContext={setDocumentContext}
              testPriority={testPriority}         setTestPriority={setTestPriority}
              showAdvanced={showAdvanced}         setShowAdvanced={setShowAdvanced}
              useLogin={useLogin}                 setUseLogin={setUseLogin}
              loginCredentials={loginCredentials} setLoginCredentials={setLoginCredentials}
              showPassword={showPassword}         setShowPassword={setShowPassword}
              existingSession={existingSession}
              useExisting={useExisting}           setUseExisting={setUseExisting}
              documents={documents}
              activeSession={activeSession}
              onUpload={handleUploadDocument}
              onDelete={handleDeleteDocument}
              onToggle={handleToggleDocument}
              isStarting={isStarting}
              onStart={onStartClick}
            />

            <SessionList
              sessions={sessions}
              activeSession={activeSession}
              isLoading={isLoadingSessions}
              onSelect={handleSelectSession}
            />
          </div>

          {/* Right column — live view (only when a session is selected) */}
          {activeSession && (
            <div className="lg:col-span-2 space-y-6">
              {/* Session header */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
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
                isRunning={activeSession.status === 'running'}
                showThinking={showThinking}       setShowThinking={setShowThinking}
                showToolCalls={showToolCalls}     setShowToolCalls={setShowToolCalls}
                expandedPreview={expandedPreview} setExpandedPreview={setExpandedPreview}
              />

              {/* Results tabs */}
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
            </div>
          )}
        </div>

        {/* WebSocket error toast */}
        {wsError && (
          <Alert type="error" className="fixed bottom-4 right-4 max-w-md">
            {wsError}
          </Alert>
        )}
      </div>
    </div>
  );
};
