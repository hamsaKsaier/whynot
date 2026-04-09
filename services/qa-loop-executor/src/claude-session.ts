import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../../shared/logger/logger';
import { LoopConfig } from './loop-orchestrator';
import { ToolExecutor } from './tool-executor';
import { MCPBrowser } from './mcp-browser';
import { emitToSession } from './api/websocket';
import { getToolsForFocusArea } from './tools/tool-definitions';
import { ClaudeModel, calculateCost, getModelDisplayName, MODEL_CAPABILITIES } from './model-selector';
import { QALoopRepository } from './repositories/qa-loop-repository';
import { combineDocuments, ParsedDocument } from './document-parser';

/** Mirror of FocusArea from loop-orchestrator (defined here to avoid a circular import). */
type FocusArea = 'explore' | 'chaos' | 'retest' | 'investigate';

const logger = createLogger('claude-session');

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostInfo {
  costCents: number;
  costDollars: number;
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
  // Enhanced tracking for Phase 6 & 8
  tokenUsage: TokenUsage;
  costInfo: CostInfo;
  modelUsed: ClaudeModel;
}

export class ClaudeSession {
  private client: Anthropic;
  private sessionId: string;
  private config: LoopConfig;
  private toolExecutor: ToolExecutor;
  private abortController: AbortController | null = null;
  private tools: Anthropic.Tool[];
  private repository: QALoopRepository;
  /**
   * `undefined`  = not yet loaded (will load on first runIteration call)
   * `null`       = loaded but no documents found
   * `string`     = loaded document content
   */
  private documentContext: string | null | undefined = undefined;

  /** Cached system prompt — built once per runIteration call and reused across tool-call loops. */
  private cachedSystemPrompt: string | null = null;

  constructor(
    sessionId: string,
    config: LoopConfig,
    mcpBrowser: MCPBrowser,
    focusArea: FocusArea = 'explore',
    preloadedDocumentContext?: string | null,
    onTestCaseCreated?: (testCase: any, observedResult?: 'pass' | 'fail') => void
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    this.client = new Anthropic({ apiKey });
    this.sessionId = sessionId;
    this.config = config;
    this.toolExecutor = new ToolExecutor(sessionId, config, mcpBrowser, onTestCaseCreated);

    // Select tools based on the current focus area, merging MCP browser tools (2.2)
    const tools = getToolsForFocusArea(focusArea, mcpBrowser.getTools());
    // Add cache_control to the last tool so the entire tools array is cached (2.1: prompt caching)
    if (tools.length > 0) {
      (tools[tools.length - 1] as any).cache_control = { type: 'ephemeral' };
    }
    this.tools = tools;
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

  async runIteration(
    prompt: string,
    model: ClaudeModel = 'claude-sonnet-4-6'
  ): Promise<IterationResult> {
    this.abortController = new AbortController();

    // Load document context if not already loaded (Phase 7 / 2.6: cache per orchestrator run)
    if (this.documentContext === undefined) {
      await this.loadDocumentContext();
    }

    // Get model capabilities for max tokens
    const modelCapabilities = MODEL_CAPABILITIES[model];
    const maxTokens = modelCapabilities?.maxTokens || 4096;

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
        modelUsed: model,
        modelDisplayName: getModelDisplayName(model)
      },
      modelUsed: model
    };

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: prompt }
    ];

    try {
      // Run conversation loop until Claude stops calling tools.
      // 25 loops is enough with the trimmed system prompt and focused
      // workflow — we also compress history every 10 loops to keep
      // per-call input tokens under the Gemma 4 TPM ceiling.
      let continueLoop = true;
      let loopCount = 0;
      const maxLoops = 25;

      // Build system prompt ONCE per iteration and reuse across all tool-call loops.
      // Previously this was rebuilt on every loop (60+ times), wasting CPU and string allocations.
      this.cachedSystemPrompt = this.buildSystemPrompt();

      while (continueLoop && loopCount < maxLoops) {
        loopCount++;

        logger.debug('Calling Claude API', {
          sessionId: this.sessionId,
          messageCount: messages.length,
          loopCount,
          model
        });

        // Make the API call with streaming using dynamic model.
        // Pass system as a content-block array so Anthropic prompt caching applies
        // to the (static) system prompt across iterations.
        const stream = await this.client.messages.stream({
          model,
          max_tokens: maxTokens,
          system: [
            {
              type: 'text',
              text: this.cachedSystemPrompt!,
              cache_control: { type: 'ephemeral' }
            }
          ] as any,
          tools: this.tools,
          messages
        });

        // Collect thinking text for streaming to client
        let thinkingText = '';

        for await (const event of stream) {
          // Check for abort
          if (this.abortController?.signal.aborted) {
            logger.info('Iteration aborted', { sessionId: this.sessionId });
            result.completionReason = 'aborted';
            return result;
          }

          // Stream thinking text to client
          if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              thinkingText += event.delta.text;
              emitToSession(this.sessionId, {
                type: 'thinking',
                data: { text: event.delta.text }
              });
            }
          }
        }

        // Get final message
        const response = await stream.finalMessage();

        // Track detailed token usage
        const inputTokens = response.usage?.input_tokens || 0;
        const outputTokens = response.usage?.output_tokens || 0;

        result.tokenUsage.inputTokens += inputTokens;
        result.tokenUsage.outputTokens += outputTokens;
        result.tokenUsage.totalTokens += inputTokens + outputTokens;
        result.tokensUsed += inputTokens + outputTokens;

        // Calculate cost for this API call
        const callCost = calculateCost(model, inputTokens, outputTokens);
        result.costInfo.costCents += callCost.costCents;
        result.costInfo.costDollars += callCost.costDollars;

        logger.debug('API call completed', {
          sessionId: this.sessionId,
          model,
          inputTokens,
          outputTokens,
          costCents: callCost.costCents.toFixed(4)
        });

        // Check if we need to process tool calls
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0) {
          // No tool calls - Claude is done with this iteration
          continueLoop = false;

          // Check if exploration is complete
          const textContent = response.content
            .filter((block): block is Anthropic.TextBlock => block.type === 'text')
            .map(block => block.text)
            .join('\n');

          if (textContent.includes('EXPLORATION_COMPLETE')) {
            result.isComplete = true;
            result.completionReason = 'exploration_complete';
          } else {
            result.completionReason = 'iteration_complete';
          }
        } else {
          // Process tool calls
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const toolUse of toolUseBlocks) {
            result.toolCalls++;

            logger.debug('Executing tool', {
              sessionId: this.sessionId,
              tool: toolUse.name,
              input: toolUse.input
            });

            emitToSession(this.sessionId, {
              type: 'tool_call',
              data: {
                tool: toolUse.name,
                input: toolUse.input
              }
            });

            try {
              // Execute the tool
              const toolResult = await this.toolExecutor.execute(
                toolUse.name,
                toolUse.input as Record<string, any>
              );

              // Track metrics from tool execution
              if (toolResult.metrics) {
                if (toolResult.metrics.pageExplored) result.pagesExplored++;
                if (toolResult.metrics.testGenerated) result.testsGenerated++;
                if (toolResult.metrics.bugFound) result.bugsFound++;
              }

              emitToSession(this.sessionId, {
                type: 'tool_result',
                data: {
                  tool: toolUse.name,
                  success: !toolResult.error,
                  result: toolResult.error ? toolResult.error : 'Success'
                }
              });

              // Avoid double-serialization: if data is already a string (e.g. MCP
              // browser text), pass it as-is. Only JSON.stringify objects/arrays.
              const rawData = toolResult.data ?? { error: toolResult.error };
              const serialized = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);
              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: serialized
              });

            } catch (error: any) {
              logger.error('Tool execution failed', {
                sessionId: this.sessionId,
                tool: toolUse.name,
                error: error.message
              });

              emitToSession(this.sessionId, {
                type: 'tool_result',
                data: {
                  tool: toolUse.name,
                  success: false,
                  error: error.message
                }
              });

              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: JSON.stringify({ error: error.message }),
                is_error: true
              });
            }
          }

          // Add assistant message and tool results for next loop
          messages.push({
            role: 'assistant',
            content: response.content
          });
          messages.push({
            role: 'user',
            content: toolResults
          });

          // Compress conversation history every 10 loops to keep input tokens down
          if (loopCount > 0 && loopCount % 10 === 0 && messages.length > 8) {
            const recentMessages = messages.slice(-6);
            const summary = `[Previous context: explored ${result.pagesExplored} pages, saved ${result.testsGenerated} tests, found ${result.bugsFound} bugs so far]`;
            messages.length = 0;
            messages.push(
              { role: 'user', content: summary },
              { role: 'assistant', content: [{ type: 'text', text: 'Understood. Continuing from current state.' }] },
              ...recentMessages
            );
            logger.info('Compressed conversation history', {
              sessionId: this.sessionId,
              loopCount,
              newMessageCount: messages.length,
            });
          }
        }
      }

      if (loopCount >= maxLoops) {
        logger.warn('Max loops reached in iteration', { sessionId: this.sessionId });
        result.completionReason = 'max_loops';
      }

      return result;

    } catch (error: any) {
      logger.error('Claude session error', {
        sessionId: this.sessionId,
        error: error.message
      });
      throw error;
    }
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
