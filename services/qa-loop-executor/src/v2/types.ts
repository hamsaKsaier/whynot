/**
 * Shared types for the multi-agent v2 system.
 */

export type AgentType = 'qa_lead' | 'exploratory' | 'security' | 'api_tester' | 'auto_tester';

// 'killed_idle' = watchdog killed the agent for inactivity (see orchestrator.runAgent
// and the MAX_AGENT_IDLE_MIN env var). Distinct from 'error' because the agent
// didn't throw — it was externally aborted for exceeding the idle-timeout.
export type AgentStatus = 'idle' | 'working' | 'blocked' | 'done' | 'error' | 'killed_idle';

export type PlanStatus = 'active' | 'completed' | 'failed';

export interface AppAnalysis {
  app_type: string;
  critical_flows: string[];
  risk_areas: string[];
  total_pages_to_test: number;
  tech_hints?: string[];
}

export interface PlanObjective {
  id: number;
  agent: AgentType;
  objective: string;
  pages?: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  depends_on: number[];
}

export interface SessionPlan {
  id: string;
  session_id: string;
  created_by: string;
  app_analysis: AppAnalysis;
  objectives: PlanObjective[];
  status: PlanStatus;
  created_at: string;
}

export interface BoardDiscovery {
  type: 'form' | 'api_endpoint' | 'bug' | 'page' | 'blocked' | 'security_issue' | 'observation';
  [key: string]: any;
  at: string;
}

export interface BoardMessage {
  to: AgentType | 'all';
  msg: string;
  at: string;
}

export interface AgentBoardEntry {
  id: string;
  session_id: string;
  agent_type: AgentType;
  status: AgentStatus;
  current_task: string | null;
  progress_pct: number;
  discoveries: BoardDiscovery[];
  messages: BoardMessage[];
  pages_explored: number;
  tests_generated: number;
  bugs_found: number;
  api_endpoints_tested: number;
  updated_at: string;
  created_at: string;
}

export interface AgentConfig {
  sessionId: string;
  agentType: AgentType;
  targetUrl: string;
  plan: SessionPlan;
  projectContext?: any;
  loginCredentials?: {
    loginUrl?: string;
    emailSelector?: string;
    passwordSelector?: string;
    submitSelector?: string;
    email: string;
    password: string;
  };
}

export interface AgentResult {
  agentType: AgentType;
  // 'killed_idle' = watchdog aborted the agent for inactivity. Orchestrator
  // records the last known metrics from the agent, skips retry, moves on.
  status: 'done' | 'error' | 'killed_idle';
  pagesExplored: number;
  testsGenerated: number;
  bugsFound: number;
  apiEndpointsTested: number;
  error?: string;
  // Cost tracking (Fix D — persisted to qa_loop_iterations by orchestrator)
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  costCents?: number;
  costDollars?: number;
  modelUsed?: string;
  toolCallCount?: number;
  durationMs?: number;
  completionReason?: string;
  // Task 1–3 instrumentation (separates LLM calls from tool calls,
  // tracks worst-case single call, accumulates char-based composition
  // so the orchestrator can compute session-wide averages).
  llmCallCount?: number;
  maxSingleCallInputTokens?: number;
  sumSystemPromptChars?: number;
  sumHistoryChars?: number;
  sumProjectContextChars?: number;
  sumToolDefsChars?: number;
  // Priority 2 / Option C — residual between real usage.inputTokens and our
  // char-based estimates. Equals the tool-result accumulation that generateText
  // appends between steps (our char sums capture only the call-start state).
  // Summed across all LLM calls so orchestrator can compute a session average.
  sumToolResultsAccumulatedTokens?: number;
  // Week 2 CDP telemetry: which cdp_* tools this agent called, plus total
  // chars dropped by output truncation. Aggregated across all agents by
  // the orchestrator into the chromeDevtools block of "Scan cost breakdown".
  cdpCallCounts?: Record<string, number>;
  cdpCharsDropped?: number;
  // Task 6: tool-result truncation stats. Present whenever an agent ran
  // (regardless of feature flag state — `enabled=false` means no chars
  // were actually elided). Aggregated by orchestrator into the
  // `toolResultTruncation` block of "Scan cost breakdown".
  toolTruncation?: {
    enabled: boolean;
    totalToolCalls: number;
    toolsTruncatedCount: number;
    totalCharsBeforeTruncation: number;
    totalCharsAfterTruncation: number;
    perTool: Record<string, {
      invocations: number;
      truncatedInvocations: number;
      sumCharsBefore: number;
      sumCharsAfter: number;
    }>;
  };
}
