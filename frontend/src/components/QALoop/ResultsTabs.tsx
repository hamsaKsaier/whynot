/**
 * ResultsTabs — tabbed view of test cases, bugs, pages, security, and analysis.
 * Extracted from QALoopPage (Phase 7).
 */
import React, { useState } from 'react';
import {
  FiFileText, FiAlertTriangle, FiShield, FiSearch, FiCheckCircle, FiClock,
  FiGlobe, FiSave,
} from 'react-icons/fi';
import type { QALoopTestCase, QALoopBug, QALoopPage as QAPage } from '../../services/qa-loop-api';
import { BugCard, safePathname } from './BugCard';
import { ChaosResultsTab } from './ChaosResultsTab';
import { AnalysisTab } from './AnalysisTab';
import type { ChaosResult, ChaosSummary } from './ChaosResultsTab';
import type { RootCauseAnalysis, FailureCorrelation } from './AnalysisTab';

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
  onSaveTestCase?: (testCaseId: string) => void;
}

export const ResultsTabs: React.FC<ResultsTabsProps> = ({
  testCases, bugs, pages, chaosResults, chaosSummary, analyses, correlations,
  isRunning, sessionId, onSaveTestCase,
}) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'bugs' | 'pages' | 'chaos' | 'analysis'>('tests');
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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
                    {sessionId && onSaveTestCase && (
                      <button
                        onClick={() => {
                          if (savedIds.has(tc.id) || savingIds.has(tc.id)) return;
                          setSavingIds(prev => new Set(prev).add(tc.id));
                          onSaveTestCase(tc.id);
                          setTimeout(() => {
                            setSavingIds(prev => { const n = new Set(prev); n.delete(tc.id); return n; });
                            setSavedIds(prev => new Set(prev).add(tc.id));
                          }, 1500);
                        }}
                        disabled={savedIds.has(tc.id) || savingIds.has(tc.id)}
                        className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                          savedIds.has(tc.id)
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : savingIds.has(tc.id)
                            ? 'bg-gray-100 text-gray-400 cursor-wait'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-pointer'
                        }`}
                        title={savedIds.has(tc.id) ? 'Saved to Test Cases' : 'Save to Test Cases library'}
                      >
                        <FiSave className="h-3 w-3" />
                        {savedIds.has(tc.id) ? 'Saved' : savingIds.has(tc.id) ? 'Saving…' : 'Save'}
                      </button>
                    )}
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
              <BugCard key={bug.id} bug={bug} />
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
