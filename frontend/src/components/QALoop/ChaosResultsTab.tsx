import React, { useState } from 'react';
import { Card } from '../common/Card';
import {
  FiShield,
  FiAlertTriangle,
  FiCheck,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink
} from 'react-icons/fi';

export interface ChaosResult {
  id: string;
  pageUrl: string;
  elementSelector?: string;
  attackCategory: string;
  attackName: string;
  payloadUsed: string;
  result: 'vulnerable' | 'blocked' | 'error' | 'timeout' | 'inconclusive';
  vulnerabilityConfirmed: boolean;
  severity?: string;
  confidence: number;
  reproductionSteps: string[];
  evidenceScreenshot?: string;
}

export interface ChaosSummary {
  totalAttacks: number;
  vulnerabilitiesFound: number;
  blockedAttacks: number;
  errors: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  pagesTested: number;
  inputsTested: number;
  durationMs: number;
}

interface ChaosResultsTabProps {
  results: ChaosResult[];
  summary?: ChaosSummary;
  isRunning?: boolean;
}

export const ChaosResultsTab: React.FC<ChaosResultsTabProps> = ({
  results,
  summary,
  isRunning
}) => {
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'vulnerable' | 'blocked'>('all');

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-slate-9000 text-white';
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'vulnerable': return <FiAlertTriangle className="text-red-500" />;
      case 'blocked': return <FiShield className="text-green-500" />;
      case 'error': return <FiX className="text-slate-400" />;
      default: return <FiCheck className="text-slate-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'injection': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'xss': return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
      case 'boundary': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'timing': return 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300';
      case 'security': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'a11y': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      default: return 'bg-slate-900 text-slate-200 dark:bg-gray-800 dark:text-slate-500';
    }
  };

  const filteredResults = results.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'vulnerable') return r.vulnerabilityConfirmed;
    if (filter === 'blocked') return r.result === 'blocked';
    return true;
  });

  const vulnerabilities = results.filter(r => r.vulnerabilityConfirmed);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {summary.vulnerabilitiesFound}
            </div>
            <div className="text-xs text-red-500">Vulnerabilities</div>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {summary.blockedAttacks}
            </div>
            <div className="text-xs text-green-500">Blocked</div>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {summary.totalAttacks}
            </div>
            <div className="text-xs text-blue-500">Total Attacks</div>
          </div>
          <div className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-lg text-center">
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {summary.pagesTested}
            </div>
            <div className="text-xs text-sky-500">Pages Tested</div>
          </div>
        </div>
      )}

      {/* Severity Breakdown */}
      {summary && summary.vulnerabilitiesFound > 0 && (
        <div className="flex items-center gap-2 p-3 bg-slate-900 dark:bg-gray-800 rounded-lg">
          <span className="text-sm text-slate-400 dark:text-slate-500 mr-2">By Severity:</span>
          {summary.criticalFindings > 0 && (
            <span className="px-2 py-1 rounded text-xs bg-red-600 text-white">
              {summary.criticalFindings} Critical
            </span>
          )}
          {summary.highFindings > 0 && (
            <span className="px-2 py-1 rounded text-xs bg-orange-500 text-white">
              {summary.highFindings} High
            </span>
          )}
          {summary.mediumFindings > 0 && (
            <span className="px-2 py-1 rounded text-xs bg-yellow-500 text-black">
              {summary.mediumFindings} Medium
            </span>
          )}
          {summary.lowFindings > 0 && (
            <span className="px-2 py-1 rounded text-xs bg-blue-500 text-white">
              {summary.lowFindings} Low
            </span>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-700 dark:border-gray-700 pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 text-sm rounded ${filter === 'all'
              ? 'bg-slate-700 dark:bg-gray-700 text-white dark:text-white'
              : 'text-slate-400 hover:text-slate-200'
            }`}
        >
          All ({results.length})
        </button>
        <button
          onClick={() => setFilter('vulnerable')}
          className={`px-3 py-1 text-sm rounded ${filter === 'vulnerable'
              ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
              : 'text-slate-400 hover:text-slate-200'
            }`}
        >
          Vulnerabilities ({vulnerabilities.length})
        </button>
        <button
          onClick={() => setFilter('blocked')}
          className={`px-3 py-1 text-sm rounded ${filter === 'blocked'
              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
              : 'text-slate-400 hover:text-slate-200'
            }`}
        >
          Blocked ({results.filter(r => r.result === 'blocked').length})
        </button>
      </div>

      {/* Results List */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {isRunning && results.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <FiShield className="mx-auto text-3xl mb-2 animate-pulse" />
            Running chaos tests...
          </div>
        )}

        {!isRunning && results.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            No chaos tests run yet. Start a session with chaos mode enabled.
          </div>
        )}

        {filteredResults.map((result, idx) => (
          <div
            key={result.id || idx}
            className={`p-3 rounded-lg border ${result.vulnerabilityConfirmed
                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                : 'border-slate-700 dark:border-gray-700 bg-slate-900 dark:bg-gray-800'
              }`}
          >
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedResult(expandedResult === result.id ? null : result.id)}
            >
              <div className="flex items-center gap-3">
                {getResultIcon(result.result)}
                <div>
                  <div className="font-medium text-white dark:text-white">
                    {result.attackName}
                  </div>
                  <div className="text-xs text-slate-400 truncate max-w-xs">
                    {result.pageUrl ? new URL(result.pageUrl).pathname : 'Unknown page'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs ${getCategoryColor(result.attackCategory)}`}>
                  {result.attackCategory}
                </span>
                {result.severity && result.vulnerabilityConfirmed && (
                  <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(result.severity)}`}>
                    {result.severity}
                  </span>
                )}
                {expandedResult === result.id ? <FiChevronUp /> : <FiChevronDown />}
              </div>
            </div>

            {expandedResult === result.id && (
              <div className="mt-3 pt-3 border-t border-slate-700 dark:border-gray-700 space-y-3">
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-1">Payload Used:</div>
                  <code className="text-xs bg-slate-700 dark:bg-gray-700 px-2 py-1 rounded block overflow-x-auto">
                    {result.payloadUsed}
                  </code>
                </div>

                {result.elementSelector && (
                  <div>
                    <div className="text-xs font-medium text-slate-400 mb-1">Element:</div>
                    <code className="text-xs bg-slate-700 dark:bg-gray-700 px-2 py-1 rounded">
                      {result.elementSelector}
                    </code>
                  </div>
                )}

                {result.reproductionSteps.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-slate-400 mb-1">Reproduction Steps:</div>
                    <ol className="text-xs text-slate-400 dark:text-slate-500 list-decimal list-inside space-y-1">
                      {result.reproductionSteps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Confidence: {Math.round(result.confidence * 100)}%
                  </span>
                  {result.pageUrl && (
                    <a
                      href={result.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
                    >
                      Open Page <FiExternalLink />
                    </a>
                  )}
                </div>

                {result.evidenceScreenshot && (
                  <div>
                    <div className="text-xs font-medium text-slate-400 mb-1">Evidence:</div>
                    <img
                      src={result.evidenceScreenshot}
                      alt="Evidence screenshot"
                      className="rounded border border-slate-700 dark:border-gray-700 max-h-40 object-contain"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChaosResultsTab;
