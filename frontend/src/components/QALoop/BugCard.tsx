import React, { useState } from 'react';
import { QALoopBug } from '../../services/qa-loop-api';
import { CreateTaskButton } from './CreateTaskButton';
import { AutoFixButton } from './AutoFixButton';

export interface BugCardProps {
  bug: QALoopBug;
  severityColor: (s: string) => string;
  safePathname: (url: string | undefined | null, fallback?: string) => string;
}

/** Expandable bug card with reproduction steps and action buttons */
export const BugCard: React.FC<BugCardProps> = ({ bug, severityColor, safePathname }) => {
  const [expanded, setExpanded] = useState(false);

  const reproSteps = Array.isArray(bug.reproduction_steps) ? bug.reproduction_steps : [];

  return (
    <div className="bg-slate-900 rounded-lg border-l-4 border-red-400 overflow-hidden">
      <div
        className="p-3 cursor-pointer hover:bg-slate-900 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className={`w-3 h-3 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-white">{bug.title}</span>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <AutoFixButton bugId={bug.id} bugTitle={bug.title} />
            <CreateTaskButton bugId={bug.id} bugTitle={bug.title} />
            <span className={`text-xs px-2 py-1 rounded ${severityColor(bug.severity)}`}>{bug.severity}</span>
          </div>
        </div>
        {bug.description && <p className="text-sm text-slate-400 mt-1 ml-5">{bug.description}</p>}
        <div className="text-xs text-slate-500 mt-2 ml-5 flex items-center gap-3">
          {bug.category && <span className="bg-slate-700 px-1.5 py-0.5 rounded">{bug.category}</span>}
          {bug.bug_type && <span className="bg-slate-700 px-1.5 py-0.5 rounded">{bug.bug_type}</span>}
          {bug.page_url && <span className="truncate max-w-xs">{safePathname(bug.page_url)}</span>}
          <span className={bug.status === 'open' ? 'text-red-500' : 'text-green-500'}>{bug.status}</span>
          {bug.video_path && (
            <span className="text-blue-500 flex items-center gap-0.5" title="Video recording available">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-700 mt-1 pt-3 ml-5 space-y-3">
          {reproSteps.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Reproduction Steps</div>
              <ol className="list-decimal list-inside space-y-1">
                {reproSteps.map((step: any, i: number) => (
                  <li key={i} className="text-sm text-slate-200">
                    {typeof step === 'string' ? step : step.description || step.action || JSON.stringify(step)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {bug.page_url && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Page URL</div>
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

          {bug.video_path && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Session Recording</div>
              <video
                controls
                preload="metadata"
                className="w-full rounded-lg max-h-64 bg-black"
                src={`/api/videos/${bug.video_path}`}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
