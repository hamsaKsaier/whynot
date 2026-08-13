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
import { useTranslation } from 'react-i18next';
import { useToastContext } from '../contexts/ToastContext';
import {
  Zap, Globe, Activity, Play, Pause,
  CircleStop, RefreshCw, Target, Menu, Loader2, Download,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { cn } from '../lib/utils';

import { checkExistingSession, exportSessionTestSuite } from '../services/qa-loop-api';
import { getProjects, getProjectContext, ProjectWithStats } from '../services/api';
import { useSessionManager, StartSessionParams } from '../hooks/useSessionManager';

import {
  SessionForm,
  SessionList,
  StatsBar,
  LiveMonitor,
  ExistingSessionInfo,
  ResultsTabs,
  AgentProgressPanel,
  CommandCenter,
  TeamBoard,
} from '../components/QALoop';

// -- Status helpers -----------------------------------------------------------
function getStatusColor(status: string): string {
  switch (status) {
    case 'running':   return 'text-blue-500';
    case 'completed': return 'text-green-500';
    case 'paused':    return 'text-yellow-500';
    case 'failed':    return 'text-destructive';
    case 'cancelled': return 'text-muted-foreground';
    default:          return 'text-muted-foreground';
  }
}

// -- Page ---------------------------------------------------------------------
export const QALoopPage: React.FC = () => {
  const { t } = useTranslation('runner');
  const { success, error: showError } = useToastContext();

  // -- Session manager (data / API / stream) ----------------------------------
  const {
    sessions, activeSession,
    sessionTestCases, sessionBugs, sessionPages,
    chaosResults, chaosSummary, analyses, correlations,
    qualityScore, risks, iterationHistory,
    documents, isStarting, isLoadingSessions,
    isLoadingDetails,
    hasMoreSessions,
    isLoadingMoreSessions,
    loadMoreSessions,
    handleStartSession, handlePauseSession, handleResumeSession,
    handleStopSession, handleRetest, handleSelectSession,
    handleUploadDocument, handleDeleteDocument, handleToggleDocument,
    isConnected, currentScreenshot, currentUrl, thinkingText,
    toolCalls, testRunActivity, iteration, pagesExplored, testsGenerated,
    streamBugsFound, currentPhase, currentMessage, costInfo, sessionStartTime,
    wsError,
    // v4 Phase 3 per-agent slices
    agentStreams, leadDispatches,
  } = useSessionManager({ onSuccess: success, onError: showError });

  // v4 Phase 3 Command Center view toggle. Opt-in via URL param
  // `?view=command-center`. Falls back to the legacy LiveMonitor so
  // nothing changes for users who haven't enabled the new view yet.
  const commandCenterEnabled = React.useMemo(() => {
    try { return new URLSearchParams(window.location.search).get('view') === 'command-center'; }
    catch { return false; }
  }, []);

  // -- Form state (local -- only this page + SessionForm need it) -------------
  const [targetUrl,        setTargetUrl]        = useState('');
  const [qualityThreshold, setQualityThreshold] = useState(80);
  const [maxIterations,    setMaxIterations]    = useState(3);
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
  const [useProjectContext, setUseProjectContext] = useState(true);
  const [projectContextInfo, setProjectContextInfo] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'v1' | 'v2'>('v2'); // Default to v2 for investor demo

  // -- Project state ----------------------------------------------------------
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  useEffect(() => {
    getProjects().then(res => setProjects(res.projects)).catch(() => {});
  }, []);

  // Load project context info when project changes (Feature 9)
  useEffect(() => {
    if (!selectedProjectId) { setProjectContextInfo(null); return; }
    getProjectContext(selectedProjectId)
      .then(res => {
        const ctx = res.context || {};
        const pages = ctx.known_pages?.length || 0;
        const bugs = ctx.known_bugs?.length || 0;
        const scans = ctx.total_scans || 0;
        if (pages > 0 || bugs > 0) {
          setProjectContextInfo(t('runner.qaLoop.projectContextInfo', { pages, bugs, scans }));
        } else {
          setProjectContextInfo(null);
        }
      })
      .catch(() => setProjectContextInfo(null));
  }, [selectedProjectId]);

  // -- Cinema sidebar toggle (collapsed by default when session is running) ---
  const [showSidebar, setShowSidebar] = useState(false);

  // Auto-collapse when a new session becomes active
  useEffect(() => {
    if (activeSession) setShowSidebar(false);
  }, [activeSession?.id]);

  // -- 6.2: Stop-session confirmation state -----------------------------------
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // -- 6.1: WS error auto-dismiss state --------------------------------------
  const [wsErrorDismissed, setWsErrorDismissed] = useState(false);

  // -- UI-toggle state --------------------------------------------------------
  const [showAdvanced,          setShowAdvanced]          = useState(false);
  const [showOnboarding,        setShowOnboarding]        = useState(
    () => !localStorage.getItem('qa-loop-onboarding-seen')
  );
  const [showThinking,          setShowThinking]          = useState(true);
  const [showToolCalls,         setShowToolCalls]         = useState(true);
  const [showQualityDashboard,  setShowQualityDashboard]  = useState(false);
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
    // 6.2 -- cancel any pending stop-confirmation when the active session changes
    setShowStopConfirm(false);
  }, [activeSession?.id]);

  // 6.1 -- auto-dismiss the WS error alert after 8 s; reset on new error
  useEffect(() => {
    if (!wsError) return;
    setWsErrorDismissed(false);
    const timer = setTimeout(() => setWsErrorDismissed(true), 8_000);
    return () => clearTimeout(timer);
  }, [wsError]);

  // Debounced check for existing sessions on the entered URL (4.7 -- AbortController)
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
  const onStartClick = useCallback(async () => {
    if (!targetUrl) { showError(t('runner.qaLoop.errors.enterTargetUrl')); return; }
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
    await handleStartSession({
      targetUrl,
      qualityThreshold,
      maxIterations,
      documentContext: documentContext || undefined,
      loginCredentials: loginCreds,
      testPriority,
      sourceSessionId: useExisting && existingSession ? existingSession.id : undefined,
      projectId: selectedProjectId || undefined,
      config: scanMode === 'v2' ? { scan_mode: 'v2' } : undefined,
    });
    // Auto-scroll to the live monitor / cinema mode after session starts.
    // Retry until the element exists since cinema mode replaces the page.
    const scrollToLiveMonitor = (retries = 0) => {
      const target = document.getElementById('session-detail')
        || document.querySelector('[class*="cinema"], [class*="live-monitor"], [class*="session-detail"]');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (retries < 15) {
        setTimeout(() => scrollToLiveMonitor(retries + 1), 300);
      }
    };
    setTimeout(() => scrollToLiveMonitor(), 500);
  }, [
    targetUrl, qualityThreshold, maxIterations, documentContext,
    useLogin, loginCredentials, testPriority, useExisting, existingSession,
    handleStartSession, showError,
  ]);

  // -- Shared session form props ----------------------------------------------
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
    projects,
    selectedProjectId, setSelectedProjectId,
    documents,
    activeSession,
    onUpload: handleUploadDocument,
    onDelete: handleDeleteDocument,
    onToggle: handleToggleDocument,
    isStarting,
    onStart: onStartClick,
    useProjectContext,
    setUseProjectContext,
    projectContextInfo,
    scanMode,
    setScanMode,
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

  // -- WS error toast (shared between modes) ----------------------------------
  const wsErrorToast = wsError && !wsErrorDismissed && (
    <Alert
      variant="destructive"
      className="fixed bottom-4 end-4 max-w-md z-50 shadow-sm"
    >
      <AlertDescription className="flex items-center justify-between gap-2">
        <span>{wsError}</span>
        <Button variant="ghost" size="sm" onClick={() => setWsErrorDismissed(true)}>
          {t('runner.qaLoop.dismiss')}
        </Button>
      </AlertDescription>
    </Alert>
  );

  // -- Render -----------------------------------------------------------------

  // == CINEMA MODE -- full-width immersive layout when session is active ========
  if (activeSession) {
    const statusBadgeMap: Record<string, { variant: 'default' | 'secondary' | 'outline'; className: string }> = {
      running:   { variant: 'outline', className: 'border-blue-700/50 bg-blue-950/50 text-blue-300' },
      paused:    { variant: 'outline', className: 'border-yellow-700/50 bg-yellow-950/50 text-yellow-300' },
      completed: { variant: 'outline', className: 'border-green-700/50 bg-green-950/50 text-green-300' },
    };
    const statusInfo = statusBadgeMap[activeSession.status] || { variant: 'secondary' as const, className: '' };

    return (
      <>
        {wsErrorToast}

        {/*
         * Escape the MainLayout's p-4 sm:p-6 padding so we get edge-to-edge.
         * bg-card gives a deep dark cinema feel.
         * overflow-hidden prevents the cinema container itself from adding scroll.
         */}
        <div
          id="session-detail"
          className="flex flex-col bg-card -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 overflow-hidden"
          style={{ height: 'calc(100vh - 64px)' }}
        >

          {/* -- Cinema Top Bar ------------------------------------------------ */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 bg-muted border-b border-border shrink-0">

            {/* Sidebar toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setShowSidebar(v => !v)}
              title={showSidebar ? t('runner.qaLoop.cinema.collapseSidebar') : t('runner.qaLoop.cinema.expandSidebar')}
            >
              <Menu size={16} />
            </Button>

            {/* Session URL */}
            <Globe className="text-primary shrink-0 hidden sm:block" size={14} />
            <span className="text-xs sm:text-sm font-semibold text-foreground truncate max-w-[120px] sm:max-w-xs">
              {activeSession.target_url}
            </span>

            {/* Status pill */}
            <Badge variant={statusInfo.variant} className={cn('gap-1 sm:gap-1.5 text-[10px] sm:text-xs', statusInfo.className)}>
              <Activity size={11} />
              {activeSession.status}
            </Badge>

            {/* Iteration counter */}
            <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0 hidden sm:inline">
              {t('runner.qaLoop.cinema.iteration')} <span className="font-semibold">{iteration || activeSession.iteration_count}</span>
            </span>

            {/* Quality score */}
            {activeSession.quality_score > 0 && (
              <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0 hidden sm:inline">
                Q: <span className="text-primary font-semibold">{activeSession.quality_score}%</span>
              </span>
            )}

            {/* Live indicator */}
            {isConnected && (
              <span className="text-[10px] sm:text-xs text-green-400 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                LIVE
              </span>
            )}

            {/* -- Controls (right-aligned) -- */}
            <div className="ms-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
              {activeSession.status === 'running' && (
                <Button variant="secondary" size="sm" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3" onClick={handlePauseSession}>
                  <Pause className="me-1" size={12} /> <span className="hidden sm:inline">{t('runner.controls.pause')}</span>
                </Button>
              )}
              {activeSession.status === 'paused' && (
                <Button variant="secondary" size="sm" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3" onClick={handleResumeSession}>
                  <Play className="me-1" size={12} /> <span className="hidden sm:inline">{t('runner.controls.resume')}</span>
                </Button>
              )}
              {(activeSession.status === 'running' || activeSession.status === 'paused') && (
                <Button variant="destructive" size="sm" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3" onClick={() => setShowStopConfirm(true)}>
                  <CircleStop className="me-1" size={12} /> <span className="hidden sm:inline">{t('runner.controls.stop')}</span>
                </Button>
              )}
              {activeSession.status === 'completed' && (
                <>
                  <Button variant="secondary" size="sm" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3" onClick={() => handleRetest('quick')}>
                    <RefreshCw className="me-1" size={12} /> <span className="hidden sm:inline">{t('runner.qaLoop.cinema.quickRetest')}</span>
                  </Button>
                  <Button variant="secondary" size="sm" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3" onClick={() => handleRetest('smart')}>
                    <Target className="me-1" size={12} /> <span className="hidden sm:inline">{t('runner.qaLoop.cinema.smartRetest')}</span>
                  </Button>
                </>
              )}
              {sessionTestCases.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await exportSessionTestSuite(activeSession.id);
                      success('Downloading test suite…');
                    } catch (err: any) {
                      showError(err?.message || 'Failed to download test suite');
                    }
                  }}
                  title="Download a ready-to-run Playwright project (ZIP)"
                >
                  <Download className="me-1" size={12} /> Download Test Suite
                </Button>
              )}
            </div>
          </div>

          {/* Stop confirmation dialog */}
          <Dialog open={showStopConfirm} onOpenChange={setShowStopConfirm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('runner.qaLoop.cinema.stopSession')}</DialogTitle>
                <DialogDescription>
                  {t('runner.qaLoop.cinema.stopConfirmation')}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setShowStopConfirm(false)}>
                  {t('runner.qaLoop.cinema.cancel')}
                </Button>
                <Button variant="destructive" onClick={() => { setShowStopConfirm(false); handleStopSession(); }}>
                  {t('runner.qaLoop.cinema.yesStop')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* -- Body: Sidebar + Main Area ------------------------------------- */}
          <div className="flex flex-1 overflow-hidden relative">

            {/* Loading overlay while session details fetched */}
            {isLoadingDetails && (
              <div className="absolute inset-0 bg-card/70 flex items-center justify-center z-20">
                <div className="flex items-center gap-2 text-muted-foreground bg-muted px-4 py-2 rounded-lg shadow-sm border border-border">
                  <Loader2 className="animate-spin text-primary" size={14} />
                  <span className="text-sm font-medium">{t('runner.qaLoop.cinema.loadingSession')}</span>
                </div>
              </div>
            )}

            {/* -- Collapsible Sidebar (overlay on mobile, push on lg+) --------- */}
            {showSidebar && (
              <div
                className="fixed inset-0 bg-black/40 z-30 lg:hidden"
                onClick={() => setShowSidebar(false)}
              />
            )}
            <div
              className={cn(
                'shrink-0 bg-muted/40 border-e border-border overflow-hidden transition-[width] duration-200 ease-in-out',
                'fixed top-0 start-0 h-full z-40 lg:relative lg:z-auto',
              )}
              style={{ width: showSidebar ? '320px' : '0px' }}
            >
              <div className="w-80 h-full overflow-y-auto p-4 space-y-4">
                <SessionForm {...sessionFormProps} />
                <SessionList {...sessionListProps} />
              </div>
            </div>

            {/* -- Main Cinema Area -------------------------------------------- */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4" aria-live="polite">

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

                {/* The QA team board — the primary way to watch a multi-agent
                    scan. Rendered as soon as any agent has reported in, so it
                    never shows an empty org chart during a single-agent scan
                    (which has no per-agent streams to display). */}
                {Object.keys(agentStreams || {}).length > 0 && (
                  <TeamBoard
                    agentStreams={agentStreams || {}}
                    leadDispatches={leadDispatches || []}
                    findings={streamBugsFound || []}
                    isRunning={activeSession.status === 'running'}
                  />
                )}

                {/* v4 Phase 3: 4-quadrant Command Center view (opt-in via ?view=command-center) */}
                {commandCenterEnabled && (
                  <CommandCenter
                    agentStreams={agentStreams || {}}
                    leadDispatches={leadDispatches || []}
                    sessionStartTime={sessionStartTime}
                    isRunning={activeSession.status === 'running'}
                  />
                )}

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

                {/* Agent progress panel for v2 multi-agent scans */}
                {activeSession?.config?.scan_mode === 'v2' && (
                  <AgentProgressPanel
                    sessionId={activeSession.id}
                    isRunning={activeSession.status === 'running'}
                  />
                )}

                {/* Results tabs -- wrapped in a card for readability */}
                <Card className="overflow-hidden">
                  <CardContent className="p-4">
                    <ResultsTabs
                      testCases={sessionTestCases}
                      bugs={sessionBugs}
                      pages={sessionPages}
                      chaosResults={chaosResults}
                      chaosSummary={chaosSummary}
                      analyses={analyses}
                      correlations={correlations}
                      isRunning={activeSession.status === 'running'}
                      projectId={activeSession.project_id}
                      reportData={activeSession.report_data}
                    />
                  </CardContent>
                </Card>

              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // == NORMAL MODE -- centered form when no session active ====================
  return (
    <div>
      {wsErrorToast}

      {/* Page header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2 sm:gap-3">
          <Zap className="text-primary shrink-0" />
          {t('runner.qaLoop.title')}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1.5 sm:mt-2">
          {t('runner.qaLoop.subtitle')}
        </p>
      </div>

      {/* First-run onboarding banner */}
      {showOnboarding && (
        <Card className="max-w-3xl mx-auto mb-4 sm:mb-6 border-primary/30">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Zap className="text-primary shrink-0" /> {t('runner.qaLoop.onboarding.title')}
                </h3>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 text-sm text-muted-foreground">
                  {[
                    { n: '1', title: t('runner.qaLoop.onboarding.step1Title'), sub: t('runner.qaLoop.onboarding.step1Sub') },
                    { n: '2', title: t('runner.qaLoop.onboarding.step2Title'), sub: t('runner.qaLoop.onboarding.step2Sub') },
                    { n: '3', title: t('runner.qaLoop.onboarding.step3Title'), sub: t('runner.qaLoop.onboarding.step3Sub') },
                  ].map(({ n, title, sub }, i) => (
                    <React.Fragment key={n}>
                      {i > 0 && <div className="hidden sm:block text-muted-foreground self-center">&#8594;</div>}
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold mt-0.5">{n}</span>
                        <div>
                          <p className="font-medium text-foreground text-sm">{title}</p>
                          <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissOnboarding}
                aria-label={t('runner.qaLoop.dismiss')}
                className="shrink-0"
              >
                {t('runner.qaLoop.onboarding.gotIt')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session form + list */}
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
        <SessionForm {...sessionFormProps} />
        <SessionList {...sessionListProps} />
      </div>
    </div>
  );
};
