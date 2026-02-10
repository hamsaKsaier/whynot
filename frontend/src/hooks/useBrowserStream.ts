import { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentMessage } from '../components/TestRunner/AgentActivityPanel';

// Remove logger reference that doesn't exist
const logger = {
  error: (...args: any[]) => console.error(...args),
  debug: (...args: any[]) => console.debug(...args),
};

interface BrowserFrame {
  imageUrl: string;
  timestamp: number;
  url?: string;
  stepIndex?: number;
  format?: 'png' | 'jpeg';
}

interface SelectorAttempt {
  selector: any;
  attemptNumber: number;
  totalAttempts: number;
  status: 'trying' | 'failed' | 'succeeded';
  timestamp: number;
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
  selectorAttempts?: SelectorAttempt[];
  recoveryStart?: {
    reason: string;
    attemptedSelectors: any[];
    timestamp: number;
  };
  recoverySuccess?: {
    successfulSelector: any;
    strategyUsed: string;
    timestamp: number;
  };
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
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);

  // Frame history for time-travel debugging
  const [frameHistory, setFrameHistory] = useState<Map<number, BrowserFrame[]>>(new Map());
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);

  // Frame caching for performance
  const frameCache = useRef<Map<string, BrowserFrame>>(new Map());
  const maxCacheSize = 50;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:52', message: 'connect() called', data: { executionId, enabled, wsUrl }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A,B,C,D,E' }) }).catch(() => { });
    // #endregion
    if (!executionId || !enabled) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:55', message: 'Connection skipped', data: { executionId, enabled }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
      // #endregion
      console.log('WebSocket connection skipped', { executionId, enabled });
      return;
    }

    // Get WebSocket URL - use ws:// for localhost, wss:// for production
    // Port 3011 is the exposed port for test-executor service
    const wsBaseUrl = wsUrl || (window.location.protocol === 'https:'
      ? `wss://${window.location.hostname}:3011`
      : `ws://${window.location.hostname}:3011`);
    const wsUrlFull = `${wsBaseUrl}/ws/browser-stream/${executionId}`;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:63', message: 'WebSocket URL constructed', data: { wsUrlFull, wsBaseUrl, hostname: window.location.hostname, protocol: window.location.protocol, executionId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A,D' }) }).catch(() => { });
    // #endregion
    console.log('Attempting WebSocket connection', { wsUrlFull, executionId });

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrlFull);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:69', message: 'WebSocket object created', data: { wsUrlFull, readyState: ws.readyState }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A,D' }) }).catch(() => { });
      // #endregion
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:72', message: 'WebSocket creation failed', data: { error: err?.message, errorType: err?.constructor?.name, wsUrlFull }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
      // #endregion
      console.error('Failed to create WebSocket', err);
      setError(`Failed to create WebSocket connection: ${err.message}`);
      return;
    }

    ws.onopen = () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:79', message: 'WebSocket opened successfully', data: { executionId, wsUrlFull }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A,D' }) }).catch(() => { });
      // #endregion
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
          const frame: BrowserFrame = {
            imageUrl: `data:image/${data.format || 'png'};base64,${data.frame}`,
            timestamp: data.timestamp || Date.now(),
            url: data.url,
            stepIndex: data.stepIndex,
            format: data.format || 'png',
          };

          // Add to frame history if step index is available
          if (frame.stepIndex !== undefined) {
            setFrameHistory((prev) => {
              const newHistory = new Map(prev);
              if (!newHistory.has(frame.stepIndex!)) {
                newHistory.set(frame.stepIndex!, []);
              }
              const stepFrames = newHistory.get(frame.stepIndex!)!;
              stepFrames.push(frame);

              // Limit frames per step (keep last 10 frames per step)
              if (stepFrames.length > 10) {
                stepFrames.shift();
              }

              return newHistory;
            });

            // Update current step index
            if (currentStepIndex !== frame.stepIndex) {
              setCurrentStepIndex(frame.stepIndex);
              setCurrentFrameIndex(0);
            }
          }

          // Update current frame
          setCurrentFrame(frame);

          // Cache frame for performance
          const cacheKey = `${frame.stepIndex ?? 'none'}-${frame.timestamp}`;
          if (frameCache.current.size >= maxCacheSize) {
            // Remove oldest entry
            const firstKey = frameCache.current.keys().next().value as string | undefined;
            if (firstKey !== undefined) frameCache.current.delete(firstKey);
          }
          frameCache.current.set(cacheKey, frame);
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
          setCurrentStepIndex(data.stepIndex);
          setCurrentFrameIndex(0);

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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:197', message: 'Received connected message', data: { executionId: data.executionId, message: data.message, wsReadyState: ws.readyState }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D,E' }) }).catch(() => { });
          // #endregion
          console.log('WebSocket connection confirmed by backend', { executionId: data.executionId, message: data.message });
          setIsConnected(true);
          setError(null);
        } else if (data.type === 'selector_attempt') {
          // Selector attempt event
          const attempt: SelectorAttempt = {
            selector: data.selector,
            attemptNumber: data.attemptNumber,
            totalAttempts: data.totalAttempts,
            status: data.status,
            timestamp: data.timestamp || Date.now()
          };
          setStepUpdates((prev: Map<number, StepUpdate>) => {
            const newMap = new Map(prev);
            const existing: StepUpdate = newMap.get(data.stepIndex) ?? {
              stepIndex: data.stepIndex,
              status: 'running',
              timestamp: Date.now()
            };
            const selectorAttempts = existing.selectorAttempts ?? [];
            const attemptIndex = selectorAttempts.findIndex(
              (a: SelectorAttempt) => a.attemptNumber === attempt.attemptNumber && a.selector?.type === attempt.selector?.type && a.selector?.value === attempt.selector?.value
            );
            if (attemptIndex >= 0) {
              selectorAttempts[attemptIndex] = attempt;
            } else {
              selectorAttempts.push(attempt);
            }
            newMap.set(data.stepIndex, { ...existing, selectorAttempts });
            return newMap;
          });
        } else if (data.type === 'selector_recovery_start') {
          // Recovery started
          setStepUpdates((prev: Map<number, StepUpdate>) => {
            const newMap = new Map(prev);
            const existing: StepUpdate = newMap.get(data.stepIndex) ?? {
              stepIndex: data.stepIndex,
              status: 'running',
              timestamp: Date.now()
            };
            existing.recoveryStart = {
              reason: data.reason,
              attemptedSelectors: data.attemptedSelectors || [],
              timestamp: data.timestamp || Date.now()
            };
            newMap.set(data.stepIndex, existing);
            return newMap;
          });
        } else if (data.type === 'selector_recovery_success') {
          // Recovery succeeded
          setStepUpdates((prev: Map<number, StepUpdate>) => {
            const newMap = new Map(prev);
            const existing: StepUpdate = newMap.get(data.stepIndex) ?? {
              stepIndex: data.stepIndex,
              status: 'running',
              timestamp: Date.now()
            };
            existing.recoverySuccess = {
              successfulSelector: data.successfulSelector,
              strategyUsed: data.strategyUsed,
              timestamp: data.timestamp || Date.now()
            };
            newMap.set(data.stepIndex, existing);
            return newMap;
          });
        } else if (data.type === 'agent_message') {
          // Agent activity message
          const agentMessage: AgentMessage = {
            stepIndex: data.stepIndex,
            type: data.agentType,
            message: data.message,
            data: data.data,
            timestamp: data.timestamp || Date.now()
          };
          setAgentMessages((prev) => [...prev, agentMessage]);
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:202', message: 'Unknown message type', data: { type: data.type, executionId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(() => { });
          // #endregion
          console.log('Unknown WebSocket message type', data.type);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (err) => {
      // #region agent log
      const errorDetails = {
        error: err?.type || 'unknown',
        target: err?.target ? {
          url: (err.target as WebSocket)?.url,
          readyState: (err.target as WebSocket)?.readyState,
          protocol: (err.target as WebSocket)?.protocol
        } : null,
        timeStamp: err?.timeStamp,
        event: err?.constructor?.name
      };
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:194', message: 'WebSocket error event', data: { executionId, wsUrlFull, errorDetails }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A,B,D,E' }) }).catch(() => { });
      // #endregion
      console.error('WebSocket error:', err);
      const errorMsg = `Failed to connect to WebSocket server at ${wsUrlFull}. The test may have completed or the server is not available.`;
      setError(errorMsg);
      logger.error('WebSocket connection error', { executionId, wsUrlFull });
    };

    ws.onclose = (event) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:200', message: 'WebSocket closed', data: { executionId, code: event.code, reason: event.reason, wasClean: event.wasClean, reconnectAttempts: reconnectAttempts.current, wsUrlFull }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A,B,D,E' }) }).catch(() => { });
      // #endregion
      setIsConnected(false);
      console.log('WebSocket closed', { executionId, code: event.code, reason: event.reason });

      // Don't reconnect if closed normally or if test completed
      if (event.code === 1000 || event.code === 1001) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:206', message: 'WebSocket closed normally', data: { code: event.code }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => { });
        // #endregion
        console.log('WebSocket closed normally, not reconnecting');
        return;
      }

      // Attempt to reconnect
      if (reconnectAttempts.current < maxReconnectAttempts && enabled) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:213', message: 'Scheduling reconnect', data: { attempt: reconnectAttempts.current, delay, executionId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => { });
        // #endregion

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Reconnecting... Attempt ${reconnectAttempts.current}`, { executionId });
          connect();
        }, delay);
      } else if (reconnectAttempts.current >= maxReconnectAttempts) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:220', message: 'Max reconnect attempts reached', data: { executionId, attempts: reconnectAttempts.current, wsUrlFull }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A,B,D,E' }) }).catch(() => { });
        // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:290', message: 'useEffect triggered', data: { enabled, executionId, hasWs: !!wsRef.current, wsReadyState: wsRef.current?.readyState }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
    // #endregion
    if (enabled && executionId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'useBrowserStream.ts:299', message: 'useEffect cleanup', data: { executionId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
      // #endregion
      disconnect();
    };
  }, [enabled, executionId, connect, disconnect]);

  // Navigation functions for time-travel debugging
  const goToStep = useCallback((stepIndex: number) => {
    const stepFrames = frameHistory.get(stepIndex);
    if (stepFrames && stepFrames.length > 0) {
      setCurrentStepIndex(stepIndex);
      setCurrentFrameIndex(stepFrames.length - 1); // Go to last frame of step
      setCurrentFrame(stepFrames[stepFrames.length - 1]);
    }
  }, [frameHistory]);

  const goToNextFrame = useCallback(() => {
    if (currentStepIndex === null) return;
    const stepFrames = frameHistory.get(currentStepIndex);
    if (stepFrames && currentFrameIndex < stepFrames.length - 1) {
      const nextIndex = currentFrameIndex + 1;
      setCurrentFrameIndex(nextIndex);
      setCurrentFrame(stepFrames[nextIndex]);
    } else {
      // Try next step
      const nextStepIndex = currentStepIndex + 1;
      const nextStepFrames = frameHistory.get(nextStepIndex);
      if (nextStepFrames && nextStepFrames.length > 0) {
        setCurrentStepIndex(nextStepIndex);
        setCurrentFrameIndex(0);
        setCurrentFrame(nextStepFrames[0]);
      }
    }
  }, [currentStepIndex, currentFrameIndex, frameHistory]);

  const goToPrevFrame = useCallback(() => {
    if (currentStepIndex === null) return;
    const stepFrames = frameHistory.get(currentStepIndex);
    if (stepFrames && currentFrameIndex > 0) {
      const prevIndex = currentFrameIndex - 1;
      setCurrentFrameIndex(prevIndex);
      setCurrentFrame(stepFrames[prevIndex]);
    } else {
      // Try previous step
      const prevStepIndex = currentStepIndex - 1;
      if (prevStepIndex >= 0) {
        const prevStepFrames = frameHistory.get(prevStepIndex);
        if (prevStepFrames && prevStepFrames.length > 0) {
          setCurrentStepIndex(prevStepIndex);
          setCurrentFrameIndex(prevStepFrames.length - 1);
          setCurrentFrame(prevStepFrames[prevStepFrames.length - 1]);
        }
      }
    }
  }, [currentStepIndex, currentFrameIndex, frameHistory]);

  const goToFirstFrame = useCallback(() => {
    const sortedSteps = Array.from(frameHistory.keys()).sort((a, b) => a - b);
    if (sortedSteps.length > 0) {
      const firstStep = sortedSteps[0];
      const firstFrames = frameHistory.get(firstStep);
      if (firstFrames && firstFrames.length > 0) {
        setCurrentStepIndex(firstStep);
        setCurrentFrameIndex(0);
        setCurrentFrame(firstFrames[0]);
      }
    }
  }, [frameHistory]);

  const goToLastFrame = useCallback(() => {
    const sortedSteps = Array.from(frameHistory.keys()).sort((a, b) => b - a);
    if (sortedSteps.length > 0) {
      const lastStep = sortedSteps[0];
      const lastFrames = frameHistory.get(lastStep);
      if (lastFrames && lastFrames.length > 0) {
        setCurrentStepIndex(lastStep);
        setCurrentFrameIndex(lastFrames.length - 1);
        setCurrentFrame(lastFrames[lastFrames.length - 1]);
      }
    }
  }, [frameHistory]);

  const getTotalFrames = useCallback(() => {
    let total = 0;
    frameHistory.forEach((frames) => {
      total += frames.length;
    });
    return total;
  }, [frameHistory]);

  const getCurrentFramePosition = useCallback(() => {
    if (currentStepIndex === null) return { step: 0, frame: 0, total: 0 };
    let frameCount = 0;
    const sortedSteps = Array.from(frameHistory.keys()).sort((a, b) => a - b);
    for (const stepIdx of sortedSteps) {
      const stepFrames = frameHistory.get(stepIdx)!;
      if (stepIdx === currentStepIndex) {
        return {
          step: sortedSteps.indexOf(stepIdx) + 1,
          frame: currentFrameIndex + 1,
          total: getTotalFrames(),
          stepIndex: stepIdx,
        };
      }
      frameCount += stepFrames.length;
    }
    return { step: 0, frame: 0, total: getTotalFrames() };
  }, [currentStepIndex, currentFrameIndex, frameHistory, getTotalFrames]);

  return {
    currentFrame,
    isConnected,
    error,
    finalResult, // Final execution result received via WebSocket
    stepUpdates, // Real-time step progress updates
    agentMessages, // Agent activity messages
    // Frame history and navigation
    frameHistory,
    currentStepIndex,
    currentFrameIndex,
    goToStep,
    goToNextFrame,
    goToPrevFrame,
    goToFirstFrame,
    goToLastFrame,
    getTotalFrames,
    getCurrentFramePosition,
    connect,
    disconnect,
  };
};

