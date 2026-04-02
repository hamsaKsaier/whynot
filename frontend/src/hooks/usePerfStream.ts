/**
 * usePerfStream.ts
 *
 * WebSocket hook for real-time performance test metric streaming.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PerfMetric {
  timestamp: string;
  vus: number;
  requests: number;
  failed: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
}

export interface PerfSummary {
  totalRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p90ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  maxResponseTimeMs: number;
  minResponseTimeMs: number;
  requestsPerSecond: number;
  thresholdResults: Record<string, { passed: boolean; actual: string }>;
}

export interface UsePerfStreamReturn {
  isConnected: boolean;
  error: string | null;
  currentMetric: PerfMetric | null;
  metricHistory: PerfMetric[];
  summary: PerfSummary | null;
  isComplete: boolean;
  connect: (runId: string) => void;
  disconnect: () => void;
}

export function usePerfStream(): UsePerfStreamReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMetric, setCurrentMetric] = useState<PerfMetric | null>(null);
  const [metricHistory, setMetricHistory] = useState<PerfMetric[]>([]);
  const [summary, setSummary] = useState<PerfSummary | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback((runId: string) => {
    disconnect();

    setIsConnected(false);
    setError(null);
    setCurrentMetric(null);
    setMetricHistory([]);
    setSummary(null);
    setIsComplete(false);

    // Build WebSocket URL — same pattern as useQALoopStream since
    // the perf WebSocket is on the same qa-loop-executor service
    const baseWsUrl = import.meta.env.VITE_QA_LOOP_WS_URL || (
      window.location.protocol === 'https:'
        ? `wss://${window.location.host}`
        : 'ws://localhost:3012'
    );

    const fullUrl = `${baseWsUrl}/ws/perf?runId=${runId}`;
    const ws = new WebSocket(fullUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'connected':
            setIsConnected(true);
            break;

          case 'perf_metric':
            setCurrentMetric(data.data);
            setMetricHistory(prev => {
              const next = [...prev, data.data];
              return next.length > 600 ? next.slice(-600) : next;
            });
            break;

          case 'perf_complete':
            setSummary(data.data);
            setIsComplete(true);
            break;

          case 'perf_error':
            setError(data.data.error);
            setIsComplete(true);
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection failed');
    };

    ws.onclose = () => {
      setIsConnected(false);
    };
  }, [disconnect]);

  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  return {
    isConnected,
    error,
    currentMetric,
    metricHistory,
    summary,
    isComplete,
    connect,
    disconnect,
  };
}
