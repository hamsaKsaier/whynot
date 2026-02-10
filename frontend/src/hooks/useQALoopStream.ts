import { useState, useEffect, useCallback, useRef } from 'react';

export interface QALoopEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'progress' | 'error' |
  'iteration_start' | 'iteration_end' | 'page_discovered' | 'page_explored' |
  'test_generated' | 'bug_found' | 'session_complete' | 'connected' |
  'screenshot' | 'status_update';
  data: any;
  timestamp: string;
}

interface UseQALoopStreamOptions {
  sessionId?: string;
  enabled?: boolean;
  wsUrl?: string;
}

interface UseQALoopStreamReturn {
  isConnected: boolean;
  events: QALoopEvent[];
  currentScreenshot: string | null;
  currentUrl: string | null;
  thinkingText: string;
  toolCalls: Array<{ tool: string; input: any; result?: any; timestamp: string }>;
  iteration: number;
  pagesDiscovered: string[];
  pagesExplored: string[];
  testsGenerated: string[];
  bugsFound: Array<{ title: string; severity: string }>;
  sessionStatus: string | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  clearEvents: () => void;
}

export function useQALoopStream({
  sessionId,
  enabled = true,
  wsUrl
}: UseQALoopStreamOptions): UseQALoopStreamReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<QALoopEvent[]>([]);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [thinkingText, setThinkingText] = useState('');
  const [toolCalls, setToolCalls] = useState<Array<{ tool: string; input: any; result?: any; timestamp: string }>>([]);
  const [iteration, setIteration] = useState(0);
  const [pagesDiscovered, setPagesDiscovered] = useState<string[]>([]);
  const [pagesExplored, setPagesExplored] = useState<string[]>([]);
  const [testsGenerated, setTestsGenerated] = useState<string[]>([]);
  const [bugsFound, setBugsFound] = useState<Array<{ title: string; severity: string }>>([]);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const baseWsUrl = wsUrl || import.meta.env.VITE_QA_LOOP_WS_URL || 'ws://localhost:3012';

  const clearEvents = useCallback(() => {
    setEvents([]);
    setThinkingText('');
    setToolCalls([]);
    setCurrentScreenshot(null);
    setCurrentUrl(null);
    setPagesDiscovered([]);
    setPagesExplored([]);
    setTestsGenerated([]);
    setBugsFound([]);
    setIteration(0);
    setSessionStatus(null);
    setError(null);
  }, []);

  const processEvent = useCallback((event: QALoopEvent) => {
    setEvents(prev => [...prev.slice(-100), event]); // Keep last 100 events

    switch (event.type) {
      case 'connected':
        setIsConnected(true);
        setError(null);
        break;

      case 'thinking':
        setThinkingText(prev => prev + (event.data?.text || ''));
        break;

      case 'tool_call':
        setToolCalls(prev => [...prev, {
          tool: event.data?.tool,
          input: event.data?.input,
          timestamp: event.timestamp
        }]);
        // Clear thinking text when tool is called
        setThinkingText('');
        break;

      case 'tool_result':
        setToolCalls(prev => {
          const updated = [...prev];
          const lastCall = updated[updated.length - 1];
          if (lastCall && lastCall.tool === event.data?.tool) {
            lastCall.result = event.data?.result || event.data?.error;
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
          setPagesDiscovered(prev =>
            prev.includes(event.data.url) ? prev : [...prev, event.data.url]
          );
        }
        break;

      case 'page_explored':
        if (event.data?.url) {
          setPagesExplored(prev =>
            prev.includes(event.data.url) ? prev : [...prev, event.data.url]
          );
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
        setSessionStatus(event.data?.status || null);
        break;

      case 'session_complete':
        setSessionStatus('completed');
        break;

      case 'error':
        setError(event.data?.message || 'Unknown error');
        break;

      case 'progress':
        // Handle progress updates
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrlWithSession = `${baseWsUrl}/ws/qa-loop?sessionId=${sessionId}`;
    console.log('Connecting to QA Loop WebSocket:', wsUrlWithSession);

    try {
      const ws = new WebSocket(wsUrlWithSession);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('QA Loop WebSocket connected');
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

      ws.onerror = (error) => {
        console.error('QA Loop WebSocket error:', error);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('QA Loop WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnection
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setError('Failed to connect to WebSocket');
    }
  }, [sessionId, enabled, baseWsUrl, processEvent]);

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
    events,
    currentScreenshot,
    currentUrl,
    thinkingText,
    toolCalls,
    iteration,
    pagesDiscovered,
    pagesExplored,
    testsGenerated,
    bugsFound,
    sessionStatus,
    error,
    connect,
    disconnect,
    clearEvents
  };
}
