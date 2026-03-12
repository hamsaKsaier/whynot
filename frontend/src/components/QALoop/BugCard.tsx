/**
 * BugCard — expandable bug card with reproduction steps and action buttons.
 * Extracted from QALoopPage (Phase 7).
 */
import React, { useState } from 'react';
import type { QALoopBug } from '../../services/qa-loop-api';
import { CreateTaskButton } from './CreateTaskButton';
import { AutoFixButton } from './AutoFixButton';

export function safePathname(url: string | undefined | null, fallback?: string): string {
  try {
    if (!url) return fallback ?? '';
    return new URL(url).pathname || fallback || url;
  } catch {
    return fallback ?? url ?? '';
  }
}

function severityColor(s: string) {
  switch (s) {
    case 'critical': return 'text-red-600 bg-red-100';
    case 'high':     return 'text-orange-600 bg-orange-100';
    case 'medium':   return 'text-yellow-600 bg-yellow-100';
    case 'low':      return 'text-blue-600 bg-blue-100';
    default:         return 'text-gray-600 bg-gray-100';
  }
}

export const BugCard: React.FC<{ bug: QALoopBug }> = ({ bug }) => {
  const [expanded, setExpanded] = useState(false);

  const reproSteps = Array.isArray(bug.reproduction_steps) ? bug.reproduction_steps : [];

  return (
    <div className="bg-gray-50 rounded-lg border-l-4 border-red-400 overflow-hidden">
      <div
        className="p-3 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className={`w-3 h-3 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-gray-900">{bug.title}</span>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <AutoFixButton bugId={bug.id} bugTitle={bug.title} />
            <CreateTaskButton bugId={bug.id} bugTitle={bug.title} />
            <span className={`text-xs px-2 py-1 rounded ${severityColor(bug.severity)}`}>{bug.severity}</span>
          </div>
        </div>
        {bug.description && <p className="text-sm text-gray-500 mt-1 ml-5">{bug.description}</p>}
        <div className="text-xs text-gray-400 mt-2 ml-5 flex items-center gap-3">
          {bug.category && <span className="bg-gray-200 px-1.5 py-0.5 rounded">{bug.category}</span>}
          {bug.bug_type && <span className="bg-gray-200 px-1.5 py-0.5 rounded">{bug.bug_type}</span>}
          {bug.page_url && <span className="truncate max-w-xs">{safePathname(bug.page_url)}</span>}
          <span className={bug.status === 'open' ? 'text-red-500' : 'text-green-500'}>{bug.status}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-200 mt-1 pt-3 ml-5 space-y-3">
          {reproSteps.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Reproduction Steps</div>
              <ol className="list-decimal list-inside space-y-1">
                {reproSteps.map((step: any, i: number) => (
                  <li key={i} className="text-sm text-gray-700">
                    {typeof step === 'string' ? step : step.description || step.action || JSON.stringify(step)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {bug.page_url && (
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Page URL</div>
              <a
                href={bug.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:text-primary-700 break-all"
              >
                {bug.page_url}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
