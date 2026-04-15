import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiZap, FiCheck, FiAlertTriangle, FiLoader, FiExternalLink,
  FiChevronDown, FiChevronUp, FiMonitor, FiSearch, FiCpu,
  FiFileText, FiGlobe, FiX
} from 'react-icons/fi';
import { config } from '@/config';

const API_BASE = config.apiUrl;

interface ScanSession {
  id: string;
  target_url: string;
  status: string;
  quality_score: number;
  bugs_found: number;
  tests_generated: number;
  pages_explored: number;
  created_at: string;
  completed_at: string | null;
}

interface ScanBug {
  id: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string | null;
  page_url: string | null;
  reproduction_steps: any[];
}

interface ScanTestCase {
  id: string;
  name: string;
  category: string;
  last_run_status: string | null;
  source_page_url: string | null;
}

const severityColor: Record<string, string> = {
  critical: 'bg-red-900/30 text-red-400',
  high: 'bg-orange-900/30 text-orange-400',
  medium: 'bg-yellow-900/30 text-yellow-400',
  low: 'bg-blue-900/30 text-blue-400',
};

// Animated activity messages while scanning
const SCAN_ACTIVITY_KEYS = [
  { icon: FiGlobe, key: 'runner.qaLoop.public.activity.crawling' },
  { icon: FiSearch, key: 'runner.qaLoop.public.activity.analyzingUI' },
  { icon: FiCpu, key: 'runner.qaLoop.public.activity.generatingTests' },
  { icon: FiFileText, key: 'runner.qaLoop.public.activity.runningTests' },
  { icon: FiSearch, key: 'runner.qaLoop.public.activity.accessibility' },
  { icon: FiCpu, key: 'runner.qaLoop.public.activity.validatingForms' },
  { icon: FiGlobe, key: 'runner.qaLoop.public.activity.testingNavigation' },
  { icon: FiFileText, key: 'runner.qaLoop.public.activity.analyzingErrors' },
];

export const PublicScanResultsPage: React.FC = () => {
  const { t } = useTranslation('runner');
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<ScanSession | null>(null);
  const [bugs, setBugs] = useState<ScanBug[]>([]);
  const [testCases, setTestCases] = useState<ScanTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedBug, setExpandedBug] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [activityIndex, setActivityIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'bugs' | 'tests'>('tests');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activityRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/public/scan/${sessionId}`);
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'Scan not found' : 'Failed to load scan results');
      }
      const data = await res.json();
      setSession(data.session);
      setBugs(data.bugs || []);
      setTestCases(data.testCases || []);

      // Stop polling if completed
      if (['completed', 'stopped', 'failed'].includes(data.session?.status)) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        if (activityRef.current) {
          clearInterval(activityRef.current);
          activityRef.current = null;
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    fetchData();
    pollRef.current = setInterval(fetchData, 5000);
    // Rotate activity messages
    activityRef.current = setInterval(() => {
      setActivityIndex(i => (i + 1) % SCAN_ACTIVITY_KEYS.length);
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (activityRef.current) clearInterval(activityRef.current);
    };
  }, [sessionId]);

  const isRunning = session && ['running', 'pending', 'paused'].includes(session.status);
  const isComplete = session && ['completed', 'stopped', 'failed'].includes(session.status);
  const qualityColor = !session ? 'text-muted-foreground' :
    session.quality_score >= 80 ? 'text-green-600 dark:text-green-400' :
    session.quality_score >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';

  const elapsedTime = session ? Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000) : 0;
  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="h-8 w-8 animate-spin text-sky-600 mx-auto mb-3" />
          <p className="text-muted-foreground">{t('runner.qaLoop.public.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <FiAlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/landing')}
            className="text-primary hover:text-primary/80 font-medium transition-colors duration-150"
          >
            {t('runner.qaLoop.public.backToHome')}
          </button>
        </div>
      </div>
    );
  }

  const ActivityMessage = SCAN_ACTIVITY_KEYS[activityIndex];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <button onClick={() => navigate('/landing')} className="flex items-center gap-2 hover:opacity-80 shrink-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <FiZap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg sm:text-xl font-bold text-foreground">WhyNot</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            {isRunning && (
              <span className="text-xs text-muted-foreground hidden sm:inline">{t('runner.qaLoop.public.elapsed', { time: formatElapsed(elapsedTime) })}</span>
            )}
            <button
              onClick={() => navigate('/login')}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors duration-150"
            >
              {t('runner.qaLoop.public.signUpFullAccess')}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Two-column layout: Results + Preview */}
        <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${showPreview && session?.target_url ? 'md:grid-cols-2' : 'max-w-5xl mx-auto'}`}>
          {/* Left column: Results */}
          <div className="space-y-4 sm:space-y-5">
            {/* Header + Stats */}
            <div className="bg-card rounded-lg border border-border p-4 sm:p-5">
              <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl font-bold text-foreground mb-1">{t('runner.qaLoop.public.scanResults')}</h1>
                  <a
                    href={session?.target_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 truncate transition-colors duration-150"
                  >
                    {session?.target_url}
                    <FiExternalLink className="h-3 w-3 flex-shrink-0 rtl:scale-x-[-1]" />
                  </a>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!showPreview && session?.target_url && (
                    <button
                      onClick={() => setShowPreview(true)}
                      className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors duration-150"
                      title="Show site preview"
                    >
                      <FiMonitor className="h-4 w-4" />
                    </button>
                  )}
                  {isRunning && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md text-xs sm:text-sm font-medium">
                      <FiLoader className="h-3.5 w-3.5 animate-spin" />
                      {t('runner.qaLoop.public.scanning')}
                    </div>
                  )}
                  {isComplete && session?.status === 'completed' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/20 text-green-400 rounded-md text-xs sm:text-sm font-medium">
                      <FiCheck className="h-3.5 w-3.5" />
                      {t('runner.qaLoop.public.complete')}
                    </div>
                  )}
                  {isComplete && session?.status === 'failed' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 text-red-400 rounded-md text-xs sm:text-sm font-medium">
                      <FiAlertTriangle className="h-3.5 w-3.5" />
                      {t('runner.qaLoop.public.failed')}
                    </div>
                  )}
                </div>
              </div>

              {/* Live activity indicator */}
              {isRunning && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300 transition-colors duration-150">
                  <ActivityMessage.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{t(ActivityMessage.key)}</span>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                  <div className={`text-xl sm:text-2xl font-bold ${qualityColor}`}>
                    {session?.quality_score ?? '—'}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-1">{t('runner.qaLoop.stats.qualityScore')}</div>
                </div>
                <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-red-600">{session?.bugs_found ?? 0}</div>
                  <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-1">{t('runner.qaLoop.stats.bugsFound')}</div>
                </div>
                <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-blue-600">{session?.tests_generated ?? 0}</div>
                  <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-1">{t('runner.qaLoop.stats.testsGenerated')}</div>
                </div>
                <div className="text-center p-2 sm:p-3 bg-background rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-sky-600">{session?.pages_explored ?? 0}</div>
                  <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-1">{t('runner.qaLoop.stats.pagesExplored')}</div>
                </div>
              </div>
            </div>

            {/* Tabs: Tests / Bugs */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="flex border-b border-border">
                <button
                  onClick={() => setActiveTab('tests')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-150 ${
                    activeTab === 'tests'
                      ? 'text-primary border-b-2 border-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('runner.qaLoop.results.testsTab', { count: testCases.length || session?.tests_generated || 0 })}
                </button>
                <button
                  onClick={() => setActiveTab('bugs')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors duration-150 ${
                    activeTab === 'bugs'
                      ? 'text-primary border-b-2 border-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('runner.qaLoop.results.bugsTab', { count: bugs.length })}
                  {bugs.length > 0 && (
                    <span className="ms-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-900/30 text-red-600 rounded-md">
                      {bugs.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="p-3 sm:p-5">
                {activeTab === 'tests' && (
                  <>
                    {testCases.length === 0 && !session?.tests_generated ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {isRunning ? (
                          <div className="flex flex-col items-center gap-2">
                            <FiLoader className="h-5 w-5 animate-spin" />
                            <span>{t('runner.qaLoop.public.generatingTests')}</span>
                          </div>
                        ) : t('runner.qaLoop.public.noTestsGenerated')}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {testCases.map((tc) => (
                          <div key={tc.id} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-background">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              tc.last_run_status === 'passed' ? 'bg-green-400' :
                              tc.last_run_status === 'failed' ? 'bg-red-400' :
                              'bg-muted-foreground'
                            }`} />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs sm:text-sm font-medium text-foreground truncate">{tc.name}</div>
                              {tc.source_page_url && (
                                <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{tc.source_page_url}</div>
                              )}
                            </div>
                            <span className={`text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded shrink-0 ${
                              tc.last_run_status === 'passed' ? 'bg-green-900/30 text-green-400' :
                              tc.last_run_status === 'failed' ? 'bg-red-900/30 text-red-400' :
                              'bg-background text-muted-foreground'
                            }`}>
                              {tc.last_run_status || t('runner.qaLoop.results.pending')}
                            </span>
                          </div>
                        ))}
                        {testCases.length === 0 && (session?.tests_generated ?? 0) > 0 && (
                          <div className="text-center py-4 text-sm text-muted-foreground">
                            {t('runner.qaLoop.public.testsGeneratedLoading', { count: session!.tests_generated })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'bugs' && (
                  <>
                    {bugs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {isRunning ? (
                          <div className="flex flex-col items-center gap-2">
                            <FiSearch className="h-5 w-5" />
                            <span>{t('runner.qaLoop.public.scanningForBugs')}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <FiCheck className="h-6 w-6 text-green-400" />
                            <span className="text-green-600 font-medium">{t('runner.qaLoop.public.noBugsFound')}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {bugs.map((bug) => (
                          <div key={bug.id} className="border border-border rounded-lg overflow-hidden">
                            <button
                              onClick={() => setExpandedBug(expandedBug === bug.id ? null : bug.id)}
                              className="w-full p-3 flex items-center justify-between gap-2 hover:bg-muted/50 transition-colors duration-150 text-start min-h-[44px]"
                            >
                              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                <span className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-medium shrink-0 ${severityColor[bug.severity] || severityColor.low}`}>
                                  {bug.severity}
                                </span>
                                <span className="text-xs sm:text-sm font-medium text-foreground truncate">{bug.title}</span>
                              </div>
                              {expandedBug === bug.id ? (
                                <FiChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <FiChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            {expandedBug === bug.id && (
                              <div className="px-3 pb-3 sm:px-4 sm:pb-4 border-t border-border pt-2.5 sm:pt-3">
                                {bug.description && (
                                  <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 break-words">{bug.description}</p>
                                )}
                                {bug.page_url && (
                                  <div className="text-[10px] sm:text-xs text-muted-foreground mb-2 break-all">{t('runner.qaLoop.bugs.pageUrl')}: {bug.page_url}</div>
                                )}
                                {bug.reproduction_steps && bug.reproduction_steps.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">{t('runner.qaLoop.bugs.reproductionSteps')}:</div>
                                    <ol className="list-decimal list-inside space-y-1">
                                      {bug.reproduction_steps.map((step: any, i: number) => (
                                        <li key={i} className="text-xs text-muted-foreground">
                                          {typeof step === 'string' ? step : step.description || step.action || JSON.stringify(step)}
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-card rounded-lg border border-border p-4 sm:p-6 text-center">
              <h2 className="text-lg sm:text-xl font-bold text-foreground mb-2">{t('runner.qaLoop.public.ctaTitle')}</h2>
              <p className="text-muted-foreground mb-3 sm:mb-4 text-sm max-w-lg mx-auto">
                {t('runner.qaLoop.public.ctaDescription')}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-6 py-3 min-h-[44px] bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors duration-150 text-sm"
              >
                {t('runner.qaLoop.public.signUpFree')}
              </button>
            </div>
          </div>

          {/* Right column: Live Preview */}
          {showPreview && session?.target_url && (
            <div>
              {/* Mobile: collapsible preview */}
              <div className="md:hidden">
                <button
                  onClick={() => setShowPreview(false)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-card rounded-lg border border-border text-sm min-h-[44px]"
                >
                  <div className="flex items-center gap-2">
                    <FiMonitor className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{t('runner.qaLoop.public.livePreview')}</span>
                  </div>
                  <FiX className="h-4 w-4 text-muted-foreground" />
                </button>
                <div className="mt-2 bg-card rounded-lg border border-border overflow-hidden">
                  <div className="relative" style={{ height: '50vh', minHeight: '300px' }}>
                    <iframe
                      src={session.target_url}
                      className="w-full h-full border-0"
                      title={t('runner.qaLoop.public.sitePreview')}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      loading="lazy"
                    />
                    {isRunning && (
                      <div className="absolute bottom-3 start-3 end-3">
                        <div className="bg-card/90 border border-border text-foreground text-xs px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm">
                          <FiCpu className="h-3.5 w-3.5 text-primary" />
                          <span>{t('runner.qaLoop.public.aiTestingPage')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Desktop: sticky side panel */}
              <div className="hidden md:block">
                <div className="bg-card rounded-lg border border-border overflow-hidden sticky top-6">
                  {/* Preview header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-background border-b border-border">
                    <div className="flex items-center gap-2">
                      <FiMonitor className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">{t('runner.qaLoop.public.livePreview')}</span>
                      {isRunning && (
                        <span className="flex items-center gap-1 text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                          {t('runner.qaLoop.public.aiTestingSite')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={session.target_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors duration-150"
                        title="Open in new tab"
                      >
                        <FiExternalLink className="h-4 w-4 rtl:scale-x-[-1]" />
                      </a>
                      <button
                        onClick={() => setShowPreview(false)}
                        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors duration-150"
                        title="Hide preview"
                      >
                        <FiX className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {/* URL bar */}
                  <div className="px-4 py-1.5 bg-background border-b border-border">
                    <div className="flex items-center gap-2 bg-card rounded px-3 py-1 text-[11px] text-muted-foreground border border-border">
                      <FiGlobe className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate">{session.target_url}</span>
                    </div>
                  </div>
                  {/* iframe */}
                  <div className="relative" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
                    <iframe
                      src={session.target_url}
                      className="w-full h-full border-0"
                      title={t('runner.qaLoop.public.sitePreview')}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      loading="lazy"
                    />
                    {/* Scanning overlay */}
                    {isRunning && (
                      <div className="absolute bottom-3 start-3 end-3">
                        <div className="bg-card/90 border border-border text-foreground text-xs px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm">
                          <FiCpu className="h-3.5 w-3.5 text-primary" />
                          <span>{t('runner.qaLoop.public.aiTestingPage')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
