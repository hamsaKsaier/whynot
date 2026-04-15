import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  FileText, AlertTriangle, Globe, Shield, Search, CheckCircle, Clock, ArrowRight,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { QALoopTestCase, QALoopBug, QALoopPage as QAPage } from '../../services/qa-loop-api';
import { ChaosResult, ChaosSummary, RootCauseAnalysis, FailureCorrelation } from './index';
import { ChaosResultsTab } from './ChaosResultsTab';
import { AnalysisTab } from './AnalysisTab';
import { ReportTab } from './ReportTab';
import { BugCard } from './BugCard';

function safePathname(url: string | undefined | null, fallback?: string): string {
  try {
    if (!url) return fallback ?? '';
    return new URL(url).pathname || fallback || url;
  } catch {
    return fallback ?? url ?? '';
  }
}

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
  testCases, bugs, pages, chaosResults, chaosSummary, analyses, correlations, isRunning, projectId, reportData
}) => {
  const { t } = useTranslation('runner');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tests' | 'bugs' | 'pages' | 'analysis' | 'report'>('tests');

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'high':     return 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 'medium':   return 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'low':      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default:         return 'text-muted-foreground bg-muted';
    }
  };

  const statusIcon = (s: string | null) => {
    if (s === 'passed' || s === 'confirmed') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (s === 'failed' || s === 'error') return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (s === 'mismatch') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
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

  const vulns = chaosResults.filter(r => r.vulnerabilityConfirmed).length;

  // Summary stats
  const passed = testCases.filter(tc => tc.last_run_status === 'passed' || tc.last_run_status === 'confirmed').length;
  const failed = testCases.filter(tc => tc.last_run_status === 'failed' || tc.last_run_status === 'error').length;
  const review = testCases.filter(tc => tc.last_run_status === 'mismatch').length;
  const pending = testCases.length - passed - failed - review;
  const verifiedBugs = bugs.filter(b => b.status === 'confirmed').length;
  const potentialBugs = bugs.length - verifiedBugs;
  const critical = bugs.filter(b => b.severity === 'critical').length;
  const high = bugs.filter(b => b.severity === 'high').length;

  return (
    <>
      {/* Summary card */}
      {(testCases.length > 0 || bugs.length > 0 || pages.length > 0) && (
        <Card className="mb-4">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('runner.qaLoop.results.pagesScanned')}</div>
                <div className="text-xl font-bold text-foreground">{pages.length}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{t('runner.qaLoop.results.testCases')}</div>
                <div className="text-xl font-bold text-foreground">{testCases.length}</div>
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
                <div className="text-xl font-bold text-foreground">{bugs.length}</div>
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
                <div className="text-xl font-bold text-foreground">{chaosResults.length}</div>
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-4 w-full overflow-x-auto justify-start sm:justify-center">
          <TabsTrigger value="tests" className="gap-1 text-xs sm:text-sm">
            <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline">{t('runner.qaLoop.results.testsTab', { count: testCases.length })}</span>
            <span className="sm:hidden">{testCases.length}</span>
          </TabsTrigger>
          <TabsTrigger value="bugs" className="gap-1 text-xs sm:text-sm">
            <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline">{t('runner.qaLoop.results.bugsTab', { count: bugs.length })}</span>
            <span className="sm:hidden">{bugs.length}</span>
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-1 text-xs sm:text-sm">
            <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline">{t('runner.qaLoop.results.pagesTab', { count: pages.length })}</span>
            <span className="sm:hidden">{pages.length}</span>
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-1 text-xs sm:text-sm">
            <Search className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline">{t('runner.qaLoop.results.analysisTab', { count: analyses.length })}</span>
            <span className="sm:hidden">{analyses.length}</span>
          </TabsTrigger>
          {reportData && (
            <TabsTrigger value="report" className="gap-1 text-xs sm:text-sm">
              <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">{t('runner.qaLoop.results.reportTab')}</span>
            </TabsTrigger>
          )}
        </TabsList>

        <ScrollArea className="max-h-[50vh] sm:max-h-96">
          <TabsContent value="tests">
            <div className="space-y-2">
              {testCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('runner.qaLoop.results.noTestCases')}</div>
              ) : testCases.map(tc => (
                <Card key={tc.id} className="shadow-none">
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                        <span className="shrink-0 mt-0.5 sm:mt-0">{statusIcon(tc.last_run_status)}</span>
                        <span className="font-medium text-foreground text-sm break-words">{tc.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-[10px] sm:text-xs">
                          {tc.category}
                        </Badge>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">P{tc.priority}</span>
                      </div>
                    </div>
                    {tc.description && <p className="text-xs sm:text-sm text-muted-foreground mt-1 ms-6 break-words">{tc.description}</p>}
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 ms-6 flex items-center gap-2 sm:gap-3 flex-wrap">
                      <span>{t('runner.qaLoop.results.stepsCount', { count: tc.steps?.length || 0 })}</span>
                      {tc.last_run_status && (
                        <span className={statusColor(tc.last_run_status)}>
                          {t('runner.qaLoop.results.lastStatus', { status: statusLabel(tc.last_run_status) })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bugs">
            <div className="space-y-2">
              {bugs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('runner.qaLoop.results.noBugs')}</div>
              ) : bugs.map(bug => (
                <BugCard key={bug.id} bug={bug} severityColor={severityColor} safePathname={safePathname} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pages">
            <div className="space-y-2">
              {pages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('runner.qaLoop.results.noPages')}</div>
              ) : pages.map(page => (
                <Card key={page.id} className="shadow-none">
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                        <span className="shrink-0 mt-0.5 sm:mt-0">
                          {page.is_explored
                            ? <CheckCircle className="h-4 w-4 text-green-500" />
                            : <Clock className="h-4 w-4 text-yellow-500" />
                          }
                        </span>
                        <span className="font-medium text-foreground text-sm truncate">
                          {page.title || safePathname(page.url, page.url)}
                        </span>
                      </div>
                      {page.page_type && (
                        <Badge variant="outline" className="text-muted-foreground text-[10px] sm:text-xs shrink-0">{page.page_type}</Badge>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 ms-6 truncate break-all">{page.url}</div>
                    {page.description && <p className="text-xs sm:text-sm text-muted-foreground mt-1 ms-6 break-words">{page.description}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analysis">
            <AnalysisTab analyses={analyses} correlations={correlations} />
          </TabsContent>

          <TabsContent value="report">
            <ReportTab report={reportData} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </>
  );
};
