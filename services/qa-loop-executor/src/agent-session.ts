import { generateText, jsonSchema, tool as defineTool, stepCountIs, ModelMessage } from 'ai';
import { createLogger } from '../../shared/logger/logger';
import { LoopConfig } from './loop-orchestrator';
import { ToolExecutor } from './tool-executor';
import { MCPBrowser } from './mcp-browser';
import { emitToSession } from './api/websocket';
import { getToolsForFocusArea } from './tools/tool-definitions';
import { ClaudeModel, getModelDisplayName } from './model-selector';
import { QALoopRepository } from './repositories/qa-loop-repository';
import { combineDocuments, ParsedDocument } from './document-parser';
import { IterationResult } from './session-types';
import { selectModel, computeCostCents } from './v2/agents/base-agent';

/** Mirror of FocusArea from loop-orchestrator (defined here to avoid a circular import). */
type FocusArea = 'explore' | 'chaos' | 'retest' | 'investigate';

const logger = createLogger('agent-session');

/**
 * AgentSession — the provider-agnostic v1 (single-agent) session.
 *
 * Replaces the previous ClaudeSession / GemmaSession pair, which hardcoded the
 * Anthropic and Google SDKs respectively and were picked by an env-var check.
 * That meant a self-hoster whose only key was OpenRouter, OpenAI or Z.ai could
 * not run a single-agent scan at all — it failed with "No Anthropic API key
 * configured on platform".
 *
 * This class keeps the same public interface (constructor args, runIteration,
 * loadDocumentContext, abort) but routes the LLM call through `selectModel()`
 * — the same admin-config-driven provider layer the v2 multi-agent path uses.
 * Whatever the admin panel (or the env fallback) resolves to is what runs, so
 * every supported provider works here exactly as it does in v2.
 */
export class AgentSession {
  private sessionId: string;
  private config: LoopConfig;
  private toolExecutor: ToolExecutor;
  private abortController: AbortController | null = null;
  private rawTools: any[];
  private repository: QALoopRepository;
  /**
   * `undefined`  = not yet loaded (will load on first runIteration call)
   * `null`       = loaded but no documents found
   * `string`     = loaded document content
   */
  private documentContext: string | null | undefined = undefined;

  /** Cached system prompt — built once per runIteration call. */
  private cachedSystemPrompt: string | null = null;

  constructor(
    sessionId: string,
    config: LoopConfig,
    mcpBrowser: MCPBrowser,
    focusArea: FocusArea = 'explore',
    preloadedDocumentContext?: string | null,
    private onTestCaseCreated?: (testCase: any, observedResult?: 'pass' | 'fail') => void
  ) {
    this.sessionId = sessionId;
    this.config = config;
    this.toolExecutor = new ToolExecutor(sessionId, config, mcpBrowser, onTestCaseCreated);

    // Select tools based on the current focus area, merging MCP browser tools (2.2).
    // No cache_control marker here — prompt caching is applied via providerOptions
    // on the generateText call instead, which the AI SDK maps per provider.
    this.rawTools = getToolsForFocusArea(focusArea, mcpBrowser.getTools());
    this.repository = new QALoopRepository();

    // Accept pre-loaded document context to avoid a DB round-trip per iteration (2.6)
    if (preloadedDocumentContext !== undefined) {
      this.documentContext = preloadedDocumentContext;
    }
  }

  /**
   * Load and cache document context from the database
   */
  async loadDocumentContext(): Promise<void> {
    try {
      const documents = await this.repository.getDocuments(this.sessionId, { activeOnly: true });

      if (documents.length === 0) {
        this.documentContext = null;
        return;
      }

      // Convert to ParsedDocument format for combineDocuments
      const parsedDocs: ParsedDocument[] = documents.map(doc => ({
        filename: doc.filename,
        fileType: doc.file_type as any,
        fileSizeBytes: doc.file_size_bytes,
        content: doc.content || '',
        summary: doc.summary || '',
        chunks: [],
        chunkCount: doc.chunk_count || 1,
        metadata: {
          headings: [],
          wordCount: (doc.content || '').split(/\s+/).length,
          characterCount: (doc.content || '').length,
          estimatedTokens: Math.ceil((doc.content || '').length / 4),
          hasCodeBlocks: false,
          hasTables: false
        }
      }));

      // Combine documents with a token limit
      // COST OPTIMIZATION: Reduced from 50K to 10K tokens
      this.documentContext = combineDocuments(parsedDocs, 10000);

      logger.info('Loaded document context', {
        sessionId: this.sessionId,
        documentCount: documents.length,
        contextLength: this.documentContext.length
      });
    } catch (error: any) {
      logger.warn('Failed to load document context', { error: error.message });
      this.documentContext = null; // null = loaded (with failure), won't retry
    }
  }

  /**
   * Run one iteration of the loop.
   *
   * `requestedModel` is retained for interface compatibility and for cost
   * labelling when the resolved provider happens to be the same model. The
   * model that actually runs comes from `selectModel()` (admin config first,
   * env fallback second) — the caller no longer dictates the provider.
   */
  async runIteration(
    prompt: string,
    requestedModel: ClaudeModel = 'claude-sonnet-4-6'
  ): Promise<IterationResult> {
    this.abortController = new AbortController();

    // Load document context if not already loaded (Phase 7 / 2.6: cache per orchestrator run)
    if (this.documentContext === undefined) {
      await this.loadDocumentContext();
    }

    const { model, name: modelName, modelId } = await selectModel('single_agent');

    const result: IterationResult = {
      isComplete: false,
      pagesExplored: 0,
      testsGenerated: 0,
      bugsFound: 0,
      toolCalls: 0,
      tokensUsed: 0,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      },
      costInfo: {
        costCents: 0,
        costDollars: 0,
        // Cast: IterationResult types these as ClaudeModel for backward compat,
        // but the resolved model can be any provider's id.
        modelUsed: modelId as ClaudeModel,
        modelDisplayName: modelName
      },
      modelUsed: modelId as ClaudeModel
    };

    // Build system prompt ONCE per iteration and reuse across all tool-call steps.
    this.cachedSystemPrompt = this.buildSystemPrompt();

    const messages: ModelMessage[] = [{ role: 'user', content: prompt }];
    const tools = this.buildToolsWithExecute(result);

    try {
      logger.info('Starting single-agent iteration', {
        sessionId: this.sessionId,
        model: modelName,
        requestedModel,
        toolCount: Object.keys(tools).length,
      });

      const generation = await this.withRateLimitRetry(() => generateText({
        model,
        system: this.cachedSystemPrompt!,
        messages,
        tools,
        abortSignal: this.abortController!.signal,
        // Anthropic prompt caching: cache the system prompt + tool definitions
        // as a stable prefix. Other providers ignore it, but guard explicitly.
        ...(modelId.startsWith('claude') ? {
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral', ttl: '1h' },
            },
          },
        } : {}),
        // Mirrors the previous manual loop cap of 25 model turns per iteration.
        stopWhen: stepCountIs(25),
        // Matches the v2 agents. Kept deliberately modest: providers bill (and
        // gate) on the *requested* ceiling, so a large value makes calls fail
        // outright on free tiers and low-balance accounts even when the reply
        // would have been short.
        maxOutputTokens: 2048,
        onStepFinish: (event: any) => {
          // Stream the model's reasoning to the "AI Thinking" panel as each
          // step lands, rather than only when the whole iteration finishes.
          const stepText = event?.text as string | undefined;
          if (stepText && stepText.trim()) {
            emitToSession(this.sessionId, {
              type: 'thinking',
              data: { text: stepText }
            });
          }
        },
      }));

      // Token + cost accounting. The AI SDK normalises usage across providers;
      // cache read/write details are only present on providers that report them.
      const usage: any = generation.usage || {};
      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const cachedInputTokens = usage.cachedInputTokens ?? 0;
      const cacheWriteTokens = usage.cacheCreationInputTokens ?? 0;

      result.tokenUsage.inputTokens = inputTokens;
      result.tokenUsage.outputTokens = outputTokens;
      result.tokenUsage.totalTokens = inputTokens + outputTokens;
      result.tokensUsed = inputTokens + outputTokens;

      const costCents = computeCostCents(
        modelId,
        inputTokens,
        outputTokens,
        cachedInputTokens,
        cacheWriteTokens,
      );
      result.costInfo.costCents = costCents;
      result.costInfo.costDollars = costCents / 100;

      if (this.abortController.signal.aborted) {
        logger.info('Iteration aborted', { sessionId: this.sessionId });
        result.completionReason = 'aborted';
        return result;
      }

      // EXPLORATION_COMPLETE can appear in any step's text, not just the last.
      const allText = [
        generation.text || '',
        ...(generation.steps || []).map((s: any) => s.text || ''),
      ].join('\n');

      if (allText.includes('EXPLORATION_COMPLETE')) {
        result.isComplete = true;
        result.completionReason = 'exploration_complete';
      } else if ((generation.steps?.length ?? 0) >= 25) {
        logger.warn('Max steps reached in iteration', { sessionId: this.sessionId });
        result.completionReason = 'max_loops';
      } else {
        result.completionReason = 'iteration_complete';
      }

      logger.info('Single-agent iteration finished', {
        sessionId: this.sessionId,
        model: modelName,
        steps: generation.steps?.length ?? 0,
        toolCalls: result.toolCalls,
        pagesExplored: result.pagesExplored,
        testsGenerated: result.testsGenerated,
        bugsFound: result.bugsFound,
        inputTokens,
        outputTokens,
        costCents,
        completionReason: result.completionReason,
      });

      return result;

    } catch (error: any) {
      if (this.abortController?.signal.aborted) {
        logger.info('Iteration aborted', { sessionId: this.sessionId });
        result.completionReason = 'aborted';
        return result;
      }
      logger.error('Agent session error', {
        sessionId: this.sessionId,
        model: modelName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retry the LLM call when the provider rate-limits us.
   *
   * Free tiers are the normal case for a self-hosted install — Google's free
   * Flash tier allows as few as 5 requests/minute, and a 25-step agent loop
   * blows through that immediately. Without this, the whole iteration dies on
   * the first 429. Mirrors the handling in the v2 agents' loop.
   *
   * Honours the provider's own "retry in Ns" hint when it gives one, since
   * guessing shorter just burns another request against the same quota.
   */
  private async withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxAttempts = 4;

    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const message = String(error?.message ?? '');
        const isRateLimit =
          message.includes('429') ||
          message.includes('RESOURCE_EXHAUSTED') ||
          /quota|rate limit/i.test(message);

        if (!isRateLimit || attempt >= maxAttempts || this.abortController?.signal.aborted) {
          throw error;
        }

        // "Please retry in 40.8154s" → wait that long (+1s), else back off.
        const hinted = message.match(/retry in ([\d.]+)s/i);
        const waitMs = hinted
          ? Math.ceil(parseFloat(hinted[1]) * 1000) + 1000
          : Math.min(60_000, 15_000 * attempt);

        logger.warn('Rate limited by provider — backing off', {
          sessionId: this.sessionId,
          attempt,
          waitMs,
        });

        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }

  /**
   * Convert the focus-area tool definitions (raw JSON Schema, Anthropic shape)
   * into AI SDK tools with execute callbacks, so the SDK drives the tool loop.
   * Metrics and WebSocket events are recorded as each tool runs.
   */
  private buildToolsWithExecute(result: IterationResult): Record<string, any> {
    const tools: Record<string, any> = {};

    for (const raw of this.rawTools) {
      const toolName = raw.name;
      tools[toolName] = defineTool({
        description: raw.description || toolName,
        inputSchema: jsonSchema(raw.input_schema || { type: 'object', properties: {} }),
        execute: async (args: any) => {
          result.toolCalls++;

          emitToSession(this.sessionId, {
            type: 'tool_call',
            data: { tool: toolName, input: args }
          });

          try {
            const toolResult = await this.toolExecutor.execute(
              toolName,
              (args || {}) as Record<string, any>
            );

            if (toolResult.metrics) {
              if (toolResult.metrics.pageExplored) result.pagesExplored++;
              if (toolResult.metrics.testGenerated) result.testsGenerated++;
              if (toolResult.metrics.bugFound) result.bugsFound++;
            }

            emitToSession(this.sessionId, {
              type: 'tool_result',
              data: {
                tool: toolName,
                success: !toolResult.error,
                result: toolResult.error ? toolResult.error : 'Success'
              }
            });

            if (toolResult.error) {
              // Surface the failure to the model so it can correct itself,
              // rather than silently returning an error blob it may ignore.
              throw new Error(
                `Tool ${toolName} failed: ${toolResult.error}. ` +
                `Check all REQUIRED fields are provided and retry.`
              );
            }

            // Avoid double-serialization: MCP browser tools already return text.
            const rawData = toolResult.data ?? { success: true };
            return typeof rawData === 'string' ? rawData : JSON.stringify(rawData);

          } catch (error: any) {
            logger.error('Tool execution failed', {
              sessionId: this.sessionId,
              tool: toolName,
              error: error.message
            });

            emitToSession(this.sessionId, {
              type: 'tool_result',
              data: { tool: toolName, success: false, error: error.message }
            });

            throw error;
          }
        },
      });
    }

    return tools;
  }

  private buildSystemPrompt(): string {
    const authSkipBlock = this.config.loginCredentials
      ? `IMPORTANT: Credentials have been provided and login is ALREADY DONE.
You are authenticated. DO NOT test the login page. DO NOT explore auth flows.
Navigate DIRECTLY to the target URL and test the application features.

`
      : '';

    const basePrompt = `${authSkipBlock}You are a QA engineer exploring ${this.config.targetUrl}.
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

${this.config.loginCredentials ? 'CRITICAL — EVERY test case\'s playwright_code MUST start with these login steps:\n'
+ '  await page.goto(\'' + (this.config.loginCredentials.loginUrl || this.config.targetUrl) + '\');\n'
+ '  await page.waitForLoadState(\'networkidle\');\n'
+ '  await page.fill(\'' + (this.config.loginCredentials.emailSelector || 'input[name="username"]') + '\', \'' + this.config.loginCredentials.email + '\');\n'
+ '  await page.fill(\'' + (this.config.loginCredentials.passwordSelector || 'input[name="password"]') + '\', \'' + this.config.loginCredentials.password + '\');\n'
+ '  await page.click(\'' + (this.config.loginCredentials.submitSelector || 'button[type="submit"]') + '\');\n'
+ '  await page.waitForLoadState(\'networkidle\');\n'
+ 'The verification browser starts COLD — no cookies, no session. If you skip login, the test WILL fail.\n'
+ 'Set requires_auth=true for ANY page behind login.' : ''}

COMPLETION CONDITIONS — output "EXPLORATION_COMPLETE" ONLY when ALL met:
- add_discovered_page() called for at least 3 URLs
- get_unexplored_pages() returns empty
- 5+ tests saved with save_test_case()

Each iteration starts fresh — use get_session_state() to see your progress.
Save important findings as notes with add_note() for future iterations.`;

    // Build context section with all document sources
    let contextSection = '';

    // Add inline document context from config (legacy support)
    if (this.config.documentContext) {
      contextSection += `\n\nUSER-PROVIDED CONTEXT:\n${this.config.documentContext}`;
    }

    // Add uploaded documents from database (Phase 7)
    if (this.documentContext) {
      contextSection += `\n\n${this.documentContext}`;
    }

    // Add project context / knowledge base (Feature 9)
    logger.info('Building system prompt — project context check', {
      sessionId: this.sessionId,
      hasProjectContext: !!(this.config.projectContext && Object.keys(this.config.projectContext).length > 0),
      hasUserPrd: !!this.config.userPrd,
      contextKeys: this.config.projectContext ? Object.keys(this.config.projectContext) : [],
    });
    if (this.config.projectContext && Object.keys(this.config.projectContext).length > 0) {
      const ctx = this.config.projectContext;
      let projectContextBlock = '\n\nPROJECT CONTEXT (prior scans exist — skip already-tested areas):\n';

      // Only list unexplored pages (skip explored entirely)
      if (ctx.known_pages && ctx.known_pages.length > 0) {
        const unexplored = ctx.known_pages.filter((p: any) => !p.explored);
        if (unexplored.length > 0) {
          projectContextBlock += `UNEXPLORED PAGES (${unexplored.length}):\n`;
          unexplored.slice(0, 10).forEach((p: any) => { projectContextBlock += `  - ${p.url}\n`; });
          if (unexplored.length > 10) projectContextBlock += `  ... and ${unexplored.length - 10} more\n`;
          projectContextBlock += '\n';
        }
      }

      // Only list open bugs (skip fixed/wont_fix)
      if (ctx.known_bugs && ctx.known_bugs.length > 0) {
        const openBugs = ctx.known_bugs.filter((b: any) => b.status === 'open');
        if (openBugs.length > 0) {
          projectContextBlock += `OPEN BUGS (${openBugs.length}) — re-verify these:\n`;
          openBugs.slice(0, 10).forEach((b: any) => {
            projectContextBlock += `  - [${b.severity}] ${b.title}${b.page_url ? ` on ${b.page_url}` : ''}\n`;
          });
          projectContextBlock += '\n';
        }
      }

      // Only list failed tests (skip passed)
      if (ctx.test_coverage && ctx.test_coverage.length > 0) {
        const failed = ctx.test_coverage.filter((tc: any) => tc.status === 'failed');
        if (failed.length > 0) {
          projectContextBlock += `FAILED TESTS (${failed.length}) — retest these:\n`;
          failed.slice(0, 10).forEach((tc: any) => {
            projectContextBlock += `  - ${tc.name || tc.test_case_id}${tc.page_url ? ` (${tc.page_url})` : ''}\n`;
          });
          projectContextBlock += '\n';
        }
      }

      contextSection += projectContextBlock;
    }

    // Add user PRD
    if (this.config.userPrd) {
      contextSection += `\n\n═══ USER PROJECT NOTES / PRD ═══\n${this.config.userPrd}\n\nUse these notes to understand the application's intended behavior and prioritize testing accordingly.\n`;
    }

    if (contextSection) {
      return `${basePrompt}
${contextSection}

Use this context to better understand the application's expected behavior, features to test, and areas to focus on.`;
    }

    return basePrompt;
  }

  async abort(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}
