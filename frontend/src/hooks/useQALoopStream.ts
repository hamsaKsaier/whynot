import { useState, useEffect, useCallback, useRef } from 'react';

export interface QALoopEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'progress' | 'error' |
  'iteration_start' | 'iteration_end' | 'page_discovered' | 'page_explored' |
  'test_generated' | 'bug_found' | 'session_complete' | 'connected' |
  'screenshot' | 'status_update' | 'test_run_start' | 'test_run_result';
  data: any;
  timestamp: string;
}

export interface TestRunActivity {
  testCaseId: string;
  testCaseName: string;
  status: 'running' | 'passed' | 'failed' | 'error';
  durationMs?: number;
  failureReason?: string;
  isMismatch?: boolean;
  observedResult?: 'pass' | 'fail';
  timestamp: string;
}

interface UseQALoopStreamOptions {
  sessionId?: string;
  enabled?: boolean;
  wsUrl?: string;
  wsToken?: string;
}

export interface CostInfo {
  totalCostCents: number;
  inputTokens: number;
  outputTokens: number;
  modelName: string;
}

interface UseQALoopStreamReturn {
  isConnected: boolean;
  currentScreenshot: string | null;
  currentUrl: string | null;
  thinkingText: string;
  toolCalls: Array<{ tool: string; input: any; result?: any; timestamp: string }>;
  testRunActivity: TestRunActivity[];
  iteration: number;
  pagesDiscovered: string[];
  pagesExplored: string[];
  testsGenerated: string[];
  bugsFound: Array<{ title: string; severity: string }>;
  sessionStatus: string | null;
  currentPhase: string | null;
  currentMessage: string | null;
  costInfo: CostInfo;
  sessionStartTime: number | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
}

export function useQALoopStream({
  sessionId,
  enabled = true,
  wsUrl,
  wsToken
}: UseQALoopStreamOptions): UseQALoopStreamReturn {
  const [isConnected, setIsConnected] = useState(false);
  // `events` state removed in 5.8 — was accumulated but never consumed by any component
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [thinkingText, setThinkingText] = useState('');
  const [toolCalls, setToolCalls] = useState<Array<{ tool: string; input: any; result?: any; timestamp: string }>>([]);
  const [testRunActivity, setTestRunActivity] = useState<TestRunActivity[]>([]);
  const [iteration, setIteration] = useState(0);
  const [pagesDiscovered, setPagesDiscovered] = useState<string[]>([]);
  const [pagesExplored, setPagesExplored] = useState<string[]>([]);
  const [testsGenerated, setTestsGenerated] = useState<string[]>([]);
  const [bugsFound, setBugsFound] = useState<Array<{ title: string; severity: string }>>([]);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [costInfo, setCostInfo] = useState<CostInfo>({ totalCostCents: 0, inputTokens: 0, outputTokens: 0, modelName: '' });
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  // O(1) dedup sets that shadow the pagesDiscovered/pagesExplored arrays (4.4)
  const pagesDiscoveredSet = useRef<Set<string>>(new Set());
  const pagesExploredSet = useRef<Set<string>>(new Set());

  const baseWsUrl = wsUrl || import.meta.env.VITE_QA_LOOP_WS_URL || 'ws://localhost:3012';

  const clearEvents = useCallback(() => {
    setThinkingText('');
    setToolCalls([]);
    setCurrentScreenshot(null);
    setCurrentUrl(null);
    setPagesDiscovered([]);
    setPagesExplored([]);
    setTestsGenerated([]);
    setBugsFound([]);
    setTestRunActivity([]);
    setIteration(0);
    setSessionStatus(null);
    setCurrentPhase(null);
    setCurrentMessage(null);
    setCostInfo({ totalCostCents: 0, inputTokens: 0, outputTokens: 0, modelName: '' });
    setSessionStartTime(null);
    setError(null);
    // Reset the O(1) dedup Sets to stay in sync with the cleared arrays (4.4)
    pagesDiscoveredSet.current.clear();
    pagesExploredSet.current.clear();
  }, []);

  const processEvent = useCallback((event: QALoopEvent) => {
    switch (event.type) {
      case 'connected':
        setIsConnected(true);
        setError(null);
        setSessionStartTime(prev => prev ?? Date.now());
        break;

      case 'thinking':
        setThinkingText(prev => prev + (event.data?.text || ''));
        break;

      case 'tool_call':
        // Cap toolCalls at 50 to prevent unbounded memory growth
        setToolCalls(prev => [...prev.slice(-49), {
          tool: event.data?.tool,
          input: event.data?.input,
          timestamp: event.timestamp
        }]);
        // Add a separator between thinking blocks so they remain readable
        setThinkingText(prev => prev ? prev + '\n\n---\n\n' : '');
        break;

      case 'tool_result':
        setToolCalls(prev => {
          const updated = [...prev];
          const lastCall = updated[updated.length - 1];
          if (lastCall && lastCall.tool === event.data?.tool) {
            // Truncate large result payloads to 500 chars
            const raw = event.data?.result || event.data?.error;
            lastCall.result = typeof raw === 'string' ? raw.slice(0, 500) : raw;
          }
          return updated;
        });
        break;

      case 'screenshot':
        if (event.data?.screenshot) {
          setCurrentScreenshot(`data:image/png;base64,${event.data.screenshot}`);
        }
        if (event.data?.url) {
          setCurrentUrl(event.data.url);
        }
        break;

      case 'iteration_start':
        setIteration(event.data?.iteration || 0);
        setThinkingText('');
        break;

      case 'iteration_end':
        // Could update progress here
        break;

      case 'page_discovered':
        if (event.data?.url) {
          // O(1) dedup via Set ref instead of O(n) Array.includes (4.4)
          if (!pagesDiscoveredSet.current.has(event.data.url)) {
            pagesDiscoveredSet.current.add(event.data.url);
            setPagesDiscovered(prev => [...prev, event.data.url]);
          }
        }
        break;

      case 'page_explored':
        if (event.data?.url) {
          // O(1) dedup via Set ref instead of O(n) Array.includes (4.4)
          if (!pagesExploredSet.current.has(event.data.url)) {
            pagesExploredSet.current.add(event.data.url);
            setPagesExplored(prev => [...prev, event.data.url]);
          }
        }
        break;

      case 'test_generated':
        if (event.data?.name) {
          setTestsGenerated(prev => [...prev, event.data.name]);
        }
        break;

      case 'bug_found':
        if (event.data?.title) {
          setBugsFound(prev => [...prev, {
            title: event.data.title,
            severity: event.data.severity || 'medium'
          }]);
        }
        break;

      case 'status_update':
        if (event.data?.status) setSessionStatus(event.data.status);
        if (event.data?.phase) setCurrentPhase(event.data.phase);
        if (event.data?.message) setCurrentMessage(event.data.message);
        break;

      case 'session_complete':
        setSessionStatus('completed');
        break;

      case 'error':
        setError(event.data?.message || 'Unknown error');
        break;

      case 'test_run_start':
        // Show "running" badge immediately when test starts
        setTestRunActivity(prev => {
          const updated = prev.filter(a => a.testCaseId !== event.data?.testCaseId);
          const newEntry: TestRunActivity = {
            testCaseId: event.data?.testCaseId,
            testCaseName: event.data?.testCaseName || 'Test',
            status: 'running',
            timestamp: event.timestamp
          };
          return [...updated, newEntry].slice(-20); // keep last 20
        });
        break;

      case 'test_run_result':
        // Update the entry from 'running' → actual result (with mismatch info)
        setTestRunActivity(prev => prev.map(a =>
          a.testCaseId === event.data?.testCaseId
            ? {
                ...a,
                status: event.data.status,
                durationMs: event.data.durationMs,
                failureReason: event.data.failureReason,
                isMismatch: event.data.isMismatch || false,
                observedResult: event.data.observedResult
              }
            : a
        ));
        break;

      case 'progress':
        if (event.data?.phase === 'cost_update') {
          setCostInfo(prev => ({
            totalCostCents: prev.totalCostCents + (event.data.costCents || 0),
            inputTokens: prev.inputTokens + (event.data.inputTokens || 0),
            outputTokens: prev.outputTokens + (event.data.outputTokens || 0),
            modelName: event.data.modelName || prev.modelName
          }));
        }
        if (event.data?.phase) setCurrentPhase(event.data.phase);
        if (event.data?.message) setCurrentMessage(event.data.message);
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrlWithSession = `${baseWsUrl}/ws/qa-loop?sessionId=${sessionId}${wsToken ? `&token=${wsToken}` : ''}`;

    try {
      const ws = new WebSocket(wsUrlWithSession);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as QALoopEvent;
          processEvent(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnection
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch {
      setError('Failed to connect to WebSocket');
    }
  }, [sessionId, enabled, baseWsUrl, wsToken, processEvent]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    reconnectAttempts.current = maxReconnectAttempts; // Prevent auto-reconnect
    // Clear accumulated state to free memory
    setToolCalls([]);
    setCurrentScreenshot(null);
  }, []);

  // Connect when enabled and sessionId changes
  useEffect(() => {
    if (enabled && sessionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, sessionId, connect, disconnect]);

  return {
    isConnected,
    currentScreenshot,
    currentUrl,
    thinkingText,
    toolCalls,
    testRunActivity,
    iteration,
    pagesDiscovered,
    pagesExplored,
    testsGenerated,
    bugsFound,
    sessionStatus,
    currentPhase,
    currentMessage,
    costInfo,
    sessionStartTime,
    error,
    connect,
    disconnect,
    clearEvents
  };
}
