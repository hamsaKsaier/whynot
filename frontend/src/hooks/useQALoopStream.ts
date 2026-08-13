import { useState, useEffect, useCallback, useRef } from 'react';
import { config } from '@/config';

export interface QALoopEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'progress' | 'error' |
  'iteration_start' | 'iteration_end' | 'page_discovered' | 'page_explored' |
  'test_generated' | 'bug_found' | 'session_complete' | 'connected' |
  'screenshot' | 'status_update' | 'test_run_start' | 'test_run_result' |
  // v4 Phase 3: backend QALeadWatcher emits these when it reassigns,
  // pauses, resumes, or escalates. Command Center subscribes via the
  // per-agent `pulse` field + a dedicated leadDispatches log.
  'lead_dispatch' | 'cost_cap_reached';
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

/**
 * v4 Phase 3: per-agent stream slice. The CommandCenter component
 * reads these to populate the 4-quadrant live view. Legacy
 * whole-session fields above stay in place so LiveMonitor keeps
 * working unchanged when the Command Center is toggled off.
 */
/**
 * One finding as it streams in. title/severity are always present; agent
 * (who found it), category, and `at` (arrival clock) are enriched from the
 * bug_found event so the Findings panel can credit and order them.
 */
export interface Finding {
  title: string;
  severity: string;
  agent?: string;
  category?: string;
  at?: number;
}

export interface AgentStreamSlice {
  thinkingText: string;
  toolCalls: Array<{ tool: string; input: any; result?: any; timestamp: string }>;
  bugsFound: Array<{ title: string; severity: string }>;
  testsGenerated: string[];
  lastActivityTs: number | null;
  /** Set when a lead.* event arrives targeting this agent — UI highlights briefly. */
  pulse?: 'reassign' | 'pause' | 'resume' | 'escalate' | null;
  /** Clock when the agent first appeared — Gantt bar left edge. */
  firstSeenTs: number | null;
  /** Clock of last activity — Gantt bar right edge. */
  lastSeenTs: number | null;
}

export interface LeadDispatch {
  id: string;
  kind: 'reassign' | 'pause' | 'resume' | 'escalate' | 'terminate';
  target?: string;
  message: string;
  at: string;
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
  bugsFound: Finding[];
  sessionStatus: string | null;
  currentPhase: string | null;
  currentMessage: string | null;
  costInfo: CostInfo;
  sessionStartTime: number | null;
  error: string | null;
  // v4 Phase 3: per-agent slices for the Command Center UI.
  agentStreams: Record<string, AgentStreamSlice>;
  leadDispatches: LeadDispatch[];
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
  const [bugsFound, setBugsFound] = useState<Finding[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [costInfo, setCostInfo] = useState<CostInfo>({ totalCostCents: 0, inputTokens: 0, outputTokens: 0, modelName: '' });
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // v4 Phase 3 per-agent slices + lead dispatch log.
  const [agentStreams, setAgentStreams] = useState<Record<string, AgentStreamSlice>>({});
  const [leadDispatches, setLeadDispatches] = useState<LeadDispatch[]>([]);

  /**
   * Merge a partial update into a specific agent's stream slice. Creates
   * the slice on first touch. Normalizes `firstSeenTs` on first write
   * and bumps `lastSeenTs` / `lastActivityTs` on every call.
   */
  const mergeAgentSlice = useCallback((
    agent: string,
    patch: Partial<AgentStreamSlice>,
  ) => {
    setAgentStreams(prev => {
      const now = Date.now();
      const existing = prev[agent] ?? {
        thinkingText: '',
        toolCalls: [],
        bugsFound: [],
        testsGenerated: [],
        lastActivityTs: now,
        pulse: null,
        firstSeenTs: now,
        lastSeenTs: now,
      };
      return {
        ...prev,
        [agent]: {
          ...existing,
          ...patch,
          firstSeenTs: existing.firstSeenTs ?? now,
          lastSeenTs: now,
          lastActivityTs: now,
        },
      };
    });
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  // O(1) dedup sets that shadow the pagesDiscovered/pagesExplored arrays (4.4)
  const pagesDiscoveredSet = useRef<Set<string>>(new Set());
  const pagesExploredSet = useRef<Set<string>>(new Set());

  const baseWsUrl = wsUrl || config.qaLoopWsUrl;

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
    // v4 Phase 3: reset per-agent slices + lead dispatch log.
    setAgentStreams({});
    setLeadDispatches([]);
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

      case 'thinking': {
        const incoming = event.data?.text || '';
        setThinkingText(prev => prev + incoming);
        const agent = event.data?.agent;
        if (agent && incoming) {
          // Cap per-agent thinking at 4 KB so the Command Center panel
          // never renders more than a screenful — older tail drops.
          setAgentStreams(prev => {
            const slot = prev[agent] ?? {
              thinkingText: '', toolCalls: [], bugsFound: [], testsGenerated: [],
              lastActivityTs: Date.now(), pulse: null,
              firstSeenTs: Date.now(), lastSeenTs: Date.now(),
            };
            const merged = (slot.thinkingText + incoming).slice(-4000);
            return {
              ...prev,
              [agent]: { ...slot, thinkingText: merged,
                firstSeenTs: slot.firstSeenTs ?? Date.now(),
                lastSeenTs: Date.now(), lastActivityTs: Date.now() },
            };
          });
        }
        break;
      }

      case 'tool_call': {
        // Cap toolCalls at 50 to prevent unbounded memory growth
        setToolCalls(prev => [...prev.slice(-49), {
          tool: event.data?.tool,
          input: event.data?.input,
          timestamp: event.timestamp
        }]);
        // Add a separator between thinking blocks so they remain readable
        setThinkingText(prev => prev ? prev + '\n\n---\n\n' : '');
        const agent = event.data?.agent;
        if (agent) {
          setAgentStreams(prev => {
            const slot = prev[agent] ?? {
              thinkingText: '', toolCalls: [], bugsFound: [], testsGenerated: [],
              lastActivityTs: Date.now(), pulse: null,
              firstSeenTs: Date.now(), lastSeenTs: Date.now(),
            };
            return {
              ...prev,
              [agent]: {
                ...slot,
                toolCalls: [...slot.toolCalls.slice(-19), {
                  tool: event.data?.tool,
                  input: event.data?.input,
                  timestamp: event.timestamp,
                }],
                firstSeenTs: slot.firstSeenTs ?? Date.now(),
                lastSeenTs: Date.now(), lastActivityTs: Date.now(),
              },
            };
          });
        }
        break;
      }

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

      case 'screenshot': {
        // The backend sends { type: 'screenshot', data: { screenshot: '<base64>', url: '...' } }
        // Ensure we handle both nested and flat data structures
        const screenshotData = event.data?.screenshot || event.data?.data?.screenshot;
        const screenshotUrl = event.data?.url || event.data?.data?.url;
        if (screenshotData && typeof screenshotData === 'string' && screenshotData.length > 100) {
          // Avoid double-prefixing if the data already has a data URI prefix
          const dataUri = screenshotData.startsWith('data:')
            ? screenshotData
            : `data:image/png;base64,${screenshotData}`;
          setCurrentScreenshot(dataUri);
        }
        if (screenshotUrl) {
          setCurrentUrl(screenshotUrl);
        }
        break;
      }

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
          const agent = event.data?.agent;
          if (agent) {
            mergeAgentSlice(agent, {
              testsGenerated: [...(agentStreams[agent]?.testsGenerated || []), event.data.name],
            });
          }
        }
        break;

      case 'bug_found':
        if (event.data?.title) {
          setBugsFound(prev => {
            // Dedupe: the same bug_found can arrive more than once — the WS
            // replays buffered events on reconnect during a long scan — and a
            // findings list that shows the same bug four times reads as broken
            // (and inflates every bug count downstream). Key on title + agent.
            const key = `${event.data.title}::${event.data.agent || ''}`;
            if (prev.some(b => `${b.title}::${b.agent || ''}` === key)) return prev;
            return [...prev, {
              title: event.data.title,
              severity: event.data.severity || 'medium',
              agent: event.data.agent,
              category: event.data.category,
              at: Date.now(),
            }];
          });
          const agent = event.data?.agent;
          if (agent) {
            setAgentStreams(prev => {
              const slot = prev[agent] ?? {
                thinkingText: '', toolCalls: [], bugsFound: [], testsGenerated: [],
                lastActivityTs: Date.now(), pulse: null,
                firstSeenTs: Date.now(), lastSeenTs: Date.now(),
              };
              // Same dedupe as the top-level list — a replayed bug_found must
              // not double-count on the agent's card.
              const already = slot.bugsFound.some(b => b.title === event.data.title);
              return {
                ...prev,
                [agent]: {
                  ...slot,
                  bugsFound: already
                    ? slot.bugsFound
                    : [...slot.bugsFound, {
                        title: event.data.title,
                        severity: event.data.severity || 'medium',
                      }],
                  firstSeenTs: slot.firstSeenTs ?? Date.now(),
                  lastSeenTs: Date.now(), lastActivityTs: Date.now(),
                },
              };
            });
          }
        }
        break;

      // v4 Phase 3: lead dispatch broadcasts. Carried as
      // { agent: 'qa_lead', message: '...' } from the backend
      // QALeadWatcher.emitUiStatus(). We infer the dispatch kind from
      // the message prefix — keeps the backend → frontend contract
      // simple (no extra kind field required on QALoopEvent).
      case 'lead_dispatch': {
        const message: string = event.data?.message || '';
        const lower = message.toLowerCase();
        const kind: LeadDispatch['kind'] =
          lower.startsWith('lead reassigned') ? 'reassign' :
          lower.startsWith('lead paused')     ? 'pause'    :
          lower.startsWith('lead resumed')    ? 'resume'   :
          lower.startsWith('lead escalated')  ? 'escalate' :
          'terminate';
        // Parse target agent from the message prefix: "Lead reassigned security: ..."
        const colonAt = message.indexOf(':');
        const targetFragment = colonAt > 0 ? message.slice(0, colonAt) : message;
        const target = targetFragment.split(/\s+/).pop();
        setLeadDispatches(prev => [
          ...prev.slice(-49),
          {
            id: `${event.timestamp}-${target ?? 'na'}`,
            kind,
            target,
            message,
            at: event.timestamp,
          },
        ]);
        // Briefly flag the target agent's slice so the UI can animate.
        if (target) {
          setAgentStreams(prev => {
            const slot = prev[target] ?? {
              thinkingText: '', toolCalls: [], bugsFound: [], testsGenerated: [],
              lastActivityTs: Date.now(), pulse: null,
              firstSeenTs: Date.now(), lastSeenTs: Date.now(),
            };
            return {
              ...prev,
              [target]: {
                ...slot,
                pulse: kind === 'terminate' ? null : kind,
                firstSeenTs: slot.firstSeenTs ?? Date.now(),
                lastSeenTs: Date.now(),
              },
            };
          });
        }
        break;
      }

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
    // v4 Phase 3: per-agent derived state for the Command Center.
    agentStreams,
    leadDispatches,
    connect,
    disconnect,
    clearEvents
  };
}
