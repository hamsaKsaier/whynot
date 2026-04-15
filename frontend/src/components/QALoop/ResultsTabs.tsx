import React, { useState } from 'react';
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
    if (s === 'passed' || s === 'confirmed') return 'Passed';
    if (s === 'failed' || s === 'error') return 'Failed';
    if (s === 'mismatch') return 'Needs Review';
    return s || 'Pending';
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
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pages Scanned</div>
                <div className="text-xl font-bold text-foreground">{pages.length}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Test Cases</div>
                <div className="text-xl font-bold text-foreground">{testCases.length}</div>
                {testCases.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {passed > 0 && <span className="text-green-500 dark:text-green-400">{passed} passed</span>}
                    {failed > 0 && <span className="text-red-500 dark:text-red-400">{passed > 0 ? ' / ' : ''}{failed} failed</span>}
                    {review > 0 && <span className="text-amber-500 dark:text-amber-400">{(passed > 0 || failed > 0) ? ' / ' : ''}{review} review</span>}
                    {pending > 0 && <span className="text-muted-foreground">{(passed > 0 || failed > 0 || review > 0) ? ' / ' : ''}{pending} pending</span>}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Bugs Found</div>
                <div className="text-xl font-bold text-foreground">{bugs.length}</div>
                {bugs.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {verifiedBugs > 0 && <span className="text-green-500 dark:text-green-400">{verifiedBugs} Verified</span>}
                    {potentialBugs > 0 && <span className="text-amber-500 dark:text-amber-400">{verifiedBugs > 0 ? ', ' : ''}{potentialBugs} AI-Observed</span>}
                    {(critical > 0 || high > 0) && (
                      <span className="text-red-500 dark:text-red-400 ms-1">
                        ({critical > 0 ? `${critical} critical` : ''}{critical > 0 && high > 0 ? ', ' : ''}{high > 0 ? `${high} high` : ''})
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Security</div>
                <div className="text-xl font-bold text-foreground">{chaosResults.length}</div>
                {vulns > 0 && (
                  <div className="text-xs text-red-500 dark:text-red-400 mt-0.5">{vulns} confirmed vulnerabilities</div>
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
                  View All Tests <ArrowRight className="h-3.5 w-3.5 rtl:scale-x-[-1]" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="tests" className="gap-1">
            <FileText className="h-3.5 w-3.5" />
            Tests ({testCases.length})
          </TabsTrigger>
          <TabsTrigger value="bugs" className="gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Bugs ({bugs.length})
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-1">
            <Globe className="h-3.5 w-3.5" />
            Pages ({pages.length})
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-1">
            <Search className="h-3.5 w-3.5" />
            Analysis ({analyses.length})
          </TabsTrigger>
          {reportData && (
            <TabsTrigger value="report" className="gap-1">
              <Shield className="h-3.5 w-3.5" />
              Report (1)
            </TabsTrigger>
          )}
        </TabsList>

        <ScrollArea className="max-h-96">
          <TabsContent value="tests">
            <div className="space-y-2">
              {testCases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No test cases generated yet</div>
              ) : testCases.map(tc => (
                <Card key={tc.id} className="shadow-none">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {statusIcon(tc.last_run_status)}
                        <span className="font-medium text-foreground">{tc.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                          {tc.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">P{tc.priority}</span>
                      </div>
                    </div>
                    {tc.description && <p className="text-sm text-muted-foreground mt-1 ms-6">{tc.description}</p>}
                    <div className="text-xs text-muted-foreground mt-1 ms-6 flex items-center gap-3">
                      <span>{tc.steps?.length || 0} steps</span>
                      {tc.last_run_status && (
                        <span className={statusColor(tc.last_run_status)}>
                          Last: {statusLabel(tc.last_run_status)}
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
                <div className="text-center py-8 text-muted-foreground">No bugs found yet -- that's a good sign!</div>
              ) : bugs.map(bug => (
                <BugCard key={bug.id} bug={bug} severityColor={severityColor} safePathname={safePathname} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pages">
            <div className="space-y-2">
              {pages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No pages explored yet</div>
              ) : pages.map(page => (
                <Card key={page.id} className="shadow-none">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {page.is_explored
                          ? <CheckCircle className="h-4 w-4 text-green-500" />
                          : <Clock className="h-4 w-4 text-yellow-500" />
                        }
                        <span className="font-medium text-foreground truncate max-w-md">
                          {page.title || safePathname(page.url, page.url)}
                        </span>
                      </div>
                      {page.page_type && (
                        <Badge variant="outline" className="text-muted-foreground">{page.page_type}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 ms-6 truncate">{page.url}</div>
                    {page.description && <p className="text-sm text-muted-foreground mt-1 ms-6">{page.description}</p>}
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
