import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiFileText, FiAlertTriangle, FiGlobe, FiShield, FiSearch, FiCheckCircle, FiClock, FiArrowRight,
} from 'react-icons/fi';

import { QALoopTestCase, QALoopBug, QALoopPage as QAPage } from '../../services/qa-loop-api';
import { ChaosResult, ChaosSummary, RootCauseAnalysis, FailureCorrelation } from './index';
import { ChaosResultsTab } from './ChaosResultsTab';
import { AnalysisTab } from './AnalysisTab';
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
}

export const ResultsTabs: React.FC<ResultsTabsProps> = ({
  testCases, bugs, pages, chaosResults, chaosSummary, analyses, correlations, isRunning, projectId
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tests' | 'bugs' | 'pages' | 'analysis'>('tests');

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'text-red-300 bg-red-900/40';
      case 'high':     return 'text-orange-300 bg-orange-900/40';
      case 'medium':   return 'text-yellow-300 bg-yellow-900/40';
      case 'low':      return 'text-blue-300 bg-blue-900/40';
      default:         return 'text-slate-400 bg-slate-900';
    }
  };

  const statusIcon = (s: string | null) => {
    if (s === 'passed' || s === 'confirmed') return <FiCheckCircle className="text-green-500" />;
    if (s === 'failed' || s === 'error') return <FiAlertTriangle className="text-red-500" />;
    if (s === 'mismatch') return <FiAlertTriangle className="text-amber-500" />;
    return <FiClock className="text-slate-500" />;
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
    return 'text-slate-500';
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

  const tab = (id: typeof activeTab, label: string, count: number, icon: React.ReactNode, activeClass: string) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`pb-2 flex items-center gap-1 ${activeTab === id ? `border-b-2 ${activeClass} font-medium` : 'text-slate-400 hover:text-slate-200'}`}
    >
      {icon}
      {label} ({count})
    </button>
  );

  return (
    <>
      {/* Summary card */}
      {(testCases.length > 0 || bugs.length > 0 || pages.length > 0) && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Pages Scanned</div>
              <div className="text-xl font-bold text-white">{pages.length}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Test Cases</div>
              <div className="text-xl font-bold text-white">{testCases.length}</div>
              {testCases.length > 0 && (
                <div className="text-xs text-slate-500 mt-0.5">
                  {passed > 0 && <span className="text-green-400">{passed} passed</span>}
                  {failed > 0 && <span className="text-red-400">{passed > 0 ? ' / ' : ''}{failed} failed</span>}
                  {review > 0 && <span className="text-amber-400">{(passed > 0 || failed > 0) ? ' / ' : ''}{review} review</span>}
                  {pending > 0 && <span className="text-slate-400">{(passed > 0 || failed > 0 || review > 0) ? ' / ' : ''}{pending} pending</span>}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Bugs Found</div>
              <div className="text-xl font-bold text-white">{bugs.length}</div>
              {bugs.length > 0 && (
                <div className="text-xs text-slate-500 mt-0.5">
                  {verifiedBugs > 0 && <span className="text-green-400">{verifiedBugs} Verified</span>}
                  {potentialBugs > 0 && <span className="text-amber-400">{verifiedBugs > 0 ? ', ' : ''}{potentialBugs} AI-Observed</span>}
                  {(critical > 0 || high > 0) && (
                    <span className="text-red-400 ml-1">
                      ({critical > 0 ? `${critical} critical` : ''}{critical > 0 && high > 0 ? ', ' : ''}{high > 0 ? `${high} high` : ''})
                    </span>
                  )}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Security</div>
              <div className="text-xl font-bold text-white">{chaosResults.length}</div>
              {vulns > 0 && (
                <div className="text-xs text-red-400 mt-0.5">{vulns} confirmed vulnerabilities</div>
              )}
            </div>
          </div>

          {/* View All Tests button */}
          {projectId && testCases.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-700/50">
              <button
                onClick={() => navigate(`/projects/${projectId}`)}
                className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors"
              >
                View All Tests <FiArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="border-b border-slate-700 mb-4">
        <nav className="flex gap-4 flex-wrap">
          {tab('tests',    'Tests',    testCases.length, <FiFileText className="text-sm" />,     'border-sky-500 text-sky-600')}
          {tab('bugs',     'Bugs',     bugs.length,      <FiAlertTriangle className="text-sm" />, 'border-red-500 text-red-600')}
          {tab('pages',    'Pages',    pages.length,     <FiGlobe className="text-sm" />,         'border-blue-500 text-blue-600')}
          {tab('analysis', 'Analysis', analyses.length,  <FiSearch className="text-sm" />,        'border-green-500 text-green-600')}
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
                    <span className="text-xs px-2 py-1 rounded bg-blue-900/40 text-blue-300">{tc.category}</span>
                    <span className="text-xs text-slate-500">P{tc.priority}</span>
                  </div>
                </div>
                {tc.description && <p className="text-sm text-slate-400 mt-1 ml-6">{tc.description}</p>}
                <div className="text-xs text-slate-500 mt-1 ml-6 flex items-center gap-3">
                  <span>{tc.steps?.length || 0} steps</span>
                  {tc.last_run_status && (
                    <span className={statusColor(tc.last_run_status)}>
                      Last: {statusLabel(tc.last_run_status)}
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
                    <span className="text-xs px-2 py-1 rounded bg-slate-900 text-slate-400">{page.page_type}</span>
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
