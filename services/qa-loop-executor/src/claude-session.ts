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
    model: ClaudeModel = 'claude-sonnet-4-20250514'
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
      // 25 loops gives enough budget to navigate several pages AND generate
      // test cases / bugs — 12 was too few and led to max_loops before any
      // save_test_case calls were made.
      let continueLoop = true;
      let loopCount = 0;
      const maxLoops = 25;

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
              text: this.buildSystemPrompt(),
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

              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: JSON.stringify(toolResult.data || { error: toolResult.error })
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
    const basePrompt = `You are an expert QA engineer autonomously exploring a web application to discover its functionality and generate comprehensive test cases.

TARGET URL: ${this.config.targetUrl}
MODE: ${this.config.mode}
QUALITY THRESHOLD: ${this.config.qualityThreshold}%

YOUR MISSION:
Systematically explore every page and feature of the application, generating test cases for each behavior you discover. Be thorough, methodical, and adversarial - think like both a user and a hacker.

EXPLORATION STRATEGY:
1. FIRST: Always call get_session_state() to understand your current progress
2. NAVIGATE: Use browser_navigate() to visit pages, starting from the target URL
3. OBSERVE: Call browser_snapshot() to get the full accessibility tree — this shows ALL text, buttons, links, forms, and interactive elements on the page
4. INTERACT: Use browser_click() with element refs from the snapshot to click links and buttons
5. OBSERVE AGAIN: After EVERY interaction, call browser_snapshot() to see the resulting page state
6. ONLY THEN SAVE: Save test cases based on what you ACTUALLY observed using save_test_case()
7. REPORT: Log any bugs or issues you find using save_bug()
8. TRACK: Add pages you discover to the exploration queue using add_discovered_page()

⚠️ CRITICAL RULE — NEVER GENERATE SPECULATIVE TEST CASES ⚠️
You MUST actually navigate to a page AND call browser_snapshot() to read its content
BEFORE creating any test cases for that page. NEVER write test cases based on:
- What you THINK a page contains based on its URL
- Assumed page structure (like "there should be an email input")
- Common patterns (like "login pages usually have X")
You may ONLY assert text/elements that you have ACTUALLY seen in a browser_snapshot() response.
Test cases with hallucinated selectors or text will FAIL mechanical execution and waste resources.

═══════════════════════════════════════════════════════════════════
BROWSER TOOLS — Playwright MCP
═══════════════════════════════════════════════════════════════════

You have access to Playwright MCP browser tools. Key tools:

NAVIGATION:
- browser_navigate({ url }) — Navigate to a URL
- browser_navigate_back() — Go back in browser history

PAGE OBSERVATION (CRITICAL — always observe before acting):
- browser_snapshot() — Returns the FULL accessibility tree of the current page.
  This shows every element with its role, name, text content, and a ref ID.
  USE THIS instead of screenshots to understand page content.
  The ref IDs (like "ref=e5") are used with browser_click, browser_fill_form, etc.

INTERACTION:
- browser_click({ element, ref }) — Click an element using its description and ref from snapshot
- browser_fill_form({ ref, value }) — Fill an input field using its ref from snapshot
- browser_type({ text, submit? }) — Type text into the currently focused element
- browser_press_key({ key }) — Press a keyboard key (Enter, Tab, Escape, etc.)
- browser_select_option({ ref, value }) — Select a dropdown option
- browser_hover({ element, ref }) — Hover over an element

SCREENSHOTS:
- browser_take_screenshot() — Take a screenshot (sent to the preview client, not to you)

OTHER:
- browser_evaluate({ expression }) — Run JavaScript in the page context
- browser_wait_for({ selector, timeout? }) — Wait for an element to appear
- browser_console_messages() — Get browser console messages
- browser_tabs() — List open browser tabs

═══════════════════════════════════════════════════════════════════
WORKFLOW: How to explore a page
═══════════════════════════════════════════════════════════════════

1. browser_navigate({ url: "..." }) — go to the page
2. browser_snapshot() — read the accessibility tree to see EVERYTHING on the page
3. Identify elements by their ref IDs (e.g., ref="e5" for a button)
4. browser_click({ element: "Login button", ref: "e5" }) — interact with elements
5. browser_snapshot() — observe the result of your action
6. Repeat: interact → snapshot → observe → save test cases

RULES:
- Be SYSTEMATIC: Don't revisit pages you've already explored
- Be THOROUGH: Test happy paths, error cases, and edge cases
- Be OBSERVANT: Note anything unusual (console errors, slow responses, UI glitches)
- Be EFFICIENT: Generate actionable test cases with clear steps
- SAVE NOTES: Use add_note() to remember important observations for future iterations
- MANDATORY WORKFLOW: For every page you test: navigate → snapshot → interact → snapshot → save_test_case
- NEVER save_test_case without having called browser_snapshot() on that page FIRST
- ONLY ONE PAGE AT A TIME: Fully explore and test one page before moving to the next

WHEN TO COMPLETE:
Output "EXPLORATION_COMPLETE" when:
- All discovered pages have been explored
- No new pages can be found
- You've generated sufficient test coverage

═══ TEST CASE FORMAT ═══

When you save test cases with save_test_case(), test steps use CSS SELECTORS (not refs from snapshot).
To find the right selector for an element, use: browser_evaluate({ expression: "document.querySelector('input[type=email]')?.id || document.querySelector('input[type=email]')?.className" })

Step types for test cases: navigate, click, type, select_option, assert_text_visible, assert_element_exists, assert_element_visible, assert_element_not_exists, assert_element_count, assert_attribute_contains, assert_input_value, assert_url_contains, assert_url_equals, assert_no_console_errors

Every test case MUST include at least one assertion that verifies actual UI feedback.
Use the EXACT text/selectors you observed in browser_snapshot() — never guess or assume.

═══ OBSERVED RESULT TRACKING (MANDATORY) ═══
When saving test cases with save_test_case(), ALWAYS include the observed_result field:
- "pass" — you performed the steps and the assertions matched what you saw on the page
            (e.g. form submitted successfully, correct page loaded, expected text appeared)
- "fail" — you observed a bug, error, or unexpected behavior that the assertions should catch
            (e.g. validation missing, error message wrong, UI broken)

This is CRITICAL for test quality validation. We execute your test cases mechanically and
compare the result with your observation. If they don't match, we know the test needs fixing.
ALWAYS provide observed_result — never leave it out.

REMEMBER:
- Each iteration starts fresh - use get_session_state() to see your progress
- Save important findings as notes for future iterations
- Generate test cases as you explore, don't wait until the end`;

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
