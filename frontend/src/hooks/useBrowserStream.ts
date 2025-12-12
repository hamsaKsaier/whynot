import { useState, useEffect, useRef, useCallback } from 'react';

// Remove logger reference that doesn't exist
const logger = {
  error: (...args: any[]) => console.error(...args),
  debug: (...args: any[]) => console.debug(...args),
};

interface BrowserFrame {
  imageUrl: string;
  timestamp: number;
  url?: string;
}

interface StepUpdate {
  stepIndex: number;
  step?: {
    id: string;
    action: string;
    description: string;
  };
  stepResult?: {
    step_id: string;
    success: boolean;
    error?: string;
    execution_time_ms: number;
    element_found?: boolean;
    selector_used?: any;
  };
  status: 'pending' | 'running' | 'completed';
  timestamp: number;
}

interface UseBrowserStreamOptions {
  executionId?: string;
  enabled?: boolean;
  wsUrl?: string;
}

export const useBrowserStream = (options: UseBrowserStreamOptions = {}) => {
  const { executionId, enabled = true, wsUrl } = options;
  const [currentFrame, setCurrentFrame] = useState<BrowserFrame | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [stepUpdates, setStepUpdates] = useState<Map<number, StepUpdate>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!executionId || !enabled) {
      console.log('WebSocket connection skipped', { executionId, enabled });
      return;
    }

    // Get WebSocket URL - use ws:// for localhost, wss:// for production
    const wsBaseUrl = wsUrl || (window.location.protocol === 'https:'
      ? `wss://${window.location.hostname}:3001`
      : `ws://${window.location.hostname}:3001`);
    const wsUrlFull = `${wsBaseUrl}/ws/browser-stream/${executionId}`;
    console.log('Attempting WebSocket connection', { wsUrlFull, executionId });

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrlFull);
    } catch (err: any) {
      console.error('Failed to create WebSocket', err);
      setError(`Failed to create WebSocket connection: ${err.message}`);
      return;
    }

    ws.onopen = () => {
      console.log('WebSocket opened for browser streaming', { executionId, wsUrlFull });
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'frame') {
          // Frame received - update UI silently without console spam
          setCurrentFrame({
            imageUrl: `data:image/png;base64,${data.frame}`,
            timestamp: data.timestamp || Date.now(),
            url: data.url,
          });
        } else if (data.type === 'url') {
          // URL update - update UI silently
          setCurrentFrame((prev) => ({
            ...prev!,
            url: data.url,
          }));
        } else if (data.type === 'log') {
          // Log message from backend - display in browser console
          const { level, message, data: logData } = data;
          switch (level) {
            case 'error':
              console.error(message, logData || '');
              break;
            case 'warn':
              console.warn(message, logData || '');
              break;
            case 'debug':
              console.debug(message, logData || '');
              break;
            case 'info':
            default:
              console.log(message, logData || '');
              break;
          }
        } else if (data.type === 'error') {
          console.error('Browser streaming error', data.message);
          setError(data.message || 'Browser streaming error');
        } else if (data.type === 'execution_complete') {
          // Final execution result received via WebSocket
          console.log('Execution completed via WebSocket', data.result);

          // Log success or failure message based on status
          if (data.result.status === 'completed') {
            console.log('✅ Agents runned successfully!', {
              executionId: data.result.execution_id,
              testCaseId: data.result.test_case_id,
              totalSteps: data.result.steps?.length || 0,
              passedSteps: data.result.steps?.filter((s: any) => s.success).length || 0,
              duration: `${data.result.total_duration_ms}ms`
            });
          } else if (data.result.status === 'failed') {
            console.error('❌ Agents execution failed', {
              executionId: data.result.execution_id,
              testCaseId: data.result.test_case_id,
              error: data.result.error,
              failedSteps: data.result.steps?.filter((s: any) => !s.success).length || 0,
              totalSteps: data.result.steps?.length || 0
            });
          }

          setFinalResult(data.result);
        } else if (data.type === 'step_start') {
          // Step execution started
          const stepUpdate: StepUpdate = {
            stepIndex: data.stepIndex,
            step: data.step,
            status: 'running',
            timestamp: data.timestamp || Date.now()
          };
          setStepUpdates((prev: Map<number, StepUpdate>) => {
            const newMap = new Map(prev);
            newMap.set(data.stepIndex, stepUpdate);
            return newMap;
          });
        } else if (data.type === 'step_complete') {
          // Step execution completed
          const stepUpdate: StepUpdate = {
            stepIndex: data.stepIndex,
            stepResult: data.stepResult,
            status: 'completed',
            timestamp: data.timestamp || Date.now()
          };
          setStepUpdates((prev: Map<number, StepUpdate>) => {
            const newMap = new Map(prev);
            const existing = newMap.get(data.stepIndex);
            if (existing) {
              newMap.set(data.stepIndex, {
                ...existing,
                ...stepUpdate
              });
            } else {
              newMap.set(data.stepIndex, stepUpdate);
            }
            return newMap;
          });
        } else if (data.type === 'connected') {
          console.log('WebSocket connection confirmed by backend', { executionId: data.executionId });
          setIsConnected(true);
          setError(null);
        } else {
          console.log('Unknown WebSocket message type', data.type);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      const errorMsg = `Failed to connect to WebSocket server at ${wsUrlFull}. The test may have completed or the server is not available.`;
      setError(errorMsg);
      logger.error('WebSocket connection error', { executionId, wsUrlFull });
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      console.log('WebSocket closed', { executionId, code: event.code, reason: event.reason });

      // Don't reconnect if closed normally or if test completed
      if (event.code === 1000 || event.code === 1001) {
        console.log('WebSocket closed normally, not reconnecting');
        return;
      }

      // Attempt to reconnect
      if (reconnectAttempts.current < maxReconnectAttempts && enabled) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Reconnecting... Attempt ${reconnectAttempts.current}`, { executionId });
          connect();
        }, delay);
      } else if (reconnectAttempts.current >= maxReconnectAttempts) {
        const errorMsg = `Failed to connect after ${maxReconnectAttempts} attempts. The test may have completed or the WebSocket server is not available.`;
        setError(errorMsg);
        console.error('WebSocket connection failed after max attempts', { executionId, wsUrlFull });
      }
    };

    wsRef.current = ws;
  }, [executionId, enabled, wsUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    reconnectAttempts.current = 0;
  }, []);

  useEffect(() => {
    if (enabled && executionId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, executionId, connect, disconnect]);

  return {
    currentFrame,
    isConnected,
    error,
    finalResult, // Final execution result received via WebSocket
    stepUpdates, // Real-time step progress updates
    connect,
    disconnect,
  };
};

