import React, { useState } from 'react';
import { QALoopBug, retestBug } from '../../services/qa-loop-api';
import { CreateTaskButton } from './CreateTaskButton';
import { AutoFixButton } from './AutoFixButton';

export interface BugCardProps {
  bug: QALoopBug;
  severityColor: (s: string) => string;
  safePathname: (url: string | undefined | null, fallback?: string) => string;
}

/** Expandable bug card with reproduction steps, evidence, and action buttons */
export const BugCard: React.FC<BugCardProps> = ({ bug, severityColor, safePathname }) => {
  const [expanded, setExpanded] = useState(false);
  const [retesting, setRetesting] = useState(false);
  const [retestError, setRetestError] = useState<string | null>(null);
  const [retestResult, setRetestResult] = useState<string | null>(null);

  const reproSteps = Array.isArray(bug.reproduction_steps) ? bug.reproduction_steps : [];
  const screenshots = Array.isArray((bug as any).evidence_screenshots) ? (bug as any).evidence_screenshots : [];

  const handleRetest = async () => {
    setRetesting(true);
    setRetestError(null);
    setRetestResult(null);
    try {
      const result = await retestBug(bug.id);
      setRetestResult(`Retest started (session: ${result.retestSessionId})`);
    } catch (err: any) {
      setRetestError(err.response?.data?.error || err.message || 'Retest failed');
    } finally {
      setRetesting(false);
    }
  };

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
            <button
              onClick={handleRetest}
              disabled={retesting}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              title="Re-run the test that found this bug"
            >
              <svg className={`w-3 h-3 ${retesting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {retesting ? 'Retesting...' : 'Retest'}
            </button>
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
          <span className={bug.status === 'open' ? 'text-red-500' : bug.status === 'fixed' ? 'text-green-500' : 'text-yellow-500'}>{bug.status}</span>
          {screenshots.length > 0 && (
            <span className="text-blue-500 flex items-center gap-0.5" title={`${screenshots.length} evidence screenshot(s)`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {screenshots.length}
            </span>
          )}
          {bug.video_path && (
            <span className="text-blue-500 flex items-center gap-0.5" title="Video recording available">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </span>
          )}
        </div>
        {retestResult && (
          <div className="text-xs text-green-600 mt-1 ml-5">{retestResult}</div>
        )}
        {retestError && (
          <div className="text-xs text-red-600 mt-1 ml-5">{retestError}</div>
        )}
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

          {/* Evidence screenshots */}
          {screenshots.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Evidence Screenshots</div>
              <div className="grid grid-cols-2 gap-2">
                {screenshots.map((src: string, i: number) => (
                  <a key={i} href={src.startsWith('/') ? `/api/screenshots${src}` : src} target="_blank" rel="noopener noreferrer">
                    <img
                      src={src.startsWith('/') ? `/api/screenshots${src}` : src}
                      alt={`Evidence ${i + 1}`}
                      className="rounded border border-gray-300 w-full h-32 object-cover hover:opacity-80 transition-opacity"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </a>
                ))}
              </div>
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

          {bug.video_path && (
            <div>
              <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Session Recording</div>
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
