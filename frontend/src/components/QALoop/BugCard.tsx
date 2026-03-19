import React, { useState } from 'react';
import { QALoopBug, retestBug } from '../../services/qa-loop-api';
import { CreateTaskButton } from './CreateTaskButton';
import { AutoFixButton } from './AutoFixButton';
import { reportBug, BugReportProvider } from '../../services/integrations-api';
import { useToastContext } from '../../contexts/ToastContext';

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
  const [reporting, setReporting] = useState<BugReportProvider | null>(null);
  const [reportedTo, setReportedTo] = useState<string | null>((bug as any).reported_to || null);
  const [externalUrl, setExternalUrl] = useState<string | null>((bug as any).external_url || null);

  const { success: toastSuccess, error: toastError } = useToastContext();

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
      // Prefer humanError (human-readable Playwright error) over raw error
      const humanError = err.response?.data?.humanError;
      setRetestError(humanError || err.response?.data?.error || err.message || 'Retest failed');
    } finally {
      setRetesting(false);
    }
  };

  const handleReport = async (provider: BugReportProvider) => {
    setReporting(provider);
    try {
      const result = await reportBug(bug.id, provider);
      setReportedTo(provider);
      setExternalUrl(result.externalUrl);
      toastSuccess(`Bug reported to ${provider === 'clickup' ? 'ClickUp' : 'GitHub Issues'}`);
    } catch (err: any) {
      toastError(err.response?.data?.error || err.message || `Failed to report to ${provider}`);
    } finally {
      setReporting(null);
    }
  };

  const isReported = !!reportedTo;

  return (
    <div className="bg-slate-900 rounded-lg border-l-4 border-red-400 overflow-hidden">
      <div
        className="p-3 cursor-pointer hover:bg-slate-800 transition-colors"
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
            {/* Report to ClickUp */}
            {isReported && reportedTo === 'clickup' ? (
              <a
                href={externalUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-900/20 text-green-700 hover:bg-green-900/30 transition-colors"
                title="View in ClickUp"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Reported to ClickUp
              </a>
            ) : (
              <button
                onClick={() => handleReport('clickup')}
                disabled={reporting !== null || isReported}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-sky-900/20 text-sky-700 hover:bg-sky-900/30 disabled:opacity-50 transition-colors"
                title="Report to ClickUp"
              >
                {reporting === 'clickup' ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                )}
                {reporting === 'clickup' ? 'Reporting...' : 'Report to ClickUp'}
              </button>
            )}

            {/* Report to GitHub */}
            {isReported && reportedTo === 'github' ? (
              <a
                href={externalUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-900/20 text-green-700 hover:bg-green-900/30 transition-colors"
                title="View in GitHub Issues"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Reported to GitHub
              </a>
            ) : (
              <button
                onClick={() => handleReport('github')}
                disabled={reporting !== null || isReported}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                title="Report to GitHub Issues"
              >
                {reporting === 'github' ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                )}
                {reporting === 'github' ? 'Reporting...' : 'Report to GitHub'}
              </button>
            )}

            <button
              onClick={handleRetest}
              disabled={retesting}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-600 text-slate-400 hover:bg-slate-800 disabled:opacity-50 transition-colors"
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
        {bug.description && <p className="text-sm text-slate-400 mt-1 ml-5">{bug.description}</p>}
        <div className="text-xs text-slate-500 mt-2 ml-5 flex items-center gap-3">
          {bug.category && <span className="bg-slate-700 px-1.5 py-0.5 rounded">{bug.category}</span>}
          {bug.bug_type && <span className="bg-slate-700 px-1.5 py-0.5 rounded">{bug.bug_type}</span>}
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

          {/* Evidence screenshots */}
          {screenshots.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Evidence Screenshots</div>
              <div className="grid grid-cols-2 gap-2">
                {screenshots.map((src: string, i: number) => (
                  <a key={i} href={src.startsWith('/') ? `/api/screenshots${src}` : src} target="_blank" rel="noopener noreferrer">
                    <img
                      src={src.startsWith('/') ? `/api/screenshots${src}` : src}
                      alt={`Evidence ${i + 1}`}
                      className="rounded border border-slate-600 w-full h-32 object-cover hover:opacity-80 transition-opacity"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {bug.page_url && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Page URL</div>
              <a
                href={bug.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:text-primary-300 break-all"
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
