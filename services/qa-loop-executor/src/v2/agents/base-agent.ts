/**
 * BaseAgent — unified AI session using Vercel AI SDK.
 *
 * Replaces both claude-session.ts and gemma-session.ts with a single
 * provider-agnostic implementation. Supports Gemma 4 (default free),
 * Claude (fallback), and GPT (BYOK).
 *
 * Each specialized agent extends this base to add their own system prompt
 * and tool set.
 *
 * Architecture: tools have `execute` callbacks so the AI SDK's `maxSteps`
 * loop handles tool calling automatically. We emit WebSocket events from
 * `onStepFinish` to keep the frontend updated.
 */
import { generateText, LanguageModel, ModelMessage, tool as defineTool, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { createLogger } from '../../../../shared/logger/logger';
import { emitToSession } from '../../api/websocket';
import { AgentType, AgentConfig, AgentResult } from '../types';
import { AgentBoard } from '../agent-board';
import { AgentContextBuilder } from '../agent-context-builder';
import { ToolExecutor, ToolResult } from '../../tool-executor';
import { MCPBrowser } from '../../mcp-browser';
import { ChromeDevToolsMCP } from '../../chrome-devtools-mcp';
import { BoardTools } from '../tools/board-tools';
import {
  truncateToolResult,
  isPromptCompressionEnabled,
  emptyTruncationStats,
  recordTruncation,
  ToolTruncationStats,
} from '../tool-result-truncator';

const logger = createLogger('base-agent');

/**
 * Select the AI model based on available API keys.
 *
 * Priority order (first matching key wins):
 * 1. Google Gemini 2.5 Flash — PRIMARY (500 req/day free, native tool calling, 1M context)
 * 2. OpenRouter paid models — only with tool-capable model (free tier skipped, no tool calling)
 * 3. Z.ai GLM-5.1 — standard endpoint, pay-as-you-go (NOT coding-plan endpoint)
 * 4. Anthropic Claude — last resort (expensive)
 * 5. OpenAI GPT — BYOK option
 *
 * Why Gemini is primary:
 * - Gemma 4 via Google AI Studio hit 15 req/DAY hard cap (unusable)
 * - OpenRouter free Gemma models do NOT support tool calling (agents silently fail)
 * - Z.ai coding-plan endpoint violates policy for automated QA tools
 * - Gemini 2.5 Flash: 500 req/day free, native tool calling, 1M context — stable path
 */
/**
 * Pricing per million tokens (input / output). Used by the cost tracker
 * to compute cost per agent. Only covers the models we currently use —
 * unknown model IDs fall through to $0 (free tier) pricing.
 */
export const MODEL_PRICING_PER_MTOKEN: Record<string, { input: number; output: number; cachedInput: number }> = {
  // Opus 4.6 — premium reasoning, used for QA Lead plan + synthesis
  'claude-opus-4-6': { input: 15, output: 75, cachedInput: 1.5 },
  'claude-opus-4-5': { input: 15, output: 75, cachedInput: 1.5 },
  'claude-opus-4-5-20251101': { input: 15, output: 75, cachedInput: 1.5 },
  // Sonnet 4.6 — workhorse for all specialist agents
  'claude-sonnet-4-6': { input: 3, output: 15, cachedInput: 0.30 },
  'claude-sonnet-4-5': { input: 3, output: 15, cachedInput: 0.30 },
  'claude-sonnet-4-20250514': { input: 3, output: 15, cachedInput: 0.30 },
  // Haiku 4.5 — kept for fallback / future use
  'claude-haiku-4-5-20251001': { input: 1, output: 5, cachedInput: 0.10 },
  'claude-haiku-4-5': { input: 1, output: 5, cachedInput: 0.10 },
  // Non-Anthropic providers
  'gemini-2.5-flash': { input: 0, output: 0, cachedInput: 0 },
  'gemma-4-26b-a4b-it': { input: 0, output: 0, cachedInput: 0 },
  'glm-5.1': { input: 1.26, output: 3.96, cachedInput: 1.26 },
  'z-ai/glm-5.1': { input: 1.26, output: 3.96, cachedInput: 1.26 },
  'glm-5-turbo': { input: 0.60, output: 2.20, cachedInput: 0.06 },
};

export function computeCostCents(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number = 0,
): number {
  const rates = MODEL_PRICING_PER_MTOKEN[modelId] || { input: 0, output: 0, cachedInput: 0 };
  const billableInput = Math.max(0, inputTokens - cachedInputTokens);
  const costDollars =
    (billableInput * rates.input) / 1_000_000 +
    (cachedInputTokens * rates.cachedInput) / 1_000_000 +
    (outputTokens * rates.output) / 1_000_000;
  return Math.ceil(costDollars * 100); // cents, rounded up
}

export function selectModel(agentType?: string): { model: LanguageModel; name: string; modelId: string } {
  // Priority 1: OpenRouter (paid, tool-calling capable)
  // Uses createOpenAICompatible (not createOpenAI) to force /chat/completions endpoint.
  // createOpenAI defaults to the OpenAI Responses API which OpenRouter does not support.
  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenAICompatible({
      name: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'HTTP-Referer': 'https://whynotqa.com',
        'X-Title': 'WhyNot QA',
      },
    });
    const modelName = process.env.OPENROUTER_MODEL || 'z-ai/glm-5.1';
    return { model: openrouter(modelName), name: `GLM-5.1`, modelId: modelName };
  }

  // Priority 2: Google Gemini 2.5 Flash
  if (process.env.GOOGLE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
    const modelId = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';
    return { model: google(modelId), name: `Google ${modelId}`, modelId };
  }

  // Priority 3: Z.ai GLM-5.1 (standard pay-as-you-go endpoint only)
  if (process.env.Z_AI_API_KEY) {
    const zai = createOpenAICompatible({
      name: 'z-ai',
      apiKey: process.env.Z_AI_API_KEY,
      baseURL: process.env.Z_AI_BASE_URL || 'https://api.z.ai/api/paas/v4/',
    });
    const override = process.env.Z_AI_MODEL;
    const premiumModel = process.env.Z_AI_PREMIUM_MODEL || 'glm-5.1';
    const turboModel = process.env.Z_AI_TURBO_MODEL || 'glm-5-turbo';
    const modelName = override
      || ((agentType === 'qa_lead' || agentType === 'auto_tester') ? premiumModel : turboModel);
    return { model: zai(modelName), name: `GLM via Z.ai (${modelName})`, modelId: modelName };
  }

  // Priority 4: Anthropic Claude — Opus 4.6 for QA Lead, Sonnet 4.6 for everyone else
  //
  // Opus 4.6 ($15/$75 per M) for QA Lead ONLY:
  //   - Planning + synthesis = only 2 API calls per scan
  //   - Best-in-class cross-referencing and critical cluster detection
  //   - Cost impact: ~$0.15-0.20 per scan (negligible on the plan/synthesis pair)
  //
  // Sonnet 4.6 ($3/$15 per M) for all specialist agents:
  //   - exploratory  — intelligent navigation, form/link discovery
  //   - security     — injection testing that requires real reasoning
  //   - api_tester   — edge-case generation with schema awareness
  //   - auto_tester  — Playwright code generation
  //
  // Prior Haiku experiment failed (0 bugs / 0 tests / 0 pages on specialists)
  // because Haiku couldn't navigate OrangeHRM or generate working code.
  // Sonnet 4.6 is the latest Sonnet (same price as Sonnet 4 but better tool calling).
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    if (agentType === 'qa_lead') {
      return { model: anthropic('claude-opus-4-6'), name: 'Claude Opus 4.6', modelId: 'claude-opus-4-6' };
    }
    return { model: anthropic('claude-sonnet-4-6'), name: 'Claude Sonnet 4.6', modelId: 'claude-sonnet-4-6' };
  }

  // Priority 5: OpenAI
  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return { model: openai('gpt-4o'), name: 'GPT-4o', modelId: 'gpt-4o' };
  }

  throw new Error('No AI provider configured. Set GOOGLE_AI_API_KEY (primary), OPENROUTER_API_KEY + OPENROUTER_MODEL, Z_AI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.');
}

export abstract class BaseAgent {
  protected sessionId: string;
  protected agentType: AgentType;
  protected config: AgentConfig;
  protected board: AgentBoard;
  protected contextBuilder: AgentContextBuilder;
  protected boardTools: BoardTools;
  protected mcpBrowser: MCPBrowser | null = null;
  protected toolExecutor: ToolExecutor | null = null;

  // Tracking
  protected pagesExplored = 0;
  protected testsGenerated = 0;
  protected bugsFound = 0;
  protected apiEndpointsTested = 0;
  protected totalToolCalls = 0;
  protected successfulToolCalls = 0;
  protected failedToolCalls = 0;
  protected lastBoardPollTime: string;

  // Cost tracking (Fix D — accumulated across all generateText calls)
  protected inputTokens = 0;
  protected outputTokens = 0;
  protected cachedInputTokens = 0;
  protected modelIdUsed: string = 'unknown';
  protected lastCompletionReason: string = '';

  // Task 1–3 instrumentation: distinguish LLM calls from tool calls and
  // track max single-call size + token composition averages.
  protected llmCallCount = 0;                    // generateText invocations
  protected maxSingleCallInputTokens = 0;        // biggest single call
  // Accumulators for token-composition averages (chars-based estimates)
  protected sumSystemPromptChars = 0;
  protected sumHistoryChars = 0;
  protected sumProjectContextChars = 0;
  protected sumToolDefsChars = 0;
  // Priority 2 / Option C — residual between real usage.inputTokens and our
  // char-based estimate. Captures the tool-result accumulation that generateText
  // appends internally between maxSteps (our char sums only see call-start state).
  protected sumToolResultsAccumulatedTokens = 0;

  // ─── Priority 1: watchdog plumbing ─────────────────────────────────────
  // Orchestrator polls `lastActivityAt` every 30s. If Date.now()-lastActivityAt
  // > MAX_AGENT_IDLE_MIN*60_000 the orchestrator aborts the passed signal,
  // which unblocks any in-flight generateText() call via AbortController.
  // The orchestrator also reads `killedIdle` to distinguish normal errors
  // from externally-enforced idle-kills (no retry for killed_idle).
  public lastActivityAt: number = Date.now();
  public abortSignal?: AbortSignal;
  public killedIdle = false;
  protected markActivity(): void {
    this.lastActivityAt = Date.now();
  }

  // Task 4 support: snapshot of the board at agent start. Agents can read
  // this in getInitialPrompt() to embed board-derived data in the USER
  // message (not the system prompt, which must stay byte-stable for caching).
  protected boardEntriesAtStart: any[] = [];

  // Week 2: Chrome DevTools MCP (optional, shared across agents in this session).
  protected cdpMcp: ChromeDevToolsMCP | null = null;

  // Task 6: per-agent truncation stats. Populated by the execute callback
  // wrapper regardless of feature flag state — if the flag is off, every
  // tool call passes through untruncated but we still count invocations so
  // the breakdown log always shows the full picture.
  protected toolTruncationStats: ToolTruncationStats = emptyTruncationStats(
    isPromptCompressionEnabled(),
  );

  constructor(
    config: AgentConfig,
    mcpBrowser?: MCPBrowser,
    cdpMcp: ChromeDevToolsMCP | null = null,
  ) {
    this.sessionId = config.sessionId;
    this.agentType = config.agentType;
    this.config = config;
    this.board = new AgentBoard();
    this.contextBuilder = new AgentContextBuilder();
    this.boardTools = new BoardTools(config.sessionId, config.agentType);
    this.lastBoardPollTime = new Date().toISOString();
    this.cdpMcp = cdpMcp;

    const loopConfig = {
      targetUrl: config.targetUrl,
      mode: 'explore' as const,
      qualityThreshold: 80,
      maxIterations: 1,
      maxDurationHours: 1,
      loginCredentials: config.loginCredentials,
    };

    if (mcpBrowser) {
      this.mcpBrowser = mcpBrowser;
      this.toolExecutor = new ToolExecutor(
        config.sessionId,
        loopConfig,
        mcpBrowser,
        undefined,            // onTestCaseCreated
        cdpMcp,               // Week 2: hand CDP MCP to the tool executor
      );
    } else {
      // Agents without a browser (auto_tester, qa_lead) still need state +
      // report tools (save_test_case, get_session_state, etc.) which are
      // purely DB operations. Instantiate a ToolExecutor backed by an
      // unstarted MCPBrowser — browser_* tool calls would return "MCP
      // browser not connected" but those agents never call them.
      // Without this bootstrap, every tool call returned
      // "Tool not available for auto_tester: save_test_case" → 0 tests saved.
      const headlessBrowser = new MCPBrowser(config.sessionId);
      this.toolExecutor = new ToolExecutor(
        config.sessionId,
        loopConfig,
        headlessBrowser,
        undefined,
        cdpMcp,
      );
    }
  }

  /**
   * Run the agent's main loop.
   */
  async run(): Promise<AgentResult> {
    const startTime = Date.now();
    // Priority 1: initial heartbeat so the watchdog doesn't trip during
    // the first slow setup step (board init, system prompt build, etc.).
    this.markActivity();

    try {
      // Initialize board entry
      await this.board.initialize(this.sessionId, this.agentType);
      await this.board.updateStatus(this.sessionId, this.agentType, 'working', 'Starting...');
      this.markActivity();

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          agent: this.agentType,
          status: 'working',
          message: `${this.agentType} agent started`,
        },
      });

      // Get board state for context
      const boardEntries = await this.board.getAllForSession(this.sessionId);
      // Task 4: stash snapshot so getInitialPrompt() can read it.
      this.boardEntriesAtStart = boardEntries;

      // Build system prompt with agent-specific context
      const systemPrompt = this.contextBuilder.buildSystemPrompt(
        this.agentType,
        this.config.targetUrl,
        this.config.plan,
        this.config.projectContext,
        boardEntries,
        this.config.loginCredentials
      );

      // Run the agentic loop
      await this.executeLoop(systemPrompt);

      // Mark as done
      await this.board.updateStatus(this.sessionId, this.agentType, 'done', 'Completed');
      await this.board.updateMetrics(this.sessionId, this.agentType, {
        pages_explored: this.pagesExplored,
        tests_generated: this.testsGenerated,
        bugs_found: this.bugsFound,
        api_endpoints_tested: this.apiEndpointsTested,
      });

      const durationMs = Date.now() - startTime;
      const durationSec = Math.round(durationMs / 1000);
      const successRate = this.totalToolCalls > 0
        ? ((this.successfulToolCalls / this.totalToolCalls) * 100).toFixed(1) + '%'
        : 'N/A';

      // Fix D: compute cost from accumulated usage
      const costCents = computeCostCents(
        this.modelIdUsed,
        this.inputTokens,
        this.outputTokens,
        this.cachedInputTokens,
      );
      const costDollars = costCents / 100;

      logger.info(`${this.agentType} agent completed with tool stats`, {
        sessionId: this.sessionId,
        agentType: this.agentType,
        durationSec,
        pagesExplored: this.pagesExplored,
        testsGenerated: this.testsGenerated,
        bugsFound: this.bugsFound,
        totalToolCalls: this.totalToolCalls,
        successfulToolCalls: this.successfulToolCalls,
        failedToolCalls: this.failedToolCalls,
        successRate,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        cachedInputTokens: this.cachedInputTokens,
        costCents,
        costDollars: costDollars.toFixed(3),
        model: this.modelIdUsed,
      });

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          agent: this.agentType,
          status: 'done',
          message: `${this.agentType} finished: ${this.testsGenerated} tests, ${this.bugsFound} bugs, ${this.pagesExplored} pages, $${costDollars.toFixed(3)}`,
        },
      });

      // Week 2: snapshot CDP telemetry from the tool executor before returning
      const cdpSnapshot = this.snapshotCdpTelemetry();

      return {
        agentType: this.agentType,
        status: 'done',
        pagesExplored: this.pagesExplored,
        testsGenerated: this.testsGenerated,
        bugsFound: this.bugsFound,
        apiEndpointsTested: this.apiEndpointsTested,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        cachedInputTokens: this.cachedInputTokens,
        costCents,
        costDollars,
        modelUsed: this.modelIdUsed,
        toolCallCount: this.totalToolCalls,
        durationMs,
        completionReason: this.lastCompletionReason || 'iteration_end',
        // Task 1–3 instrumentation passthrough
        llmCallCount: this.llmCallCount,
        maxSingleCallInputTokens: this.maxSingleCallInputTokens,
        sumSystemPromptChars: this.sumSystemPromptChars,
        sumHistoryChars: this.sumHistoryChars,
        sumProjectContextChars: this.sumProjectContextChars,
        sumToolDefsChars: this.sumToolDefsChars,
        // Priority 2: residual tool-result accumulation tokens
        sumToolResultsAccumulatedTokens: this.sumToolResultsAccumulatedTokens,
        // Week 2 CDP telemetry
        cdpCallCounts: cdpSnapshot.cdpCallCounts,
        cdpCharsDropped: cdpSnapshot.cdpCharsDropped,
        // Task 6: tool-result truncation stats
        toolTruncation: this.toolTruncationStats,
      };
    } catch (err: any) {
      // Priority 1: watchdog kill is NOT a normal agent failure. Log it
      // differently, tag status as killed_idle so orchestrator knows to
      // continue rather than retry, and surface the partial metrics we
      // accumulated so cost accounting stays honest.
      const isWatchdogKill = this.killedIdle
        || err?.name === 'AbortError'
        || err?.name === 'AI_AbortError'
        || !!this.abortSignal?.aborted;

      if (isWatchdogKill) {
        logger.warn(`${this.agentType} agent killed by watchdog (idle timeout)`, {
          sessionId: this.sessionId,
          agentType: this.agentType,
          lastActivityAt: new Date(this.lastActivityAt).toISOString(),
          idleMs: Date.now() - this.lastActivityAt,
          llmCallsMadeBeforeKill: this.llmCallCount,
          toolCallsBeforeKill: this.totalToolCalls,
        });
      } else {
        logger.error(`${this.agentType} agent failed`, {
          sessionId: this.sessionId,
          error: err.message,
          stack: err.stack?.slice(0, 300),
        });
      }

      const boardStatus: 'error' | 'killed_idle' = isWatchdogKill ? 'killed_idle' : 'error';
      await this.board.updateStatus(this.sessionId, this.agentType, boardStatus, err.message).catch(() => {});

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          agent: this.agentType,
          status: boardStatus,
          message: isWatchdogKill
            ? `${this.agentType} killed by watchdog (idle)`
            : `${this.agentType} error: ${err.message}`,
        },
      });

      const errorCostCents = computeCostCents(
        this.modelIdUsed,
        this.inputTokens,
        this.outputTokens,
        this.cachedInputTokens,
      );

      const cdpSnapshot = this.snapshotCdpTelemetry();

      return {
        agentType: this.agentType,
        status: isWatchdogKill ? 'killed_idle' : 'error',
        pagesExplored: this.pagesExplored,
        testsGenerated: this.testsGenerated,
        bugsFound: this.bugsFound,
        apiEndpointsTested: this.apiEndpointsTested,
        error: err.message,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        cachedInputTokens: this.cachedInputTokens,
        costCents: errorCostCents,
        costDollars: errorCostCents / 100,
        modelUsed: this.modelIdUsed,
        toolCallCount: this.totalToolCalls,
        durationMs: Date.now() - startTime,
        completionReason: isWatchdogKill ? 'killed_idle' : 'error',
        // Task 1–3 instrumentation passthrough
        llmCallCount: this.llmCallCount,
        maxSingleCallInputTokens: this.maxSingleCallInputTokens,
        sumSystemPromptChars: this.sumSystemPromptChars,
        sumHistoryChars: this.sumHistoryChars,
        sumProjectContextChars: this.sumProjectContextChars,
        sumToolDefsChars: this.sumToolDefsChars,
        sumToolResultsAccumulatedTokens: this.sumToolResultsAccumulatedTokens,
        // Week 2 CDP telemetry
        cdpCallCounts: cdpSnapshot.cdpCallCounts,
        cdpCharsDropped: cdpSnapshot.cdpCharsDropped,
        // Task 6: tool-result truncation stats
        toolTruncation: this.toolTruncationStats,
      };
    }
  }

  /**
   * Week 2 helper: read CDP tool stats from the shared ToolExecutor so they
   * end up in the AgentResult. Orchestrator rolls these into the Scan cost
   * breakdown's chromeDevtools block.
   */
  private snapshotCdpTelemetry(): {
    cdpCallCounts: Record<string, number>;
    cdpCharsDropped: number;
  } {
    if (!this.toolExecutor) {
      return { cdpCallCounts: {}, cdpCharsDropped: 0 };
    }
    const counts: Record<string, number> = {};
    // cdpCallCounts is a Map<string, number> on ToolExecutor
    const rawCounts = (this.toolExecutor as any).cdpCallCounts as Map<string, number> | undefined;
    if (rawCounts) {
      for (const [tool, n] of rawCounts.entries()) counts[tool] = n;
    }
    const charsDropped = (this.toolExecutor as any).cdpCharsDropped || 0;
    return { cdpCallCounts: counts, cdpCharsDropped: charsDropped };
  }

  /**
   * The core agentic loop. Uses generateText with maxSteps so the SDK
   * handles tool calling internally. We use onStepFinish for WebSocket events.
   */
  protected async executeLoop(systemPrompt: string): Promise<void> {
    const { model, name: modelName, modelId } = selectModel(this.agentType);
    this.modelIdUsed = modelId;
    const maxOuterLoops = this.getMaxLoops();

    // Part 1 feature flag — read only, no compression behaviour applied yet.
    // When ENABLE_PROMPT_COMPRESSION=true and compression is wired in Part 2,
    // this flag will gate windowing / context compression / tool truncation.
    const compressionEnabled = process.env.ENABLE_PROMPT_COMPRESSION === 'true';

    logger.info(`Starting ${this.agentType} agent loop`, {
      sessionId: this.sessionId,
      model: modelName,
      maxOuterLoops,
      compressionEnabled,
    });

    // Build tools with execute callbacks
    const tools = this.buildToolsWithExecute();

    const messages: ModelMessage[] = [
      { role: 'user', content: this.getInitialPrompt() },
    ];

    let outerLoop = 0;
    let isDone = false;

    while (outerLoop < maxOuterLoops && !isDone) {
      outerLoop++;

      // Compress history every 3 outer loops (aggressive — each loop can
      // do up to 20 tool calls now, so history grows fast).
      if (outerLoop > 1 && outerLoop % 3 === 0 && messages.length > 10) {
        const keepRecent = messages.slice(-6);
        const droppedCount = messages.length - keepRecent.length;
        const summary = `[Previous context: ${outerLoop} outer loops completed. `
          + `Pages explored: ${this.pagesExplored}, tests generated: ${this.testsGenerated}, `
          + `bugs found: ${this.bugsFound}, total tool calls: ${this.totalToolCalls}. `
          + `Continue from current state.]`;
        messages.length = 0;
        messages.push({ role: 'user', content: summary });
        messages.push(...keepRecent);
        logger.info('Compressed history', {
          sessionId: this.sessionId,
          agentType: this.agentType,
          outerLoop,
          droppedMessages: droppedCount,
          messagesAfter: messages.length,
        });
      }

      // Board polling: every 3 outer loops, inject new discoveries
      if (outerLoop > 1 && outerLoop % 3 === 0) {
        const boardEntries = await this.board.getAllForSession(this.sessionId);
        const boardUpdate = this.contextBuilder.buildBoardUpdate(
          this.agentType,
          boardEntries,
          this.lastBoardPollTime
        );
        this.lastBoardPollTime = new Date().toISOString();
        if (boardUpdate) {
          messages.push({ role: 'user', content: boardUpdate });
        }
      }

      // Update progress
      const progressPct = Math.min(95, Math.round((outerLoop / maxOuterLoops) * 100));
      await this.board.updateStatus(this.sessionId, this.agentType, 'working', undefined, progressPct).catch(() => {});

      try {
        // Priority 1: heartbeat right before the blocking LLM call so the
        // watchdog sees progress even if the first step takes a while.
        this.markActivity();
        const result = await generateText({
          model,
          // System prompt via the top-level `system:` parameter. The AI SDK
          // passes this as the system block to Anthropic which keeps it as a
          // stable prefix for caching. DO NOT put system in the messages array
          // — that breaks Anthropic's prefix-based cache matching.
          system: systemPrompt,
          messages,
          tools,
          // Priority 1: propagate orchestrator's AbortController so the
          // watchdog can cancel an in-flight LLM call (and the HTTP request
          // under it) when an agent has been silent for too long.
          abortSignal: this.abortSignal,
          // Anthropic prompt caching: cache the system prompt + tool definitions
          // as a stable prefix. Only applied for Claude models — other providers
          // would silently ignore it but cleaner to guard explicitly.
          ...(modelId.startsWith('claude') ? {
            providerOptions: {
              anthropic: {
                cacheControl: { type: 'ephemeral', ttl: '1h' },
              },
            },
          } : {}),
          // 20 tool-call steps per generateText invocation. This means
          // fewer outer loops needed → fewer system prompt retransmissions
          // → better cache utilization. Each outer loop = 1 generateText call.
          stopWhen: stepCountIs(20),
          maxOutputTokens: 2048,
          onStepFinish: async (event) => {
            // Priority 1: each step = agent making progress. Reset the
            // idle timer so long-running tool calls + multi-step loops
            // don't look idle to the watchdog.
            this.markActivity();
            // Stream the AI's reasoning text to the "AI Thinking" panel.
            // The per-step `event.text` fires for each model turn (even the
            // ones that end in a tool call), so the panel updates in real
            // time instead of only at generateText completion.
            const stepText = (event as any).text as string | undefined;
            if (stepText && stepText.trim()) {
              emitToSession(this.sessionId, {
                type: 'thinking',
                data: { text: stepText + '\n', agent: this.agentType },
              });
            }
            // Emit tool calls for WebSocket
            if (event.toolCalls) {
              for (const tc of event.toolCalls) {
                emitToSession(this.sessionId, {
                  type: 'tool_call',
                  data: { tool: tc.toolName, input: (tc as any).input, agent: this.agentType },
                });
                // Mirror each tool call into the thinking stream as a
                // natural-language action line so the AI Thinking panel
                // shows live activity even when the model is purely
                // tool-using without narration.
                const inputPreview = (() => {
                  try {
                    const s = JSON.stringify((tc as any).input || {});
                    return s.length > 120 ? s.slice(0, 120) + '…' : s;
                  } catch { return ''; }
                })();
                emitToSession(this.sessionId, {
                  type: 'thinking',
                  data: {
                    text: `→ ${this.agentType}: ${tc.toolName}${inputPreview ? ' ' + inputPreview : ''}\n`,
                    agent: this.agentType,
                  },
                });
              }
            }
            // Emit tool results
            if (event.toolResults) {
              for (const tr of event.toolResults as any[]) {
                emitToSession(this.sessionId, {
                  type: 'tool_result',
                  data: {
                    tool: tr.toolName,
                    success: !tr.result?.error,
                    result: tr.result?.error || 'Success',
                    agent: this.agentType,
                  },
                });
              }
            }
          },
        });
        // Priority 1: successful LLM call completion is unambiguous activity.
        this.markActivity();

        // Fix D: accumulate token usage per generateText call for cost tracking.
        // AI SDK v6 LanguageModelUsage shape: inputTokens, outputTokens,
        // inputTokenDetails.{cacheReadTokens, cacheWriteTokens, noCacheTokens}
        const usage: any = result.usage || {};
        const callInput = usage.inputTokens || 0;
        const callOutput = usage.outputTokens || 0;
        const callCached = (usage.inputTokenDetails?.cacheReadTokens
          || usage.cachedInputTokens
          || 0);
        this.inputTokens += callInput;
        this.outputTokens += callOutput;
        this.cachedInputTokens += callCached;
        // Task 1: count LLM invocations distinctly from tool calls.
        this.llmCallCount++;
        // Task 3: track biggest single call so we know the worst case.
        if (callInput > this.maxSingleCallInputTokens) {
          this.maxSingleCallInputTokens = callInput;
        }
        if ((result as any).finishReason) {
          this.lastCompletionReason = String((result as any).finishReason);
        }

        // Log cache hit rate per generateText call for cost visibility.
        // cache_read > 0 means the system prompt was served from cache.
        const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens || 0;
        const cacheHitRate = callInput > 0 ? ((callCached / callInput) * 100).toFixed(1) : '0.0';

        // Compression baseline instrumentation (Part 1 — no compression yet).
        // Chars / 4 is a rough token estimate consistent with OpenAI's guidance.
        // These values let us pinpoint WHICH portion of the input dominates
        // cost before applying the 3 compression techniques (windowing,
        // context compression, tool-output truncation).
        const systemPromptChars = systemPrompt.length;
        const historyChars = messages.reduce((sum, m) => {
          const c: any = (m as any).content;
          if (typeof c === 'string') return sum + c.length;
          if (Array.isArray(c)) {
            return sum + c.reduce((s: number, p: any) =>
              s + (typeof p?.text === 'string' ? p.text.length : 0), 0);
          }
          return sum;
        }, 0);
        const projectContextChars = this.config.projectContext
          ? JSON.stringify(this.config.projectContext).length
          : 0;
        const approxToolOverheadChars = (() => {
          try {
            return Object.keys(tools || {}).reduce((sum, name) => {
              const def: any = (tools as any)[name];
              return sum + (def?.description?.length || 0) + 200;
            }, 0);
          } catch { return 0; }
        })();

        // Task 2: accumulate char-based composition sizes for session-wide averages.
        this.sumSystemPromptChars += systemPromptChars;
        this.sumHistoryChars += historyChars;
        this.sumProjectContextChars += projectContextChars;
        this.sumToolDefsChars += approxToolOverheadChars;

        // Priority 2 / Option C — residual = (real tokens billed) − (our chars/4 estimates).
        // Our char-based sums measure the messages array BEFORE generateText runs.
        // generateText with stopWhen=stepCountIs(20) internally appends tool-result
        // messages between steps, so the provider sees a much bigger payload by the
        // final step. usage.inputTokens reflects that final state. The delta is
        // exactly the tool-result accumulation we need to quantify for Part 2.
        const estimatedInputTokens = Math.round(
          (systemPromptChars + historyChars + projectContextChars + approxToolOverheadChars) / 4,
        );
        const toolResultsResidualTokens = Math.max(0, callInput - estimatedInputTokens);
        this.sumToolResultsAccumulatedTokens += toolResultsResidualTokens;

        logger.info('generateText usage', {
          sessionId: this.sessionId,
          agentType: this.agentType,
          outerLoop,
          inputTokens: callInput,
          outputTokens: callOutput,
          cacheReadTokens: callCached,
          cacheWriteTokens: cacheWrite,
          cacheHitRate: cacheHitRate + '%',
          model: modelId,
          // Part 1 baseline: size breakdown (chars + estimated tokens)
          sizes: {
            systemPromptChars,
            systemPromptTokensApprox: Math.round(systemPromptChars / 4),
            historyChars,
            historyTokensApprox: Math.round(historyChars / 4),
            projectContextChars,
            projectContextTokensApprox: Math.round(projectContextChars / 4),
            toolDefsCharsApprox: approxToolOverheadChars,
            toolDefsTokensApprox: Math.round(approxToolOverheadChars / 4),
            // Priority 2 residual: tokens present in the call that our
            // char-based estimate didn't account for. High values mean
            // tool-result accumulation across steps is dominating cost.
            toolResultsResidualTokens,
            estimatedInputTokens,
            messageCount: messages.length,
          },
        });

        // Check text output for completion
        if (result.text) {
          emitToSession(this.sessionId, {
            type: 'thinking',
            data: { text: result.text, agent: this.agentType },
          });

          if (result.text.includes('AGENT_DONE') || result.text.includes('EXPLORATION_COMPLETE')) {
            isDone = true;
          }

          // Add assistant response to conversation history for next loop
          messages.push({ role: 'assistant', content: result.text });
        }

        // Count tool calls across all steps
        const stepToolCalls = result.steps.reduce(
          (sum, step) => sum + (step.toolCalls?.length || 0), 0
        );
        this.totalToolCalls += stepToolCalls;

        // If no tool calls were made, the model is done
        if (stepToolCalls === 0 && !result.text) {
          isDone = true;
        }

        // Prompt the model to continue if it stopped but has more to do
        if (!isDone && stepToolCalls > 0) {
          messages.push({ role: 'user', content: 'Continue. What pages are left to explore? Check get_unexplored_pages() and move to the next one. Say "AGENT_DONE" when finished.' });
        }

      } catch (err: any) {
        // Priority 1: watchdog aborted us mid-call. Don't retry, don't swallow
        // — propagate so run() can return a killed_idle result with the
        // partial metrics we've already accumulated.
        if (
          err?.name === 'AbortError' ||
          err?.name === 'AI_AbortError' ||
          this.abortSignal?.aborted
        ) {
          this.killedIdle = true;
          throw err;
        }
        if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
          logger.warn('Rate limited — waiting 30s', { sessionId: this.sessionId, agent: this.agentType });
          await new Promise(r => setTimeout(r, 30_000));
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Build tools with execute callbacks. The execute function routes each
   * tool call to the right handler and injects errors back into the AI
   * conversation so the model can retry with correct fields.
   */
  protected buildToolsWithExecute(): Record<string, any> {
    const tools: Record<string, any> = {};
    const rawTools = this.buildToolSchemas();

    for (const [name, schema] of Object.entries(rawTools)) {
      const toolName = name;
      tools[name] = defineTool({
        description: schema.description || toolName,
        inputSchema: schema.parameters || z.object({}),
        execute: async (args: any) => {
          try {
            const result = await this.executeTool(toolName, args);

            // Check if the tool executor returned an error (not thrown, but set on result)
            if (result.error) {
              this.failedToolCalls++;
              logger.error('Tool execution failed — returning error to AI', {
                sessionId: this.sessionId,
                agentType: this.agentType,
                toolName,
                argsKeys: Object.keys(args || {}),
                argsPreview: JSON.stringify(args).slice(0, 200),
                error: result.error,
              });
              // Throw so the AI SDK surfaces the error as a tool error
              // and the model can see it and retry with correct fields.
              throw new Error(
                `Tool ${toolName} failed: ${result.error}. ` +
                `Please check all REQUIRED fields are provided and retry. ` +
                `You called with: ${JSON.stringify(args).slice(0, 200)}`
              );
            }

            this.successfulToolCalls++;
            this.trackMetrics(toolName, result);

            logger.debug('Tool executed successfully', {
              sessionId: this.sessionId,
              agentType: this.agentType,
              toolName,
              argsKeys: Object.keys(args || {}),
            });

            // Task 6: truncate the result BEFORE it becomes conversation
            // history. If the feature flag is off, `truncateToolResult`
            // still measures the payload but the wrapper returns the
            // original value untouched — recordTruncation sees
            // wasTruncated=false in that path because the cap is not
            // enforced.
            const rawData = result.data ?? { success: true };
            if (!this.toolTruncationStats.enabled) {
              // Flag off: still measure size for telemetry, but never
              // shorten — preserves Scan A semantics exactly.
              const asString = typeof rawData === 'string'
                ? rawData
                : (() => { try { return JSON.stringify(rawData); } catch { return String(rawData); } })();
              recordTruncation(this.toolTruncationStats, toolName, {
                truncated: rawData,
                charsBefore: asString.length,
                charsAfter: asString.length,
                wasTruncated: false,
                wasScreenshotStripped: false,
              });
              return rawData;
            }
            const outcome = truncateToolResult(toolName, rawData);
            recordTruncation(this.toolTruncationStats, toolName, outcome);
            return outcome.truncated;
          } catch (err: any) {
            // Already counted if thrown above (result.error branch)
            // This branch catches true exceptions (DB errors, network, etc.)
            if (!err.message?.startsWith(`Tool ${toolName} failed:`)) {
              this.failedToolCalls++;
              logger.error('Tool execution threw exception', {
                sessionId: this.sessionId,
                agentType: this.agentType,
                toolName,
                argsPreview: JSON.stringify(args).slice(0, 200),
                error: err.message,
                stack: err.stack?.slice(0, 500),
              });
              throw new Error(
                `Tool ${toolName} failed: ${err.message}. ` +
                `Please check all REQUIRED fields are provided and retry. ` +
                `You called with: ${JSON.stringify(args).slice(0, 200)}`
              );
            }
            throw err;
          }
        },
      } as any);
    }

    return tools;
  }

  /**
   * Execute a tool call. Routes to board tools, existing tool executor, or MCP browser.
   */
  protected async executeTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    // Board tools
    switch (toolName) {
      case 'write_to_board':
        return this.boardTools.writeToBoard(args as any);
      case 'read_board':
        return this.boardTools.readBoard(args as any);
      case 'send_agent_message':
        return this.boardTools.sendAgentMessage(args as any);
    }

    // Existing tool executor (handles browser + state + report tools)
    if (this.toolExecutor) {
      return this.toolExecutor.execute(toolName, args);
    }

    return { error: `Tool not available for ${this.agentType}: ${toolName}` };
  }

  /**
   * Track metrics from tool results.
   *
   * Counts by toolName (primary, reliable) OR result.metrics (legacy) —
   * using toolName is robust against downstream code paths that strip
   * or forget to set the metrics field. Only invoked on successful tool
   * calls (errors throw before reaching here), so any invocation here
   * represents a real DB write.
   *
   * Fix 4 exception: if result.data.deduplicated is set, the tool returned
   * successfully but did NOT insert a DB row (dedup). Don't increment.
   */
  protected trackMetrics(toolName: string, result: ToolResult): void {
    if (result.data?.deduplicated) return;

    if (toolName === 'mark_page_explored' || result.metrics?.pageExplored) {
      this.pagesExplored++;
    }
    if (toolName === 'save_test_case' || result.metrics?.testGenerated) {
      this.testsGenerated++;
    }
    if (toolName === 'save_bug' || result.metrics?.bugFound) {
      this.bugsFound++;
    }
    if (toolName === 'run_injection_test' || result.metrics?.vulnerabilityFound) {
      this.bugsFound++;
    }
  }

  // ─── Abstract methods for agent customization ───────────────────────

  /** Build tool schemas (description + parameters) — execute is added by base. */
  protected abstract buildToolSchemas(): Record<string, { description: string; parameters: z.ZodType }>;

  /** Get the initial user prompt to start the agent. */
  protected abstract getInitialPrompt(): string;

  /**
   * Maximum outer loops. Each outer loop = 1 generateText call with up to
   * 20 tool steps (maxSteps). Fewer outer loops = fewer system prompt
   * retransmissions = better Anthropic cache utilization.
   *
   * Total tool capacity = maxLoops × 20 maxSteps.
   */
  protected getMaxLoops(): number {
    return 4; // 4 × 20 = up to 80 tool calls — same capacity, fewer API calls
  }
}
