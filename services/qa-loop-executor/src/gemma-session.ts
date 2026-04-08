import { GoogleGenAI } from '@google/genai';
import { createLogger } from '../../shared/logger/logger';
import { LoopConfig } from './loop-orchestrator';
import { ToolExecutor } from './tool-executor';
import { MCPBrowser } from './mcp-browser';
import { emitToSession } from './api/websocket';
import { getToolsForPhase, toGemmaFunctionDeclarations } from './tools/tool-definitions';
import { RateLimiter, estimateTokens } from './rate-limiter';
import { IterationResult, TokenUsage, CostInfo } from './claude-session';
import Anthropic from '@anthropic-ai/sdk';

type FocusArea = 'explore' | 'chaos' | 'retest' | 'investigate';

const logger = createLogger('gemma-session');

/**
 * GemmaSession — drop-in replacement for ClaudeSession that uses Google's
 * Gemma 4 26B model via the @google/genai SDK.
 *
 * Same interface: construct with the same args, call runIteration(prompt).
 * Falls back automatically when GOOGLE_AI_API_KEY is not set (handled at
 * the orchestrator level — this class always expects the key to exist).
 */
export class GemmaSession {
  private client: GoogleGenAI;
  private sessionId: string;
  private config: LoopConfig;
  private toolExecutor: ToolExecutor;
  private abortController: AbortController | null = null;
  private tools: Anthropic.Tool[];  // Anthropic format — converted to Gemma on the fly
  private gemmaTools: any[];        // Gemma functionDeclarations
  private rateLimiter: RateLimiter;

  /** Cached system prompt — built once per runIteration call. */
  private cachedSystemPrompt: string | null = null;

  constructor(
    sessionId: string,
    config: LoopConfig,
    mcpBrowser: MCPBrowser,
    _focusArea: FocusArea = 'explore',
    _preloadedDocumentContext?: string | null,
    onTestCaseCreated?: (testCase: any, observedResult?: 'pass' | 'fail') => void,
  ) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }

    this.client = new GoogleGenAI({ apiKey });
    this.sessionId = sessionId;
    this.config = config;
    this.toolExecutor = new ToolExecutor(sessionId, config, mcpBrowser, onTestCaseCreated);
    this.rateLimiter = new RateLimiter();

    // Build tool list in Anthropic format first, then convert
    this.tools = getToolsForPhase('explore', mcpBrowser.getTools());
    this.gemmaTools = toGemmaFunctionDeclarations(this.tools);
  }

  /**
   * Run a single exploration iteration using Gemma 4.
   *
   * The method mirrors ClaudeSession.runIteration() so the orchestrator
   * doesn't care which provider is behind the scenes.
   */
  async runIteration(prompt: string, _model?: string): Promise<IterationResult> {
    this.abortController = new AbortController();

    const result: IterationResult = {
      isComplete: false,
      pagesExplored: 0,
      testsGenerated: 0,
      bugsFound: 0,
      toolCalls: 0,
      tokensUsed: 0,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      costInfo: { costCents: 0, costDollars: 0, modelUsed: 'claude-sonnet-4-6' as any, modelDisplayName: 'Gemma 4 26B' },
      modelUsed: 'claude-sonnet-4-6' as any,  // type compatibility — we override display name
    };

    // Build system prompt once
    this.cachedSystemPrompt = this.buildSystemPrompt();

    // Gemma has no `system` parameter — prepend to first user message
    const firstMessage = `${this.cachedSystemPrompt}\n\n---\n\n${prompt}`;

    const messages: Array<{ role: string; parts: any[] }> = [
      { role: 'user', parts: [{ text: firstMessage }] },
    ];

    let loopCount = 0;
    const maxLoops = 25;

    while (loopCount < maxLoops) {
      loopCount++;

      // Check for abort
      if (this.abortController?.signal.aborted) {
        result.completionReason = 'aborted';
        return result;
      }

      // Rate limit
      const estimatedTok = estimateTokens(messages);
      await this.rateLimiter.waitIfNeeded(estimatedTok);

      logger.debug('Calling Gemma API', {
        sessionId: this.sessionId,
        loopCount,
        estimatedInputTokens: estimatedTok,
      });

      let response: any;
      try {
        response = await this.client.models.generateContent({
          model: 'gemma-4-26b-a4b-it',
          contents: messages as any,
          config: {
            tools: [{ functionDeclarations: this.gemmaTools }],
            maxOutputTokens: 2048,
          },
        });
      } catch (err: any) {
        logger.error('Gemma API call failed', {
          sessionId: this.sessionId,
          error: err.message,
          loopCount,
        });
        // If it's a rate-limit error, wait and retry once
        if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
          logger.warn('Rate limited by Google — waiting 30s', { sessionId: this.sessionId });
          await new Promise(r => setTimeout(r, 30_000));
          continue;
        }
        throw err;
      }

      // Track tokens
      const usage = response.usageMetadata;
      const inputTok = usage?.promptTokenCount || 0;
      const outputTok = usage?.candidatesTokenCount || 0;
      result.tokenUsage.inputTokens += inputTok;
      result.tokenUsage.outputTokens += outputTok;
      result.tokenUsage.totalTokens += inputTok + outputTok;
      result.tokensUsed += inputTok + outputTok;

      logger.debug('Gemma API call completed', {
        sessionId: this.sessionId,
        inputTokens: inputTok,
        outputTokens: outputTok,
        loopCount,
      });

      const candidate = response.candidates?.[0];
      const parts: any[] = candidate?.content?.parts || [];

      // Emit thinking text
      const textParts = parts.filter((p: any) => p.text);
      for (const part of textParts) {
        emitToSession(this.sessionId, {
          type: 'thinking',
          data: { text: part.text },
        });
        if (part.text?.includes('EXPLORATION_COMPLETE')) {
          result.isComplete = true;
          result.completionReason = 'exploration_complete';
        }
      }

      // Check for function calls
      const functionCalls = parts.filter((p: any) => p.functionCall);
      if (functionCalls.length === 0) {
        result.completionReason = result.completionReason || 'iteration_complete';
        break;
      }

      // Add model response to history
      messages.push({ role: 'model', parts });

      // Execute all tool calls
      const toolResultParts: any[] = [];
      for (const part of functionCalls) {
        const { name, args } = part.functionCall;
        result.toolCalls++;

        emitToSession(this.sessionId, {
          type: 'tool_call',
          data: { tool: name, input: args },
        });

        try {
          const toolResult = await this.toolExecutor.execute(name, args || {});

          // Track metrics
          if (toolResult.metrics) {
            if (toolResult.metrics.pageExplored) result.pagesExplored++;
            if (toolResult.metrics.testGenerated) result.testsGenerated++;
            if (toolResult.metrics.bugFound) result.bugsFound++;
          }

          emitToSession(this.sessionId, {
            type: 'tool_result',
            data: { tool: name, success: !toolResult.error, result: toolResult.error || 'Success' },
          });

          const rawData = toolResult.data ?? { error: toolResult.error };
          toolResultParts.push({
            functionResponse: {
              name,
              response: { result: typeof rawData === 'string' ? rawData : JSON.stringify(rawData) },
            },
          });
        } catch (err: any) {
          logger.error('Tool execution failed', {
            sessionId: this.sessionId,
            tool: name,
            error: err.message,
          });
          emitToSession(this.sessionId, {
            type: 'tool_result',
            data: { tool: name, success: false, error: err.message },
          });
          toolResultParts.push({
            functionResponse: {
              name,
              response: { error: err.message },
            },
          });
        }
      }

      // Add tool results back
      messages.push({ role: 'user', parts: toolResultParts });

      // Compress history every 10 loops
      if (loopCount > 0 && loopCount % 10 === 0 && messages.length > 8) {
        const recentMessages = messages.slice(-6);
        const summary = `[Previous context: explored ${result.pagesExplored} pages, saved ${result.testsGenerated} tests, found ${result.bugsFound} bugs so far]`;
        messages.length = 0;
        messages.push(
          { role: 'user', parts: [{ text: summary }] },
          { role: 'model', parts: [{ text: 'Understood. Continuing from current state.' }] },
          ...recentMessages,
        );
        logger.info('Compressed Gemma conversation history', {
          sessionId: this.sessionId,
          loopCount,
          newMessageCount: messages.length,
        });
      }

      // Early exit if exploration is complete
      if (result.isComplete) break;
    }

    if (loopCount >= maxLoops && !result.completionReason) {
      result.completionReason = 'max_loops';
    }

    // Gemma 4 is free via Google AI Studio
    result.costInfo = {
      costCents: 0,
      costDollars: 0,
      modelUsed: 'claude-sonnet-4-6' as any,  // type compatibility
      modelDisplayName: 'Gemma 4 26B',
    };

    return result;
  }

  /**
   * Build a trimmed system prompt for Gemma 4.
   * Mirrors the trimmed ClaudeSession prompt from Phase 2.
   */
  private buildSystemPrompt(): string {
    const authSkipBlock = this.config.loginCredentials
      ? `IMPORTANT: Credentials have been provided and login is ALREADY DONE.
You are authenticated. DO NOT test the login page. DO NOT explore auth flows.
Navigate DIRECTLY to the target URL and test the application features.

`
      : '';

    return `${authSkipBlock}You are a QA engineer exploring ${this.config.targetUrl}.
Output ONLY raw JSON when asked for structured data. No markdown code fences. No extra text.

MISSION: Explore every page, generate test cases for every feature you find.

RULES:
1. Call get_session_state() FIRST to see progress
2. After EVERY browser_navigate() or browser_click(), IMMEDIATELY call browser_snapshot()
3. After EVERY browser_snapshot(), do TWO things:
   a. Call add_discovered_page() for EVERY link you see on the page
   b. Call save_test_case() for what you observed — DO NOT WAIT, save immediately
4. After saving test case, call mark_page_explored() and IMMEDIATELY navigate to the next unexplored page via get_unexplored_pages()
5. Max 5 tool calls per page then move on — do NOT spend 10+ calls on one page
6. If you see ANY issue (missing validation, UI bug, spelling error, broken link), call save_bug() IMMEDIATELY
7. TARGET: explore 3-4 pages and save 4-5 test cases PER ITERATION
8. NEVER generate test cases without browser_snapshot() first

You are being evaluated on QUANTITY and COVERAGE. A scan with 10 simple test cases across 5 pages is better than 2 detailed test cases on 1 page. Move fast.

${this.config.loginCredentials ? `CRITICAL — EVERY test case's playwright_code MUST start with these login steps:
  await page.goto('${this.config.loginCredentials.loginUrl || this.config.targetUrl}');
  await page.waitForLoadState('networkidle');
  await page.fill('${this.config.loginCredentials.emailSelector || "input[name=\\"username\\"]"}', '${this.config.loginCredentials.email}');
  await page.fill('${this.config.loginCredentials.passwordSelector || "input[name=\\"password\\"]"}', '${this.config.loginCredentials.password}');
  await page.click('${this.config.loginCredentials.submitSelector || "button[type=\\"submit\\"]"}');
  await page.waitForLoadState('networkidle');
The verification browser starts COLD — no cookies, no session. If you skip login, the test WILL fail.
Set requires_auth=true for ANY page behind login.` : ''}

COMPLETION CONDITIONS — output "EXPLORATION_COMPLETE" ONLY when ALL met:
- add_discovered_page() called for at least 3 URLs
- get_unexplored_pages() returns empty
- 5+ tests saved with save_test_case()`;
  }

  async abort(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}
