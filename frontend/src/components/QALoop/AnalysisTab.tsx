import React, { useState } from 'react';
import {
  FiSearch,
  FiAlertCircle,
  FiTrendingUp,
  FiActivity,
  FiChevronDown,
  FiChevronUp,
  FiLink,
  FiRefreshCw,
  FiCheckCircle,
  FiXCircle,
  FiHelpCircle
} from 'react-icons/fi';

export interface RootCauseAnalysis {
  id: string;
  failureId: string;
  testCaseId: string;
  testCaseName: string;
  category: 'bug' | 'flaky' | 'environment' | 'test_issue' | 'data_issue';
  subCategory?: string;
  confidence: number;
  rootCause: string;
  hypothesis?: string;
  minimalSteps: string[];
  environmentFactors: string[];
  fixSuggestion?: string;
  testImprovement?: string;
  verified?: boolean;
}

export interface FailureCorrelation {
  id: string;
  failureIds: string[];
  correlationType: 'same_root_cause' | 'same_component' | 'same_timing' | 'cascading';
  sharedRootCause?: string;
  sharedComponent?: string;
  patternDescription: string;
  confidence: number;
  failureCount: number;
}

interface AnalysisTabProps {
  analyses: RootCauseAnalysis[];
  correlations: FailureCorrelation[];
  flakyTests?: { testCaseId: string; testCaseName: string; passRate: number }[];
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
  analyses,
  correlations,
  flakyTests = []
}) => {
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'analyses' | 'correlations' | 'flaky'>('analyses');

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'bug': return <FiAlertCircle className="text-red-500" />;
      case 'flaky': return <FiRefreshCw className="text-yellow-500" />;
      case 'environment': return <FiActivity className="text-blue-500" />;
      case 'test_issue': return <FiHelpCircle className="text-orange-500" />;
      case 'data_issue': return <FiHelpCircle className="text-purple-500" />;
      default: return <FiSearch className="text-gray-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'bug': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'flaky': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'environment': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'test_issue': return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
      case 'data_issue': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getCorrelationTypeLabel = (type: string) => {
    switch (type) {
      case 'same_root_cause': return 'Same Root Cause';
      case 'same_component': return 'Same Component';
      case 'same_timing': return 'Timing Related';
      case 'cascading': return 'Cascading Failures';
      default: return type;
    }
  };

  // Summary stats
  const byCategory = analyses.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
          <div className="text-xl font-bold text-red-600">{byCategory.bug || 0}</div>
          <div className="text-xs text-red-500">Bugs</div>
        </div>
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
          <div className="text-xl font-bold text-yellow-600">{byCategory.flaky || 0}</div>
          <div className="text-xs text-yellow-500">Flaky</div>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
          <div className="text-xl font-bold text-blue-600">{byCategory.environment || 0}</div>
          <div className="text-xs text-blue-500">Environment</div>
        </div>
        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
          <div className="text-xl font-bold text-orange-600">{byCategory.test_issue || 0}</div>
          <div className="text-xs text-orange-500">Test Issues</div>
        </div>
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
          <div className="text-xl font-bold text-purple-600">{correlations.length}</div>
          <div className="text-xs text-purple-500">Correlations</div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <button
          onClick={() => setActiveView('analyses')}
          className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${activeView === 'analyses'
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <FiSearch className="text-sm" />
          Root Causes ({analyses.length})
        </button>
        <button
          onClick={() => setActiveView('correlations')}
          className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${activeView === 'correlations'
              ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <FiLink className="text-sm" />
          Correlations ({correlations.length})
        </button>
        <button
          onClick={() => setActiveView('flaky')}
          className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${activeView === 'flaky'
              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <FiRefreshCw className="text-sm" />
          Flaky Tests ({flakyTests.length})
        </button>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {/* Root Cause Analyses */}
        {activeView === 'analyses' && (
          <>
            {analyses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FiSearch className="mx-auto text-3xl mb-2" />
                No failure analyses yet
              </div>
            ) : (
              analyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                >
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedAnalysis(expandedAnalysis === analysis.id ? null : analysis.id)}
                  >
                    <div className="flex items-center gap-3">
                      {getCategoryIcon(analysis.category)}
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {analysis.testCaseName}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-sm">
                          {analysis.rootCause}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${getCategoryColor(analysis.category)}`}>
                        {analysis.category}
                      </span>
                      <span className="text-xs text-gray-400">
                        {Math.round(analysis.confidence * 100)}%
                      </span>
                      {analysis.verified ? (
                        <FiCheckCircle className="text-green-500" />
                      ) : (
                        <FiHelpCircle className="text-gray-400" />
                      )}
                      {expandedAnalysis === analysis.id ? <FiChevronUp /> : <FiChevronDown />}
                    </div>
                  </div>

                  {expandedAnalysis === analysis.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">Root Cause:</div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{analysis.rootCause}</p>
                      </div>

                      {analysis.hypothesis && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1">Hypothesis:</div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{analysis.hypothesis}</p>
                        </div>
                      )}

                      {analysis.minimalSteps.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1">Minimal Reproduction:</div>
                          <ol className="text-xs text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1">
                            {analysis.minimalSteps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {analysis.environmentFactors.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1">Environment Factors:</div>
                          <div className="flex flex-wrap gap-1">
                            {analysis.environmentFactors.map((factor, i) => (
                              <span key={i} className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                                {factor}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {analysis.fixSuggestion && (
                        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                            Suggested Fix:
                          </div>
                          <p className="text-xs text-green-600 dark:text-green-300">{analysis.fixSuggestion}</p>
                        </div>
                      )}

                      {analysis.testImprovement && (
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                          <div className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                            Test Improvement:
                          </div>
                          <p className="text-xs text-blue-600 dark:text-blue-300">{analysis.testImprovement}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* Correlations */}
        {activeView === 'correlations' && (
          <>
            {correlations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FiLink className="mx-auto text-3xl mb-2" />
                No failure correlations found
              </div>
            ) : (
              correlations.map((correlation) => (
                <div
                  key={correlation.id}
                  className="p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FiLink className="text-purple-500" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {getCorrelationTypeLabel(correlation.correlationType)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-purple-600 dark:text-purple-400">
                        {correlation.failureCount} failures linked
                      </span>
                      <span className="text-xs text-gray-400">
                        {Math.round(correlation.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {correlation.patternDescription}
                  </p>
                  {correlation.sharedRootCause && (
                    <div className="mt-2 text-xs text-gray-500">
                      <span className="font-medium">Shared cause:</span> {correlation.sharedRootCause}
                    </div>
                  )}
                  {correlation.sharedComponent && (
                    <div className="mt-1 text-xs text-gray-500">
                      <span className="font-medium">Component:</span> {correlation.sharedComponent}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* Flaky Tests */}
        {activeView === 'flaky' && (
          <>
            {flakyTests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FiRefreshCw className="mx-auto text-3xl mb-2" />
                No flaky tests detected
              </div>
            ) : (
              flakyTests.map((test, idx) => (
                <div
                  key={test.testCaseId || idx}
                  className="p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FiRefreshCw className="text-yellow-500" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {test.testCaseName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-500"
                          style={{ width: `${test.passRate}%` }}
                        />
                      </div>
                      <span className="text-sm text-yellow-600">
                        {Math.round(test.passRate)}% pass rate
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AnalysisTab;
