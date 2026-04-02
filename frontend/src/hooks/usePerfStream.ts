/**
 * usePerfStream.ts
 *
 * WebSocket hook for real-time performance test metric streaming.
 * Includes exponential backoff reconnection on disconnect.
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

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000; // 1s

export function usePerfStream(): UsePerfStreamReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMetric, setCurrentMetric] = useState<PerfMetric | null>(null);
  const [metricHistory, setMetricHistory] = useState<PerfMetric[]>([]);
  const [summary, setSummary] = useState<PerfSummary | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const runIdRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const createConnection = useCallback((runId: string) => {
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
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data || typeof data !== 'object') return;

        switch (data.type) {
          case 'connected':
            setIsConnected(true);
            break;

          case 'perf_metric':
            if (data.data && typeof data.data.requests === 'number') {
              setCurrentMetric(data.data);
              setMetricHistory(prev => {
                const next = [...prev, data.data];
                return next.length > 600 ? next.slice(-600) : next;
              });
            }
            break;

          case 'perf_complete':
            setSummary(data.data);
            setIsComplete(true);
            intentionalCloseRef.current = true;
            break;

          case 'perf_error':
            setError(data.data?.error || 'Test failed');
            setIsComplete(true);
            intentionalCloseRef.current = true;
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — handle reconnection there
    };

    ws.onclose = () => {
      setIsConnected(false);

      // Don't reconnect if intentional close, test completed, or max attempts reached
      if (intentionalCloseRef.current || !runIdRef.current) return;

      if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current);
        reconnectAttemptRef.current++;
        reconnectTimerRef.current = setTimeout(() => {
          if (runIdRef.current) {
            createConnection(runIdRef.current);
          }
        }, delay);
      } else {
        setError('Lost connection to server. Please refresh the page.');
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    runIdRef.current = null;
    reconnectAttemptRef.current = 0;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [clearReconnectTimer]);

  const connect = useCallback((runId: string) => {
    disconnect();

    intentionalCloseRef.current = false;
    runIdRef.current = runId;
    setIsConnected(false);
    setError(null);
    setCurrentMetric(null);
    setMetricHistory([]);
    setSummary(null);
    setIsComplete(false);

    createConnection(runId);
  }, [disconnect, createConnection]);

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
