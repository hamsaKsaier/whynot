import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiClock, FiCheckCircle, FiXCircle, FiAlertCircle, FiLoader, FiColumns } from 'react-icons/fi';
import { TestConfig } from '../components/Performance/TestConfig';
import { ResultsDashboard } from '../components/Performance/ResultsDashboard';
import { CompareRuns } from '../components/Performance/CompareRuns';
import { usePerfStream } from '../hooks/usePerfStream';
import { startPerfRun, stopPerfRun, getPerfRuns } from '../services/perf-api';
import type { PerfRunConfig, PerfRun } from '../services/perf-api';

export const PerformancePage: React.FC = () => {
  const { t } = useTranslation('runner');
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
      setError(err.response?.data?.error || err.message || t('runner.performance.startError'));
    }
  };

  const handleStop = async () => {
    if (!currentRunId) return;
    try {
      await stopPerfRun(currentRunId);
      setIsRunning(false);
      loadPastRuns();
    } catch (err: any) {
      setError(err.response?.data?.error || t('runner.performance.stopError'));
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{t('runner.performance.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('runner.performance.subtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 text-xs ms-4">{t('runner.performance.dismiss')}</button>
          </div>
        )}

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left — Configuration */}
          <div className="bg-card/50 border border-border rounded-lg p-5">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">{t('runner.performance.testConfiguration')}</h2>
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
                    ? t('runner.performance.selectFirstRun')
                    : t('runner.performance.selectSecondRun')}
                </span>
                <button onClick={() => { setCompareMode(false); setCompareRunA(null); setCompareRunB(null); }} className="text-sky-500 hover:text-sky-300 text-xs">{t('runner.performance.cancel')}</button>
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
                <h3 className="text-sm font-medium text-muted-foreground">{t('runner.performance.previousRuns')}</h3>
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
                        : 'text-muted-foreground hover:text-foreground border border-border hover:border-muted-foreground'
                    }`}
                  >
                    <FiColumns className="h-3 w-3" />
                    {compareMode ? t('runner.performance.comparing') : t('runner.performance.compare')}
                  </button>
                )}
              </div>

              {pastRunsLoading && pastRuns.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <FiLoader className="h-4 w-4 animate-spin" />
                  {t('runner.performance.loadingRuns')}
                </div>
              )}

              {!pastRunsLoading && pastRuns.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">{t('runner.performance.noRunsYet')}</p>
              )}

              <div className="space-y-2">
                {pastRuns.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => handleSelectPastRun(run)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-start ${
                      isRunSelected(run.id)
                        ? 'bg-sky-500/10 border-sky-500/30'
                        : 'bg-card border-border hover:border-muted-foreground'
                    }`}
                  >
                    {statusIcon(run.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground capitalize">
                          {t('runner.performance.testTypeLabel', { type: run.test_type })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(run.created_at)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {run.target_url}
                      </div>
                    </div>
                    <div className="text-end flex-shrink-0">
                      {run.total_requests != null && (
                        <div className="text-xs text-muted-foreground">
                          {t('runner.performance.requestCount', { count: run.total_requests, formattedCount: run.total_requests.toLocaleString() })}
                        </div>
                      )}
                      {run.avg_response_time_ms != null && (
                        <div className="text-xs text-muted-foreground">
                          {t('runner.performance.avgResponseTime', { ms: Math.round(run.avg_response_time_ms) })}
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
