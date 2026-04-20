import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, AlertTriangle, Globe, Shield, Search, ArrowRight, Loader2,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { QALoopTestCase, QALoopBug, QALoopPage as QAPage } from '../../services/qa-loop-api';
import { ChaosResult, ChaosSummary, RootCauseAnalysis, FailureCorrelation } from './index';
import { AnalysisTab } from './AnalysisTab';
import { ReportTab } from './ReportTab';
import { BugCard } from './BugCard';
import { TestCard } from './TestCard';
import { PageCard } from './PageCard';
import { ReportsToolbar, ReportsToolbarOption } from './ReportsToolbar';

function safePathname(url: string | undefined | null, fallback?: string): string {
  try {
    if (!url) return fallback ?? '';
    return new URL(url).pathname || fallback || url;
  } catch {
    return fallback ?? url ?? '';
  }
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

type TabValue = 'tests' | 'bugs' | 'pages' | 'analysis' | 'report';

const isTabValue = (v: string | null, hasReport: boolean): v is TabValue => {
  if (!v) return false;
  return (
    v === 'tests' ||
    v === 'bugs' ||
    v === 'pages' ||
    v === 'analysis' ||
    (v === 'report' && hasReport)
  );
};

export interface ResultsTabsProps {
  testCases: QALoopTestCase[];
  bugs: QALoopBug[];
  pages: QAPage[];
  chaosResults: ChaosResult[];
  chaosSummary?: ChaosSummary;
  analyses: RootCauseAnalysis[];
  correlations: FailureCorrelation[];
  isRunning?: boolean;
  projectId?: string | null;
  reportData?: any;
}

export const ResultsTabs: React.FC<ResultsTabsProps> = ({
  testCases, bugs, pages, chaosResults, analyses, correlations, isRunning, projectId, reportData
}) => {
  const { t } = useTranslation('runner');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const hasReport = Boolean(reportData);

  // ---- URL state ---------------------------------------------------------
  const urlTab = searchParams.get('tab');
  const activeTab: TabValue = isTabValue(urlTab, hasReport) ? urlTab : 'tests';

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '' || v === 'all') next.delete(k);
        else next.set(k, v);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleTabChange = useCallback(
    (v: string) => setParam({ tab: v }),
    [setParam]
  );

  // Search: local state, deferred into filter pipeline to keep typing snappy
  const [testSearch, setTestSearch] = useState('');
  const [bugSearch, setBugSearch] = useState('');
  const [pageSearch, setPageSearch] = useState('');
  const dTestSearch = useDeferredValue(testSearch);
  const dBugSearch = useDeferredValue(bugSearch);
  const dPageSearch = useDeferredValue(pageSearch);

  // Filter + sort state from URL
  const testCategory = searchParams.get('testCategory') || 'all';
  const testSort = searchParams.get('testSort') || 'priority';
  const bugSeverity = searchParams.get('bugSeverity') || 'all';
  const bugStatus = searchParams.get('bugStatus') || 'all';
  const bugSort = searchParams.get('bugSort') || 'severity';
  const pageType = searchParams.get('pageType') || 'all';
  const pageState = searchParams.get('pageState') || 'all';

  // ---- Helpers -----------------------------------------------------------
  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'high':     return 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 'medium':   return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'low':      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default:         return 'text-muted-foreground bg-muted';
    }
  };

  const statusLabel = (s: string | null) => {
    if (s === 'passed' || s === 'confirmed') return t('runner.qaLoop.results.passed');
    if (s === 'failed' || s === 'error') return t('runner.qaLoop.results.failed');
    if (s === 'mismatch') return t('runner.qaLoop.results.needsReview');
    return s || t('runner.qaLoop.results.pending');
  };

  const statusColor = (s: string | null) => {
    if (s === 'passed' || s === 'confirmed') return 'text-green-500';
    if (s === 'failed' || s === 'error') return 'text-red-500';
    if (s === 'mismatch') return 'text-amber-500';
    return 'text-muted-foreground';
  };

  // ---- Summary stats -----------------------------------------------------
  const vulns = chaosResults.filter(r => r.vulnerabilityConfirmed).length;
  const passed = testCases.filter(tc => tc.last_run_status === 'passed' || tc.last_run_status === 'confirmed').length;
  const failed = testCases.filter(tc => tc.last_run_status === 'failed' || tc.last_run_status === 'error').length;
  const review = testCases.filter(tc => tc.last_run_status === 'mismatch').length;
  const pending = testCases.length - passed - failed - review;
  const verifiedBugs = bugs.filter(b => b.status === 'confirmed').length;
  const potentialBugs = bugs.length - verifiedBugs;
  const critical = bugs.filter(b => b.severity === 'critical').length;
  const high = bugs.filter(b => b.severity === 'high').length;

  // ---- Dynamic filter options -------------------------------------------
  const testCategoryOptions = useMemo<ReportsToolbarOption[]>(() => {
    const cats = new Set<string>();
    for (const tc of testCases) if (tc.category) cats.add(tc.category);
    return [
      { value: 'all', label: t('runner.qaLoop.results.filterAllCategories', 'All categories') },
      ...Array.from(cats).sort().map(c => ({ value: c, label: c })),
    ];
  }, [testCases, t]);

  const pageTypeOptions = useMemo<ReportsToolbarOption[]>(() => {
    const types = new Set<string>();
    for (const p of pages) if (p.page_type) types.add(p.page_type);
    return [
      { value: 'all', label: t('runner.qaLoop.results.filterAllTypes', 'All types') },
      ...Array.from(types).sort().map(c => ({ value: c, label: c })),
    ];
  }, [pages, t]);

  // ---- Filtering + sorting ----------------------------------------------
  const filteredTests = useMemo(() => {
    const q = dTestSearch.trim().toLowerCase();
    let list = testCases.filter(tc => {
      if (testCategory !== 'all' && tc.category !== testCategory) return false;
      if (!q) return true;
      return (
        tc.name?.toLowerCase().includes(q) ||
        tc.description?.toLowerCase().includes(q)
      );
    });
    if (testSort === 'priority') {
      list = [...list].sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0));
    } else if (testSort === 'name') {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return list;
  }, [testCases, testCategory, testSort, dTestSearch]);

  const filteredBugs = useMemo(() => {
    const q = dBugSearch.trim().toLowerCase();
    let list = bugs.filter(b => {
      if (bugSeverity !== 'all' && b.severity !== bugSeverity) return false;
      if (bugStatus !== 'all' && b.status !== bugStatus) return false;
      if (!q) return true;
      return (
        b.title?.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q) ||
        b.page_url?.toLowerCase().includes(q) ||
        b.category?.toLowerCase().includes(q)
      );
    });
    if (bugSort === 'severity') {
      list = [...list].sort(
        (a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
      );
    } else if (bugSort === 'status') {
      list = [...list].sort((a, b) => (a.status || '').localeCompare(b.status || ''));
    }
    return list;
  }, [bugs, bugSeverity, bugStatus, bugSort, dBugSearch]);

  const filteredPages = useMemo(() => {
    const q = dPageSearch.trim().toLowerCase();
    return pages.filter(p => {
      if (pageType !== 'all' && p.page_type !== pageType) return false;
      if (pageState === 'explored' && !p.is_explored) return false;
      if (pageState === 'pending' && p.is_explored) return false;
      if (!q) return true;
      return (
        p.url?.toLowerCase().includes(q) ||
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    });
  }, [pages, pageType, pageState, dPageSearch]);

  // ---- Empty-state renderer ---------------------------------------------
  const EmptyState: React.FC<{
    icon: React.ReactNode;
    title: string;
    hint?: string;
    running?: boolean;
  }> = ({ icon, title, hint, running }) => (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      {running ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-3" aria-hidden />
      ) : (
        <div className="mb-3 text-muted-foreground/60">{icon}</div>
      )}
      <p className="text-sm font-medium text-foreground">
        {running ? t('runner.qaLoop.results.discovering', 'Discovering…') : title}
      </p>
      {!running && hint && (
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{hint}</p>
      )}
    </div>
  );

  // Tab count badge (color intent per tab)
  const CountBadge: React.FC<{ n: number; tone: 'neutral' | 'danger' | 'default' }> = ({ n, tone }) => {
    const base = 'rounded-md px-1.5 py-0 text-[10px] h-5 min-w-[20px] inline-flex items-center justify-center font-semibold tabular-nums';
    if (tone === 'danger' && n > 0) {
      return (
        <span className={cn(base, 'bg-red-500 text-white dark:bg-red-900/60 dark:text-red-100')}>
          {n}
        </span>
      );
    }
    if (tone === 'default' && n > 0) {
      return (
        <span className={cn(base, 'bg-primary/10 text-primary')}>{n}</span>
      );
    }
    return (
      <span className={cn(base, 'bg-muted text-muted-foreground')}>{n}</span>
    );
  };

  return (
    <>
      {/* Summary card */}
      {(testCases.length > 0 || bugs.length > 0 || pages.length > 0) && (
        <Card className="mb-4">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('runner.qaLoop.results.pagesScanned')}</div>
                <div className="text-2xl font-semibold text-foreground tabular-nums">{pages.length}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('runner.qaLoop.results.testCases')}</div>
                <div className="text-2xl font-semibold text-foreground tabular-nums">{testCases.length}</div>
                {testCases.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {passed > 0 && <span className="text-green-500 dark:text-green-400">{t('runner.qaLoop.results.passedCount', { count: passed })}</span>}
                    {failed > 0 && <span className="text-red-500 dark:text-red-400">{passed > 0 ? ' / ' : ''}{t('runner.qaLoop.results.failedCount', { count: failed })}</span>}
                    {review > 0 && <span className="text-amber-500 dark:text-amber-400">{(passed > 0 || failed > 0) ? ' / ' : ''}{t('runner.qaLoop.results.reviewCount', { count: review })}</span>}
                    {pending > 0 && <span className="text-muted-foreground">{(passed > 0 || failed > 0 || review > 0) ? ' / ' : ''}{t('runner.qaLoop.results.pendingCount', { count: pending })}</span>}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('runner.qaLoop.stats.bugsFound')}</div>
                <div className="text-2xl font-semibold text-foreground tabular-nums">{bugs.length}</div>
                {bugs.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {verifiedBugs > 0 && <span className="text-green-500 dark:text-green-400">{t('runner.qaLoop.results.verifiedCount', { count: verifiedBugs })}</span>}
                    {potentialBugs > 0 && <span className="text-amber-500 dark:text-amber-400">{verifiedBugs > 0 ? ', ' : ''}{t('runner.qaLoop.results.aiObservedCount', { count: potentialBugs })}</span>}
                    {(critical > 0 || high > 0) && (
                      <span className="text-red-500 dark:text-red-400 ms-1">
                        ({critical > 0 ? `${critical} critical` : ''}{critical > 0 && high > 0 ? ', ' : ''}{high > 0 ? `${high} high` : ''})
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('runner.qaLoop.results.security')}</div>
                <div className="text-2xl font-semibold text-foreground tabular-nums">{chaosResults.length}</div>
                {vulns > 0 && (
                  <div className="text-xs text-red-500 dark:text-red-400 mt-0.5">{t('runner.qaLoop.results.confirmedVulnerabilities', { count: vulns })}</div>
                )}
              </div>
            </div>

            {/* View All Tests button */}
            {projectId && testCases.length > 0 && (
              <>
                <Separator className="mt-4 mb-3" />
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => navigate(`/projects/${projectId}`)}
                  className="flex items-center gap-2 text-sm text-sky-500 hover:text-sky-400 p-0 h-auto"
                >
                  {t('runner.qaLoop.results.viewAllTests')} <ArrowRight className="h-3.5 w-3.5 rtl:scale-x-[-1]" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/* Sticky tab bar so counts stay visible while scrolling long lists */}
        <div className="sticky top-0 z-10 -mx-4 px-4 bg-background/95 border-b mb-4">
          <TabsList className="h-auto w-full overflow-x-auto justify-start sm:justify-center bg-transparent p-0 gap-1">
            <TabsTrigger value="tests" className="gap-1.5 data-[state=active]:shadow-sm">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              <span>{t('runner.qaLoop.results.testsTabLabel', 'Tests')}</span>
              <CountBadge n={testCases.length} tone="neutral" />
            </TabsTrigger>
            <TabsTrigger value="bugs" className="gap-1.5 data-[state=active]:shadow-sm">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              <span>{t('runner.qaLoop.results.bugsTabLabel', 'Bugs')}</span>
              <CountBadge n={bugs.length} tone="danger" />
            </TabsTrigger>
            <TabsTrigger value="pages" className="gap-1.5 data-[state=active]:shadow-sm">
              <Globe className="h-3.5 w-3.5" aria-hidden />
              <span>{t('runner.qaLoop.results.pagesTabLabel', 'Pages')}</span>
              <CountBadge n={pages.length} tone="neutral" />
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-1.5 data-[state=active]:shadow-sm">
              <Search className="h-3.5 w-3.5" aria-hidden />
              <span>{t('runner.qaLoop.results.analysisTabLabel', 'Analysis')}</span>
              <CountBadge n={analyses.length} tone="default" />
            </TabsTrigger>
            {hasReport && (
              <TabsTrigger value="report" className="gap-1.5 data-[state=active]:shadow-sm">
                <Shield className="h-3.5 w-3.5" aria-hidden />
                <span>{t('runner.qaLoop.results.reportTab')}</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Tests */}
        <TabsContent value="tests" className="mt-0">
          {testCases.length > 0 && (
            <ReportsToolbar
              searchValue={testSearch}
              searchPlaceholder={t('runner.qaLoop.results.searchTests', 'Search tests…')}
              onSearchChange={setTestSearch}
              filter={{
                value: testCategory,
                placeholder: t('runner.qaLoop.results.filterCategory', 'Category'),
                ariaLabel: t('runner.qaLoop.results.filterCategory', 'Category'),
                options: testCategoryOptions,
                onChange: (v) => setParam({ testCategory: v }),
              }}
              sort={{
                value: testSort,
                placeholder: t('runner.qaLoop.results.sort', 'Sort'),
                ariaLabel: t('runner.qaLoop.results.sort', 'Sort'),
                options: [
                  { value: 'priority', label: t('runner.qaLoop.results.sortPriority', 'Priority (high-low)') },
                  { value: 'name', label: t('runner.qaLoop.results.sortName', 'Name (A-Z)') },
                ],
                onChange: (v) => setParam({ testSort: v === 'priority' ? null : v }),
              }}
            />
          )}
          <div className="space-y-2">
            {filteredTests.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-10 w-10" aria-hidden />}
                title={
                  testCases.length === 0
                    ? t('runner.qaLoop.results.noTestCases')
                    : t('runner.qaLoop.results.noMatches', 'No matches')
                }
                hint={
                  testCases.length === 0
                    ? t(
                        'runner.qaLoop.results.noTestCasesHint',
                        'Test cases will appear as the scan discovers your app.'
                      )
                    : t(
                        'runner.qaLoop.results.noMatchesHint',
                        'Try a different search or clear the filter.'
                      )
                }
                running={isRunning && testCases.length === 0}
              />
            ) : (
              filteredTests.map(tc => (
                <TestCard
                  key={tc.id}
                  test={tc}
                  statusLabel={statusLabel}
                  statusColor={statusColor}
                />
              ))
            )}
          </div>
        </TabsContent>

        {/* Bugs */}
        <TabsContent value="bugs" className="mt-0">
          {bugs.length > 0 && (
            <ReportsToolbar
              searchValue={bugSearch}
              searchPlaceholder={t('runner.qaLoop.results.searchBugs', 'Search bugs…')}
              onSearchChange={setBugSearch}
              filter={{
                value: bugSeverity,
                placeholder: t('runner.qaLoop.results.filterSeverity', 'Severity'),
                ariaLabel: t('runner.qaLoop.results.filterSeverity', 'Severity'),
                options: [
                  { value: 'all', label: t('runner.qaLoop.results.allSeverities', 'All severities') },
                  { value: 'critical', label: t('runner.qaLoop.results.severityCritical', 'Critical') },
                  { value: 'high', label: t('runner.qaLoop.results.severityHigh', 'High') },
                  { value: 'medium', label: t('runner.qaLoop.results.severityMedium', 'Medium') },
                  { value: 'low', label: t('runner.qaLoop.results.severityLow', 'Low') },
                ],
                onChange: (v) => setParam({ bugSeverity: v }),
              }}
              sort={{
                value: bugSort,
                placeholder: t('runner.qaLoop.results.sort', 'Sort'),
                ariaLabel: t('runner.qaLoop.results.sort', 'Sort'),
                options: [
                  { value: 'severity', label: t('runner.qaLoop.results.sortSeverity', 'Severity') },
                  { value: 'status', label: t('runner.qaLoop.results.sortStatus', 'Status') },
                ],
                onChange: (v) => setParam({ bugSort: v === 'severity' ? null : v }),
              }}
            />
          )}
          {bugs.length > 0 && (
            <div className="flex gap-2 mb-3 -mt-1">
              {(['all', 'confirmed', 'open'] as const).map((s) => (
                <Button
                  key={s}
                  variant={bugStatus === s ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setParam({ bugStatus: s })}
                >
                  {s === 'all'
                    ? t('runner.qaLoop.results.statusAll', 'All')
                    : s === 'confirmed'
                    ? t('runner.qaLoop.bugs.verified')
                    : t('runner.qaLoop.bugs.aiObserved')}
                </Button>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {filteredBugs.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle className="h-10 w-10" aria-hidden />}
                title={
                  bugs.length === 0
                    ? t('runner.qaLoop.results.noBugs')
                    : t('runner.qaLoop.results.noMatches', 'No matches')
                }
                hint={
                  bugs.length === 0
                    ? undefined
                    : t(
                        'runner.qaLoop.results.noMatchesHint',
                        'Try a different search or clear the filter.'
                      )
                }
                running={isRunning && bugs.length === 0}
              />
            ) : (
              filteredBugs.map(bug => (
                <BugCard
                  key={bug.id}
                  bug={bug}
                  severityColor={severityColor}
                  safePathname={safePathname}
                />
              ))
            )}
          </div>
        </TabsContent>

        {/* Pages */}
        <TabsContent value="pages" className="mt-0">
          {pages.length > 0 && (
            <ReportsToolbar
              searchValue={pageSearch}
              searchPlaceholder={t('runner.qaLoop.results.searchPages', 'Search pages…')}
              onSearchChange={setPageSearch}
              filter={{
                value: pageType,
                placeholder: t('runner.qaLoop.results.filterType', 'Type'),
                ariaLabel: t('runner.qaLoop.results.filterType', 'Type'),
                options: pageTypeOptions,
                onChange: (v) => setParam({ pageType: v }),
              }}
              sort={{
                value: pageState,
                placeholder: t('runner.qaLoop.results.filterState', 'State'),
                ariaLabel: t('runner.qaLoop.results.filterState', 'State'),
                options: [
                  { value: 'all', label: t('runner.qaLoop.results.stateAll', 'All pages') },
                  { value: 'explored', label: t('runner.qaLoop.results.stateExplored', 'Explored') },
                  { value: 'pending', label: t('runner.qaLoop.results.statePending', 'Pending') },
                ],
                onChange: (v) => setParam({ pageState: v }),
              }}
            />
          )}
          <div className="space-y-2">
            {filteredPages.length === 0 ? (
              <EmptyState
                icon={<Globe className="h-10 w-10" aria-hidden />}
                title={
                  pages.length === 0
                    ? t('runner.qaLoop.results.noPages')
                    : t('runner.qaLoop.results.noMatches', 'No matches')
                }
                running={isRunning && pages.length === 0}
              />
            ) : (
              filteredPages.map(p => <PageCard key={p.id} page={p} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="mt-0">
          <AnalysisTab analyses={analyses} correlations={correlations} />
        </TabsContent>

        {hasReport && (
          <TabsContent value="report" className="mt-0">
            <ReportTab report={reportData} />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
};
