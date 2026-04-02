import React, { useState, useEffect } from 'react';
import { FiSquare } from 'react-icons/fi';
import { MetricCard } from './MetricCard';
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
}) => {
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Current + previous metric for trend arrows
  const prev = metricHistory.length > 1 ? metricHistory[metricHistory.length - 2] : undefined;

  const requests = summary?.totalRequests ?? currentMetric?.requests ?? 0;
  const avgRt = summary?.avgResponseTimeMs ?? currentMetric?.avgResponseTime ?? 0;
  const rps = summary?.requestsPerSecond ?? currentMetric?.requestsPerSecond ?? 0;
  const errorRate = currentMetric?.errorRate ?? (
    summary && summary.totalRequests > 0
      ? Math.round((summary.failedRequests / summary.totalRequests) * 10000) / 100
      : 0
  );

  const rtColor = avgRt > 2000 ? 'danger' : avgRt > 500 ? 'warning' : 'success';
  const errorColor = errorRate > 5 ? 'danger' : errorRate > 1 ? 'warning' : 'success';

  const label = testType.charAt(0).toUpperCase() + testType.slice(1);

  // Empty state
  if (!isRunning && !isComplete && metricHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg className="h-16 w-16 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="text-lg font-medium text-slate-400">No test running</h3>
        <p className="text-sm text-slate-600 mt-1 max-w-sm">
          Configure a test on the left and click Run Test to start seeing real-time results
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-lg px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRunning && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          )}
          {isComplete && !isRunning && (
            <span className="flex h-3 w-3 rounded-full bg-sky-500" />
          )}
          <div>
            <span className={`text-sm font-medium ${isRunning ? 'text-emerald-400' : 'text-sky-400'}`}>
              {isRunning ? `Running — ${label} Test` : `Completed — ${label} Test — ${formatTime(elapsed || (summary ? Math.round((summary as any)?.durationMs / 1000 || 0) : 0))}`}
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
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
              >
                <FiSquare className="h-3 w-3" />
                Stop
              </button>
            </>
          )}
          {isComplete && startedAt && (
            <span className="text-xs text-slate-500">
              {new Date(startedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="Requests"
          value={requests}
          previousValue={prev?.requests}
        />
        <MetricCard
          label="Avg Response Time"
          value={Math.round(avgRt)}
          unit="ms"
          color={rtColor}
          previousValue={prev ? Math.round(prev.avgResponseTime) : undefined}
        />
        <MetricCard
          label="Requests/sec"
          value={rps}
          previousValue={prev?.requestsPerSecond}
          formatValue={(v) => (Math.round(v * 10) / 10).toString()}
        />
        <MetricCard
          label="Error Rate"
          value={errorRate}
          unit="%"
          color={errorColor}
          previousValue={prev?.errorRate}
          formatValue={(v) => (Math.round(v * 100) / 100).toString()}
        />
      </div>

      {/* Charts */}
      {metricHistory.length > 1 && (
        <>
          <ResponseTimeChart data={metricHistory} />
          <div className="grid grid-cols-2 gap-4">
            <VirtualUsersChart data={metricHistory} />
            <RPSChart data={metricHistory} />
          </div>
        </>
      )}

      {/* Thresholds */}
      {summary?.thresholdResults && Object.keys(summary.thresholdResults).length > 0 && (
        <ThresholdStatus thresholds={summary.thresholdResults} />
      )}

      {/* Response Time Distribution (after completion) */}
      {isComplete && summary && (
        <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Response Time Distribution</h3>
          <div className="flex items-end gap-1 mb-4" style={{ height: 60 }}>
            {[
              { label: 'Min', value: summary.minResponseTimeMs, color: '#10b981' },
              { label: 'p50', value: summary.p50ResponseTimeMs, color: '#0ea5e9' },
              { label: 'p90', value: summary.p90ResponseTimeMs, color: '#f59e0b' },
              { label: 'p95', value: summary.p95ResponseTimeMs, color: '#f97316' },
              { label: 'p99', value: summary.p99ResponseTimeMs, color: '#ef4444' },
              { label: 'Max', value: summary.maxResponseTimeMs, color: '#dc2626' },
            ].map(({ label, value, color }) => {
              const maxVal = summary.maxResponseTimeMs || 1;
              const height = Math.max(4, (value / maxVal) * 56);
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-400 tabular-nums">{Math.round(value)}ms</span>
                  <div
                    className="w-full rounded-t"
                    style={{ height, backgroundColor: color, opacity: 0.8 }}
                  />
                  <span className="text-[10px] text-slate-500">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
