/**
 * Shared types for the multi-agent v2 system.
 */

export type AgentType = 'qa_lead' | 'exploratory' | 'security' | 'api_tester' | 'auto_tester';

export type AgentStatus = 'idle' | 'working' | 'blocked' | 'done' | 'error';

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
  status: 'done' | 'error';
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
}
