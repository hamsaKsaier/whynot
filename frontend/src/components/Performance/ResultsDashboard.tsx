import React from 'react';
import { FiSquare } from 'react-icons/fi';
import { MetricCard } from './MetricCard';
import { ResponseTimeChart } from './ResponseTimeChart';
import { VirtualUsersChart } from './VirtualUsersChart';
import { ThresholdStatus } from './ThresholdStatus';
import type { PerfMetric, PerfSummary } from '../../hooks/usePerfStream';

interface ResultsDashboardProps {
  isRunning: boolean;
  isComplete: boolean;
  currentMetric: PerfMetric | null;
  metricHistory: PerfMetric[];
  summary: PerfSummary | null;
  testType: string;
  startedAt: string | null;
  onStop: () => void;
}

function formatDuration(startedAt: string | null): string {
  if (!startedAt) return '0:00';
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getStatusColor(isRunning: boolean, isComplete: boolean): string {
  if (isRunning) return 'text-emerald-400';
  if (isComplete) return 'text-sky-400';
  return 'text-slate-400';
}

function getStatusLabel(isRunning: boolean, isComplete: boolean, testType: string): string {
  const label = testType.charAt(0).toUpperCase() + testType.slice(1);
  if (isRunning) return `Running — ${label} Test`;
  if (isComplete) return `Completed — ${label} Test`;
  return `${label} Test`;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  isRunning,
  isComplete,
  currentMetric,
  metricHistory,
  summary,
  testType,
  startedAt,
  onStop,
}) => {
  // Use summary values when complete, otherwise use current metric
  const requests = summary?.totalRequests ?? currentMetric?.requests ?? 0;
  const avgRt = summary?.avgResponseTimeMs ?? currentMetric?.avgResponseTime ?? 0;
  const rps = summary?.requestsPerSecond ?? currentMetric?.requestsPerSecond ?? 0;
  const errorRate = currentMetric?.errorRate ?? (
    summary && summary.totalRequests > 0
      ? (summary.failedRequests / summary.totalRequests) * 100
      : 0
  );

  const errorColor = errorRate > 5 ? 'danger' : errorRate > 1 ? 'warning' : 'success';

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRunning && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          )}
          <span className={`text-sm font-medium ${getStatusColor(isRunning, isComplete)}`}>
            {getStatusLabel(isRunning, isComplete, testType)}
          </span>
          {startedAt && (
            <span className="text-xs text-slate-500">
              {formatDuration(startedAt)}
            </span>
          )}
        </div>
        {isRunning && (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
          >
            <FiSquare className="h-3 w-3" />
            Stop
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="Requests"
          value={requests}
        />
        <MetricCard
          label="Avg Response Time"
          value={Math.round(avgRt)}
          unit="ms"
        />
        <MetricCard
          label="Requests/sec"
          value={Math.round(rps * 10) / 10}
        />
        <MetricCard
          label="Error Rate"
          value={`${Math.round(errorRate * 100) / 100}%`}
          color={errorColor}
        />
      </div>

      {/* Charts */}
      {metricHistory.length > 0 && (
        <>
          <ResponseTimeChart data={metricHistory} />
          <VirtualUsersChart data={metricHistory} />
        </>
      )}

      {/* Response Time Distribution (after completion) */}
      {isComplete && summary && (
        <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Response Time Distribution</h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: 'Min', value: summary.minResponseTimeMs },
              { label: 'p50', value: summary.p50ResponseTimeMs },
              { label: 'p90', value: summary.p90ResponseTimeMs },
              { label: 'p95', value: summary.p95ResponseTimeMs },
              { label: 'p99', value: summary.p99ResponseTimeMs },
              { label: 'Max', value: summary.maxResponseTimeMs },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-lg font-semibold text-white">{Math.round(value)}<span className="text-xs text-slate-400 ml-0.5">ms</span></div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Thresholds */}
      {isComplete && summary?.thresholdResults && Object.keys(summary.thresholdResults).length > 0 && (
        <ThresholdStatus thresholds={summary.thresholdResults} />
      )}

      {/* Empty state */}
      {!isRunning && !isComplete && metricHistory.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4">
            <svg className="h-16 w-16 text-slate-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-300">No test running</h3>
          <p className="text-sm text-slate-500 mt-1">Configure a test on the left and click Run Test to get started</p>
        </div>
      )}
    </div>
  );
};
