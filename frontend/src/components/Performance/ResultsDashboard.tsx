import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiSquare, FiCheckCircle, FiXCircle, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import { MetricCard } from './MetricCard';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { ResponseTimeChart } from './ResponseTimeChart';
import { VirtualUsersChart } from './VirtualUsersChart';
import { RPSChart } from './RPSChart';
import { ThresholdStatus } from './ThresholdStatus';
import type { PerfMetric, PerfSummary } from '../../hooks/usePerfStream';

interface ResultsDashboardProps {
  isRunning: boolean;
  isComplete: boolean;
  currentMetric: PerfMetric | null;
  metricHistory: PerfMetric[];
  summary: PerfSummary | null;
  testType: string;
  targetUrl: string;
  startedAt: string | null;
  onStop: () => void;
  onRunAgain?: () => void;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getVerdict(summary: PerfSummary, t: (key: string, opts?: Record<string, unknown>) => string): {
  status: 'pass' | 'warning' | 'fail';
  headline: string;
  details: string[];
} {
  const issues: string[] = [];
  let status: 'pass' | 'warning' | 'fail' = 'pass';

  const rpsLabel = summary.requestsPerSecond < 1
    ? summary.requestsPerSecond.toFixed(1)
    : Math.round(summary.requestsPerSecond).toString();

  const errorRate = summary.totalRequests > 0
    ? (summary.failedRequests / summary.totalRequests) * 100
    : 0;

  if (errorRate > 5) {
    status = 'fail';
    issues.push(t('runner.performance.verdict.highErrorRate', { errorPct: errorRate.toFixed(1) }));
  } else if (errorRate > 1) {
    status = status === 'pass' ? 'warning' : status;
    issues.push(t('runner.performance.verdict.moderateErrorRate', { errorPct: errorRate.toFixed(1) }));
  }

  if (summary.p95ResponseTimeMs > 5000) {
    status = 'fail';
    issues.push(t('runner.performance.verdict.slowP95', { seconds: (summary.p95ResponseTimeMs / 1000).toFixed(1) }));
  } else if (summary.p95ResponseTimeMs > 2000) {
    status = status === 'pass' ? 'warning' : status;
    issues.push(t('runner.performance.verdict.moderateP95', { ms: Math.round(summary.p95ResponseTimeMs) }));
  }

  if (summary.p99ResponseTimeMs > summary.p95ResponseTimeMs * 3 && summary.p99ResponseTimeMs > 1000) {
    status = status === 'pass' ? 'warning' : status;
    issues.push(t('runner.performance.verdict.spikyP99', { ms: Math.round(summary.p99ResponseTimeMs) }));
  }

  let headline: string;
  if (status === 'pass') {
    headline = t('runner.performance.verdict.okLatency', { rps: rpsLabel, avgMs: Math.round(summary.avgResponseTimeMs) });
  } else if (status === 'warning') {
    headline = t('runner.performance.verdict.warningHeadline');
  } else {
    headline = t('runner.performance.verdict.failHeadline');
  }

  if (issues.length === 0) {
    issues.push(t('runner.performance.verdict.goodAvg', { avgMs: Math.round(summary.avgResponseTimeMs) }));
    const successPct = summary.totalRequests > 0
      ? Math.round(((summary.successfulRequests || 0) / summary.totalRequests) * 100)
      : 0;
    issues.push(t('runner.performance.verdict.successRate', { totalRequests: summary.totalRequests.toLocaleString(), successPct }));
  }

  return { status, headline, details: issues };
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  isRunning,
  isComplete,
  currentMetric,
  metricHistory,
  summary,
  testType,
  targetUrl,
  startedAt,
  onStop,
  onRunAgain,
}) => {
  const { t, i18n } = useTranslation('runner');

  // Live elapsed timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isRunning || !startedAt) { setElapsed(0); return; }
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, startedAt]);

  const prev = metricHistory.length > 1 ? metricHistory[metricHistory.length - 2] : undefined;

  const requests = summary?.totalRequests ?? currentMetric?.requests ?? 0;
  const avgRt = summary?.avgResponseTimeMs ?? currentMetric?.avgResponseTime ?? 0;
  const rps = summary?.requestsPerSecond ?? currentMetric?.requestsPerSecond ?? 0;
  // Error rate = server errors (5xx) only
  const errorRate = currentMetric?.errorRate ?? (
    summary && summary.totalRequests > 0
      ? Math.round((summary.failedRequests / summary.totalRequests) * 10000) / 100
      : 0
  );

  const rtColor = avgRt > 2000 ? 'danger' : avgRt > 500 ? 'warning' : 'success';
  const errorColor = errorRate > 5 ? 'danger' : errorRate > 1 ? 'warning' : 'success';
  const label = testType.charAt(0).toUpperCase() + testType.slice(1);
  const verdict = isComplete && summary ? getVerdict(summary, t) : null;

  // ── Empty state
  if (!isRunning && !isComplete && metricHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg className="h-16 w-16 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="text-lg font-medium text-slate-400">{t('runner.performance.noTestRunning')}</h3>
        <p className="text-sm text-slate-600 mt-1 max-w-sm">
          {t('runner.performance.configurePrompt')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Status Header */}
      <div className="bg-card border border-border rounded-lg px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRunning && (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          )}
          {isComplete && !isRunning && verdict && (
            verdict.status === 'pass'
              ? <FiCheckCircle className="h-5 w-5 text-emerald-400" />
              : verdict.status === 'warning'
              ? <FiAlertTriangle className="h-5 w-5 text-amber-400" />
              : <FiXCircle className="h-5 w-5 text-red-400" />
          )}
          <div>
            <span className={`text-sm font-medium ${isRunning ? 'text-emerald-400' : verdict?.status === 'pass' ? 'text-emerald-400' : verdict?.status === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>
              {isRunning ? t('runner.performance.runningTest', { type: label }) : t('runner.performance.completedTest', { type: label })}
            </span>
            {targetUrl && (
              <div className="text-xs text-slate-500 truncate max-w-md">{targetUrl}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isRunning && (
            <>
              <span className="text-sm font-mono text-slate-400 tabular-nums">{formatTime(elapsed)}</span>
              <button onClick={onStop} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/20 transition-colors">
                <FiSquare className="h-3 w-3" /> {t('runner.performance.stop')}
              </button>
            </>
          )}
          {isComplete && startedAt && (
            <span className="text-xs text-slate-500">
              {new Date(startedAt).toLocaleString(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* ── Verdict Banner (after completion) */}
      {isComplete && verdict && (
        <div className={`rounded-lg px-5 py-4 border ${
          verdict.status === 'pass' ? 'bg-emerald-500/5 border-emerald-500/20' :
          verdict.status === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
          'bg-red-500/5 border-red-500/20'
        }`}>
          <p className={`text-sm font-medium mb-2 ${
            verdict.status === 'pass' ? 'text-emerald-300' :
            verdict.status === 'warning' ? 'text-amber-300' :
            'text-red-300'
          }`}>
            {verdict.headline}
          </p>
          <ul className="space-y-1">
            {verdict.details.map((d, i) => (
              <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="mt-0.5">•</span><span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Metric Cards */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label={t('runner.performance.totalRequests')}
          value={requests}
          previousValue={prev?.requests}
        />
        <MetricCard
          label={t('runner.performance.avgResponseTime')}
          value={Math.round(avgRt)}
          unit="ms"
          color={rtColor}
          previousValue={prev ? Math.round(prev.avgResponseTime) : undefined}
        />
        <MetricCard
          label={t('runner.performance.throughput')}
          value={rps}
          unit="req/s"
          previousValue={prev?.requestsPerSecond}
          formatValue={(v) => (Math.round(v * 10) / 10).toString()}
        />
        <MetricCard
          label={t('runner.performance.serverErrors')}
          value={errorRate}
          unit="%"
          color={errorColor}
          previousValue={prev?.errorRate}
          formatValue={(v) => (Math.round(v * 100) / 100).toString()}
          invertTrend
        />
      </div>

      {/* ── Charts */}
      {metricHistory.length > 1 && (
        <ChartErrorBoundary>
          <ResponseTimeChart data={metricHistory} />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <VirtualUsersChart data={metricHistory} />
            <RPSChart data={metricHistory} />
          </div>
        </ChartErrorBoundary>
      )}

      {/* ── Thresholds */}
      {summary?.thresholdResults && Object.keys(summary.thresholdResults).length > 0 && (
        <ThresholdStatus thresholds={summary.thresholdResults} />
      )}

      {/* ── Response Breakdown (after completion) */}
      {isComplete && summary && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-3">{t('runner.performance.responseBreakdown')}</h3>
          <div className="space-y-2">
            {(() => {
              const success = summary.successfulRequests || 0;
              const failed = summary.failedRequests || 0;
              const total = summary.totalRequests || 1;
              const rows = [
                { label: t('runner.performance.expectedStatus'), count: success, pct: Math.round((success / total) * 100), color: 'bg-emerald-500', textColor: 'text-emerald-400' },
                { label: t('runner.performance.unexpectedStatus'), count: failed, pct: Math.round((failed / total) * 100), color: 'bg-red-500', textColor: 'text-red-400' },
              ].filter(r => r.count > 0);
              return rows.map(r => (
                <div key={r.label} className="flex items-center gap-3">
                  <div className="w-36 text-xs text-slate-400">{r.label}</div>
                  <div className="flex-1 h-5 bg-background rounded overflow-hidden">
                    <div className={`h-full ${r.color} rounded`} style={{ width: `${Math.max(r.pct, 2)}%`, opacity: 0.7 }} />
                  </div>
                  <div className={`text-xs font-mono tabular-nums w-20 text-end ${r.textColor}`}>
                    {r.count.toLocaleString()} ({r.pct}%)
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* ── Response Time Distribution (after completion) */}
      {isComplete && summary && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-1">{t('runner.performance.responseTimeDistribution')}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('runner.performance.responseTimeHint')}</p>
          <div className="flex items-end gap-2" style={{ height: 80 }}>
            {[
              { label: t('runner.performance.fastest'), value: summary.minResponseTimeMs, color: '#10b981' },
              { label: t('runner.performance.p50Users'), value: summary.p50ResponseTimeMs, color: '#0ea5e9' },
              { label: t('runner.performance.p90Users'), value: summary.p90ResponseTimeMs, color: '#f59e0b' },
              { label: t('runner.performance.p95Users'), value: summary.p95ResponseTimeMs, color: '#f97316' },
              { label: t('runner.performance.p99Users'), value: summary.p99ResponseTimeMs, color: '#ef4444' },
              { label: t('runner.performance.slowest'), value: summary.maxResponseTimeMs, color: '#dc2626' },
            ].map(({ label: l, value, color }) => {
              const maxVal = summary.maxResponseTimeMs || 1;
              const height = Math.max(8, (value / maxVal) * 68);
              return (
                <div key={l} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[11px] font-mono text-slate-300 tabular-nums">{Math.round(value)}ms</span>
                  <div className="w-full rounded-t transition-colors" style={{ height, backgroundColor: color, opacity: 0.85 }} />
                  <span className="text-[10px] text-slate-500 text-center leading-tight">{l}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Run Again */}
      {isComplete && onRunAgain && (
        <div className="flex gap-3">
          <button onClick={onRunAgain} className="flex items-center gap-2 px-4 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/30 rounded-lg text-sm hover:bg-sky-500/20 transition-colors">
            <FiRefreshCw className="h-4 w-4" /> {t('runner.performance.runAgain')}
          </button>
        </div>
      )}
    </div>
  );
};
