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
import { BoardTools } from '../tools/board-tools';

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

  constructor(config: AgentConfig, mcpBrowser?: MCPBrowser) {
    this.sessionId = config.sessionId;
    this.agentType = config.agentType;
    this.config = config;
    this.board = new AgentBoard();
    this.contextBuilder = new AgentContextBuilder();
    this.boardTools = new BoardTools(config.sessionId, config.agentType);
    this.lastBoardPollTime = new Date().toISOString();

    if (mcpBrowser) {
      this.mcpBrowser = mcpBrowser;
      this.toolExecutor = new ToolExecutor(
        config.sessionId,
        {
          targetUrl: config.targetUrl,
          mode: 'explore',
          qualityThreshold: 80,
          maxIterations: 1,
          maxDurationHours: 1,
          loginCredentials: config.loginCredentials,
        },
        mcpBrowser
      );
    }
  }

  /**
   * Run the agent's main loop.
   */
  async run(): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // Initialize board entry
      await this.board.initialize(this.sessionId, this.agentType);
      await this.board.updateStatus(this.sessionId, this.agentType, 'working', 'Starting...');

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
      };
    } catch (err: any) {
      logger.error(`${this.agentType} agent failed`, {
        sessionId: this.sessionId,
        error: err.message,
        stack: err.stack?.slice(0, 300),
      });

      await this.board.updateStatus(this.sessionId, this.agentType, 'error', err.message).catch(() => {});

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: { agent: this.agentType, status: 'error', message: `${this.agentType} error: ${err.message}` },
      });

      const errorCostCents = computeCostCents(
        this.modelIdUsed,
        this.inputTokens,
        this.outputTokens,
        this.cachedInputTokens,
      );

      return {
        agentType: this.agentType,
        status: 'error',
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
        completionReason: 'error',
      };
    }
  }

  /**
   * The core agentic loop. Uses generateText with maxSteps so the SDK
   * handles tool calling internally. We use onStepFinish for WebSocket events.
   */
  protected async executeLoop(systemPrompt: string): Promise<void> {
    const { model, name: modelName, modelId } = selectModel(this.agentType);
    this.modelIdUsed = modelId;
    const maxOuterLoops = this.getMaxLoops();

    logger.info(`Starting ${this.agentType} agent loop`, {
      sessionId: this.sessionId,
      model: modelName,
      maxOuterLoops,
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
        const result = await generateText({
          model,
          // System prompt via the top-level `system:` parameter. The AI SDK
          // passes this as the system block to Anthropic which keeps it as a
          // stable prefix for caching. DO NOT put system in the messages array
          // — that breaks Anthropic's prefix-based cache matching.
          system: systemPrompt,
          messages,
          tools,
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
            // Emit tool calls for WebSocket
            if (event.toolCalls) {
              for (const tc of event.toolCalls) {
                emitToSession(this.sessionId, {
                  type: 'tool_call',
                  data: { tool: tc.toolName, input: (tc as any).input, agent: this.agentType },
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
        if ((result as any).finishReason) {
          this.lastCompletionReason = String((result as any).finishReason);
        }

        // Log cache hit rate per generateText call for cost visibility.
        // cache_read > 0 means the system prompt was served from cache.
        const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens || 0;
        const cacheHitRate = callInput > 0 ? ((callCached / callInput) * 100).toFixed(1) : '0.0';
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

            return result.data || { success: true };
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
