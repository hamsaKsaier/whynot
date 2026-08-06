import { ClaudeModel } from './model-selector';

/**
 * Result types shared by the QA Loop session implementations and the
 * orchestrator that drives them.
 *
 * These used to live in claude-session.ts, which meant every consumer imported
 * from a provider-specific module. That file is gone (AgentSession replaced the
 * ClaudeSession/GemmaSession pair), so the types live on their own here.
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostInfo {
  costCents: number;
  costDollars: number;
  /**
   * Typed as ClaudeModel for backward compatibility with existing callers.
   * The resolved model can belong to any provider — see AgentSession.
   */
  modelUsed: ClaudeModel;
  modelDisplayName: string;
}

export interface IterationResult {
  isComplete: boolean;
  completionReason?: string;
  pagesExplored: number;
  testsGenerated: number;
  bugsFound: number;
  toolCalls: number;
  tokensUsed: number;
  tokenUsage: TokenUsage;
  costInfo: CostInfo;
  modelUsed: ClaudeModel;
}
