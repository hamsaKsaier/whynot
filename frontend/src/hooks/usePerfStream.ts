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
  p95ResponseTime: number;
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
  const runIdRef = useRef<string | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    runIdRef.current = null;
  }, []);

  const connect = useCallback((runId: string) => {
    // Disconnect existing connection
    disconnect();

    runIdRef.current = runId;
    setIsConnected(false);
    setError(null);
    setCurrentMetric(null);
    setMetricHistory([]);
    setSummary(null);
    setIsComplete(false);

    // Build WebSocket URL
    const apiUrl = import.meta.env.VITE_API_URL || '';
    let wsUrl: string;

    if (apiUrl.startsWith('http')) {
      // Direct connection to qa-loop-executor
      const qaLoopUrl = import.meta.env.VITE_QA_LOOP_WS_URL || apiUrl.replace('/api', '');
      wsUrl = qaLoopUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    } else {
      // Relative URL — construct from window.location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}`;
    }

    // The perf WS endpoint is on the qa-loop-executor service
    const qaLoopWsUrl = import.meta.env.VITE_QA_LOOP_WS_URL || wsUrl;
    const fullUrl = `${qaLoopWsUrl}/ws/perf?runId=${runId}`;

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
              // Keep last 500 data points
              return next.length > 500 ? next.slice(-500) : next;
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
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
