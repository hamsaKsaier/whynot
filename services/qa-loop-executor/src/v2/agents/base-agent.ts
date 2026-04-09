/**
 * BaseAgent — unified AI session using Vercel AI SDK.
 *
 * Replaces both claude-session.ts and gemma-session.ts with a single
 * provider-agnostic implementation. Supports Gemma 4 (default free),
 * Claude (fallback), and GPT (BYOK).
 *
 * Each specialized agent extends this base to add their own system prompt
 * and tool set.
 */
import { generateText, LanguageModel, CoreTool, CoreMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
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
 * Priority: Gemma 4 (free) → Claude → GPT
 */
function selectModel(): { model: LanguageModel; name: string } {
  if (process.env.GOOGLE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
    return { model: google('gemma-4-26b-a4b-it'), name: 'Gemma 4 26B' };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return { model: anthropic('claude-sonnet-4-20250514'), name: 'Claude Sonnet' };
  }
  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return { model: openai('gpt-4o'), name: 'GPT-4o' };
  }
  throw new Error('No AI API key configured. Set GOOGLE_AI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.');
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
  protected lastBoardPollTime: string;

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
   * Run the agent's main loop. Each agent overrides `buildTools()` and
   * `getSystemPrompt()` to customize behavior.
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

      const durationSec = Math.round((Date.now() - startTime) / 1000);
      logger.info(`${this.agentType} agent completed`, {
        sessionId: this.sessionId,
        durationSec,
        pagesExplored: this.pagesExplored,
        testsGenerated: this.testsGenerated,
        bugsFound: this.bugsFound,
      });

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          agent: this.agentType,
          status: 'done',
          message: `${this.agentType} finished: ${this.testsGenerated} tests, ${this.bugsFound} bugs`,
        },
      });

      return {
        agentType: this.agentType,
        status: 'done',
        pagesExplored: this.pagesExplored,
        testsGenerated: this.testsGenerated,
        bugsFound: this.bugsFound,
        apiEndpointsTested: this.apiEndpointsTested,
      };
    } catch (err: any) {
      logger.error(`${this.agentType} agent failed`, {
        sessionId: this.sessionId,
        error: err.message,
      });

      await this.board.updateStatus(this.sessionId, this.agentType, 'error', err.message);

      emitToSession(this.sessionId, {
        type: 'status_update',
        data: {
          agent: this.agentType,
          status: 'error',
          message: `${this.agentType} error: ${err.message}`,
        },
      });

      return {
        agentType: this.agentType,
        status: 'error',
        pagesExplored: this.pagesExplored,
        testsGenerated: this.testsGenerated,
        bugsFound: this.bugsFound,
        apiEndpointsTested: this.apiEndpointsTested,
        error: err.message,
      };
    }
  }

  /**
   * The core agentic loop using Vercel AI SDK's generateText with tools.
   */
  protected async executeLoop(systemPrompt: string): Promise<void> {
    const { model, name: modelName } = selectModel();
    const maxLoops = this.getMaxLoops();

    logger.info(`Starting ${this.agentType} agent loop`, {
      sessionId: this.sessionId,
      model: modelName,
      maxLoops,
    });

    const messages: CoreMessage[] = [
      { role: 'user', content: this.getInitialPrompt() },
    ];

    let loopCount = 0;

    while (loopCount < maxLoops) {
      loopCount++;

      // Board polling: every 5 loops, inject new discoveries
      if (loopCount > 1 && loopCount % 5 === 0) {
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
      const progressPct = Math.min(95, Math.round((loopCount / maxLoops) * 100));
      await this.board.updateStatus(this.sessionId, this.agentType, 'working', undefined, progressPct);

      try {
        const result = await generateText({
          model,
          system: systemPrompt,
          messages,
          tools: this.buildTools(),
          maxSteps: 5, // Allow up to 5 tool calls per generateText invocation
          maxTokens: 2048,
        });

        // Process text output
        if (result.text) {
          emitToSession(this.sessionId, {
            type: 'thinking',
            data: { text: result.text, agent: this.agentType },
          });

          if (result.text.includes('EXPLORATION_COMPLETE') || result.text.includes('AGENT_DONE')) {
            break;
          }
        }

        // Process tool calls from all steps
        for (const step of result.steps) {
          for (const tc of step.toolCalls) {
            this.totalToolCalls++;
            emitToSession(this.sessionId, {
              type: 'tool_call',
              data: { tool: tc.toolName, input: tc.args, agent: this.agentType },
            });

            // Execute the tool
            const toolResult = await this.executeTool(tc.toolName, tc.args as Record<string, any>);

            emitToSession(this.sessionId, {
              type: 'tool_result',
              data: {
                tool: tc.toolName,
                success: !toolResult.error,
                result: toolResult.error || 'Success',
                agent: this.agentType,
              },
            });

            // Track metrics
            this.trackMetrics(tc.toolName, toolResult);
          }
        }

        // Add assistant response to conversation
        if (result.text) {
          messages.push({ role: 'assistant', content: result.text });
        }

        // If no tool calls were made, the model is done
        const totalStepToolCalls = result.steps.reduce(
          (sum, step) => sum + step.toolCalls.length, 0
        );
        if (totalStepToolCalls === 0) {
          break;
        }

      } catch (err: any) {
        // Rate limit handling
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
   * Execute a tool call. Routes to board tools, existing tool executor, or MCP browser.
   */
  protected async executeTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    // Board tools
    switch (toolName) {
      case 'write_to_board':
        return this.boardTools.writeToBoard(args);
      case 'read_board':
        return this.boardTools.readBoard(args);
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
   */
  protected trackMetrics(toolName: string, result: ToolResult): void {
    if (result.metrics?.pageExplored) this.pagesExplored++;
    if (result.metrics?.testGenerated) this.testsGenerated++;
    if (result.metrics?.bugFound) this.bugsFound++;
  }

  // ─── Abstract methods for agent customization ───────────────────────

  /** Build the tool set for this agent type. */
  protected abstract buildTools(): Record<string, CoreTool>;

  /** Get the initial user prompt to start the agent. */
  protected abstract getInitialPrompt(): string;

  /** Maximum tool-call loops for this agent. */
  protected getMaxLoops(): number {
    return 25;
  }
}
