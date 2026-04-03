import React, { useState, useEffect, useCallback } from 'react';
import { FiClock, FiCheckCircle, FiXCircle, FiAlertCircle, FiLoader, FiColumns } from 'react-icons/fi';
import { TestConfig } from '../components/Performance/TestConfig';
import { ResultsDashboard } from '../components/Performance/ResultsDashboard';
import { CompareRuns } from '../components/Performance/CompareRuns';
import { usePerfStream } from '../hooks/usePerfStream';
import { startPerfRun, stopPerfRun, getPerfRuns } from '../services/perf-api';
import type { PerfRunConfig, PerfRun } from '../services/perf-api';

export const PerformancePage: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentTestType, setCurrentTestType] = useState<string>('load');
  const [currentTargetUrl, setCurrentTargetUrl] = useState<string>('');
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [pastRuns, setPastRuns] = useState<PerfRun[]>([]);
  const [pastRunsLoading, setPastRunsLoading] = useState(true);
  const [selectedPastRun, setSelectedPastRun] = useState<PerfRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareRunA, setCompareRunA] = useState<PerfRun | null>(null);
  const [compareRunB, setCompareRunB] = useState<PerfRun | null>(null);

  const perfStream = usePerfStream();

  // Load past runs
  const loadPastRuns = useCallback(async () => {
    setPastRunsLoading(true);
    try {
      const { runs } = await getPerfRuns({ limit: 20 });
      setPastRuns(runs);
    } catch {
      // ignore — not critical
    } finally {
      setPastRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPastRuns();
  }, [loadPastRuns]);

  // Reload past runs when test completes
  useEffect(() => {
    if (perfStream.isComplete) {
      setIsRunning(false);
      loadPastRuns();
    }
  }, [perfStream.isComplete, loadPastRuns]);

  const handleRun = async (config: PerfRunConfig) => {
    setError(null);
    setSelectedPastRun(null);
    setCompareMode(false);

    try {
      const response = await startPerfRun(config);
      setCurrentRunId(response.runId);
      setCurrentTestType(config.testType);
      setCurrentTargetUrl(config.targetUrl);
      setStartedAt(new Date().toISOString());
      setIsRunning(true);
      perfStream.connect(response.runId);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to start test');
    }
  };

  const handleStop = async () => {
    if (!currentRunId) return;
    try {
      await stopPerfRun(currentRunId);
      setIsRunning(false);
      loadPastRuns();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to stop test');
    }
  };

  const handleSelectPastRun = (run: PerfRun) => {
    if (compareMode) {
      if (!compareRunA) {
        setCompareRunA(run);
      } else if (!compareRunB && run.id !== compareRunA.id) {
        setCompareRunB(run);
      }
      return;
    }
    setSelectedPastRun(run);
    setCurrentRunId(null);
    setIsRunning(false);
    perfStream.disconnect();
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <FiCheckCircle className="h-4 w-4 text-emerald-400" />;
      case 'failed': return <FiXCircle className="h-4 w-4 text-red-400" />;
      case 'stopped': return <FiAlertCircle className="h-4 w-4 text-amber-400" />;
      default: return <FiClock className="h-4 w-4 text-sky-400" />;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Build summary from selected past run
  const pastRunSummary = selectedPastRun ? {
    totalRequests: selectedPastRun.total_requests || 0,
    failedRequests: selectedPastRun.raw_metrics?.failedRequests ?? selectedPastRun.failed_requests ?? 0,
    successfulRequests: selectedPastRun.raw_metrics?.successfulRequests ?? (selectedPastRun.total_requests || 0) - (selectedPastRun.failed_requests || 0),
    avgResponseTimeMs: selectedPastRun.avg_response_time_ms || 0,
    p50ResponseTimeMs: selectedPastRun.p50_response_time_ms || 0,
    p90ResponseTimeMs: selectedPastRun.p90_response_time_ms || 0,
    p95ResponseTimeMs: selectedPastRun.p95_response_time_ms || 0,
    p99ResponseTimeMs: selectedPastRun.p99_response_time_ms || 0,
    maxResponseTimeMs: selectedPastRun.max_response_time_ms || 0,
    minResponseTimeMs: selectedPastRun.min_response_time_ms || 0,
    requestsPerSecond: selectedPastRun.requests_per_second || 0,
    thresholdResults: selectedPastRun.raw_metrics?.thresholdResults || {},
  } : null;

  const isRunSelected = (runId: string) =>
    compareMode
      ? runId === compareRunA?.id || runId === compareRunB?.id
      : runId === selectedPastRun?.id;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Performance Testing</h1>
          <p className="text-sm text-slate-400 mt-1">
            Run load, stress, spike, and smoke tests against your APIs
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 text-xs ml-4">Dismiss</button>
          </div>
        )}

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left — Configuration */}
          <div className="bg-[#1e293b]/50 border border-[#334155] rounded-xl p-5">
            <h2 className="text-sm font-medium text-slate-300 mb-4">Test Configuration</h2>
            <TestConfig onRun={handleRun} isRunning={isRunning} />
          </div>

          {/* Right — Results */}
          <div>
            {/* Compare view */}
            {compareMode && compareRunA && compareRunB && (
              <div className="mb-4">
                <CompareRuns
                  runA={compareRunA}
                  runB={compareRunB}
                  onClose={() => { setCompareMode(false); setCompareRunA(null); setCompareRunB(null); }}
                />
              </div>
            )}

            {/* Compare mode prompt */}
            {compareMode && (!compareRunA || !compareRunB) && (
              <div className="mb-4 px-4 py-3 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-400 text-sm flex items-center justify-between">
                <span>
                  {!compareRunA
                    ? 'Select the first run to compare'
                    : 'Now select the second run to compare'}
                </span>
                <button onClick={() => { setCompareMode(false); setCompareRunA(null); setCompareRunB(null); }} className="text-sky-500 hover:text-sky-300 text-xs">Cancel</button>
              </div>
            )}

            {/* Results dashboard */}
            {!compareMode && (
              <ResultsDashboard
                isRunning={isRunning}
                isComplete={selectedPastRun ? true : perfStream.isComplete}
                currentMetric={perfStream.currentMetric}
                metricHistory={perfStream.metricHistory}
                summary={selectedPastRun ? pastRunSummary : perfStream.summary}
                testType={selectedPastRun?.test_type || currentTestType}
                targetUrl={selectedPastRun?.target_url || currentTargetUrl}
                startedAt={selectedPastRun?.started_at || startedAt}
                onStop={handleStop}
                onRunAgain={() => { setSelectedPastRun(null); perfStream.disconnect(); }}
              />
            )}

            {/* Past Runs */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-300">Previous Runs</h3>
                {pastRuns.filter(r => r.status === 'completed').length >= 2 && (
                  <button
                    onClick={() => {
                      if (compareMode) {
                        setCompareMode(false);
                        setCompareRunA(null);
                        setCompareRunB(null);
                      } else {
                        setCompareMode(true);
                        setSelectedPastRun(null);
                        perfStream.disconnect();
                      }
                    }}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors ${
                      compareMode
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50'
                        : 'text-slate-500 hover:text-slate-300 border border-[#334155] hover:border-slate-500'
                    }`}
                  >
                    <FiColumns className="h-3 w-3" />
                    {compareMode ? 'Comparing...' : 'Compare'}
                  </button>
                )}
              </div>

              {pastRunsLoading && pastRuns.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                  <FiLoader className="h-4 w-4 animate-spin" />
                  Loading previous runs...
                </div>
              )}

              {!pastRunsLoading && pastRuns.length === 0 && (
                <p className="text-sm text-slate-600 py-4">No previous runs yet. Run your first test above!</p>
              )}

              <div className="space-y-2">
                {pastRuns.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => handleSelectPastRun(run)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                      isRunSelected(run.id)
                        ? 'bg-sky-500/10 border-sky-500/30'
                        : 'bg-[#1e293b] border-[#334155] hover:border-slate-500'
                    }`}
                  >
                    {statusIcon(run.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white capitalize">
                          {run.test_type} Test
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDate(run.created_at)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {run.target_url}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {run.total_requests != null && (
                        <div className="text-xs text-slate-400">
                          {run.total_requests.toLocaleString()} req
                        </div>
                      )}
                      {run.avg_response_time_ms != null && (
                        <div className="text-xs text-slate-500">
                          {Math.round(run.avg_response_time_ms)}ms avg
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
