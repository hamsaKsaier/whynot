import React, { useState } from 'react';
import {
  FiFileText, FiAlertTriangle, FiGlobe, FiShield, FiSearch, FiCheckCircle, FiClock,
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
}

export const ResultsTabs: React.FC<ResultsTabsProps> = ({
  testCases, bugs, pages, chaosResults, chaosSummary, analyses, correlations, isRunning
}) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'bugs' | 'pages' | 'analysis'>('tests');

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high':     return 'text-orange-600 bg-orange-100';
      case 'medium':   return 'text-yellow-600 bg-yellow-100';
      case 'low':      return 'text-blue-600 bg-blue-100';
      default:         return 'text-slate-400 bg-slate-900';
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

  return (
    <>
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
                    <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">{tc.category}</span>
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
