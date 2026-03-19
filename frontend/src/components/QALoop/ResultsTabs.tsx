import React, { useState } from 'react';
import {
  FiFileText, FiAlertTriangle, FiGlobe, FiShield, FiSearch, FiCheckCircle, FiClock,
  FiSend, FiChevronDown, FiZap,
} from 'react-icons/fi';

import { QALoopTestCase, QALoopBug, QALoopPage as QAPage } from '../../services/qa-loop-api';
import { ChaosResult, ChaosSummary, RootCauseAnalysis, FailureCorrelation } from './index';
import { ChaosResultsTab } from './ChaosResultsTab';
import { AnalysisTab } from './AnalysisTab';
import { BugCard } from './BugCard';
import { reportAllBugs, BugReportProvider } from '../../services/integrations-api';
import { useToastContext } from '../../contexts/ToastContext';
import { CostInfo } from '../../hooks/useQALoopStream';

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
  sessionId?: string;
  /** Cost info from the live stream (used in the post-scan summary) */
  costInfo?: CostInfo;
  /** Whether the session has completed (to show summary card) */
  sessionComplete?: boolean;
}

export const ResultsTabs: React.FC<ResultsTabsProps> = ({
  testCases, bugs, pages, chaosResults, chaosSummary, analyses, correlations, isRunning, sessionId,
  costInfo, sessionComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'bugs' | 'pages' | 'analysis'>('tests');
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [batchReporting, setBatchReporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);

  const { success: toastSuccess, error: toastError } = useToastContext();

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'text-red-600 bg-red-900/30';
      case 'high':     return 'text-orange-600 bg-orange-900/30';
      case 'medium':   return 'text-yellow-600 bg-yellow-900/30';
      case 'low':      return 'text-blue-600 bg-blue-900/30';
      default:         return 'text-slate-400 bg-slate-800';
    }
  };

  const statusIcon = (s: string | null) => {
    if (s === 'passed') return <FiCheckCircle className="text-green-500" />;
    if (s === 'failed') return <FiAlertTriangle className="text-red-500" />;
    return <FiClock className="text-slate-500" />;
  };

  const vulns = chaosResults.filter(r => r.vulnerabilityConfirmed).length;

  const tab = (id: typeof activeTab, label: string, count: number, icon: React.ReactNode, activeClass: string) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`pb-2 flex items-center gap-1 ${activeTab === id ? `border-b-2 ${activeClass} font-medium` : 'text-slate-400 hover:text-slate-200'}`}
    >
      {icon}
      {label} ({count})
    </button>
  );

  const handleBatchReport = async (provider: BugReportProvider) => {
    if (!sessionId || batchReporting) return;
    setShowReportMenu(false);
    setBatchReporting(true);
    const providerLabel = provider === 'clickup' ? 'ClickUp' : 'GitHub Issues';
    setBatchProgress(`Reporting bugs to ${providerLabel}...`);

    try {
      const result = await reportAllBugs(sessionId, provider);
      if (result.reported > 0) {
        toastSuccess(`${result.reported} bug${result.reported > 1 ? 's' : ''} reported to ${providerLabel}`);
      } else {
        toastSuccess(`No unreported bugs to send to ${providerLabel}`);
      }
      const failed = result.results.filter(r => !r.success).length;
      if (failed > 0) {
        toastError(`${failed} bug${failed > 1 ? 's' : ''} failed to report`);
      }
    } catch (err: any) {
      toastError(err.response?.data?.error || err.message || `Failed to batch report to ${providerLabel}`);
    } finally {
      setBatchReporting(false);
      setBatchProgress(null);
    }
  };

  // Compute bug severity counts for the summary card
  const criticalBugs = bugs.filter(b => b.severity === 'critical').length;
  const highBugs = bugs.filter(b => b.severity === 'high').length;
  const mediumBugs = bugs.filter(b => b.severity === 'medium').length;
  const lowBugs = bugs.filter(b => b.severity === 'low').length;
  const creditsUsed = costInfo && costInfo.totalCostCents > 0
    ? Math.ceil(costInfo.totalCostCents / 10) // Rough conversion: 10 cents per credit
    : null;

  const showSummary = sessionComplete || (!isRunning && (testCases.length > 0 || bugs.length > 0));

  return (
    <>
      {/* ── Session Summary Card ─────────────────────────────────────────────── */}
      {showSummary && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FiZap className="text-sky-400" size={14} />
            Scan Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Pages scanned */}
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{pages.filter(p => p.is_explored).length}</div>
              <div className="text-sm text-slate-400 mt-1">Pages Scanned</div>
            </div>
            {/* Bugs found */}
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{bugs.length}</div>
              <div className="text-sm text-slate-400 mt-1">Bugs Found</div>
              {bugs.length > 0 && (
                <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                  {criticalBugs > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
                      {criticalBugs} critical
                    </span>
                  )}
                  {highBugs > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">
                      {highBugs} high
                    </span>
                  )}
                  {mediumBugs > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">
                      {mediumBugs} medium
                    </span>
                  )}
                  {lowBugs > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
                      {lowBugs} low
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* Test cases generated */}
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{testCases.length}</div>
              <div className="text-sm text-slate-400 mt-1">Tests Generated</div>
            </div>
            {/* Credits used */}
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {creditsUsed !== null ? creditsUsed : '--'}
              </div>
              <div className="text-sm text-slate-400 mt-1">Credits Used</div>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-slate-700 mb-4">
        <nav className="flex gap-4 flex-wrap items-center">
          {tab('tests',    'Tests',    testCases.length, <FiFileText className="text-sm" />,     'border-sky-500 text-sky-600')}
          {tab('bugs',     'Bugs',     bugs.length,      <FiAlertTriangle className="text-sm" />, 'border-red-500 text-red-600')}
          {tab('pages',    'Pages',    pages.length,     <FiGlobe className="text-sm" />,         'border-blue-500 text-blue-600')}
          {tab('analysis', 'Analysis', analyses.length,  <FiSearch className="text-sm" />,        'border-green-500 text-green-600')}

          {/* Report All dropdown — only show when bugs tab active and has bugs */}
          {sessionId && bugs.length > 0 && activeTab === 'bugs' && (
            <div className="relative ml-auto">
              <button
                onClick={() => setShowReportMenu(!showReportMenu)}
                disabled={batchReporting}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <FiSend className="h-3 w-3" />
                {batchReporting ? batchProgress : 'Report All'}
                <FiChevronDown className="h-3 w-3" />
              </button>
              {showReportMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-slate-800 rounded-lg shadow-lg border border-slate-700 py-1 z-20">
                  <button
                    onClick={() => handleBatchReport('clickup')}
                    className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-sky-900/20 hover:text-sky-700 transition-colors"
                  >
                    All to ClickUp
                  </button>
                  <button
                    onClick={() => handleBatchReport('github')}
                    className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-900 hover:text-white transition-colors"
                  >
                    All to GitHub Issues
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {activeTab === 'tests' && (
          <div className="space-y-2">
            {testCases.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No test cases generated yet</div>
            ) : testCases.map(tc => (
              <div key={tc.id} className="p-3 bg-slate-900 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(tc.last_run_status)}
                    <span className="font-medium text-white">{tc.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-700">{tc.category}</span>
                    <span className="text-xs text-slate-500">P{tc.priority}</span>
                  </div>
                </div>
                {tc.description && <p className="text-sm text-slate-400 mt-1 ml-6">{tc.description}</p>}
                <div className="text-xs text-slate-500 mt-1 ml-6 flex items-center gap-3">
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
              <div className="text-center py-8 text-slate-400">No bugs found yet — that's a good sign!</div>
            ) : bugs.map(bug => (
              <BugCard key={bug.id} bug={bug} severityColor={severityColor} safePathname={safePathname} />
            ))}
          </div>
        )}

        {activeTab === 'pages' && (
          <div className="space-y-2">
            {pages.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No pages explored yet</div>
            ) : pages.map(page => (
              <div key={page.id} className="p-3 bg-slate-900 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {page.is_explored
                      ? <FiCheckCircle className="text-green-500" />
                      : <FiClock className="text-yellow-500" />
                    }
                    <span className="font-medium text-white truncate max-w-md">
                      {page.title || safePathname(page.url, page.url)}
                    </span>
                  </div>
                  {page.page_type && (
                    <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400">{page.page_type}</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1 ml-6 truncate">{page.url}</div>
                {page.description && <p className="text-sm text-slate-400 mt-1 ml-6">{page.description}</p>}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'analysis' && (
          <AnalysisTab analyses={analyses} correlations={correlations} />
        )}
      </div>
    </>
  );
};
