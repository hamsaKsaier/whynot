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
4. ★ DISCOVER PAGES IMMEDIATELY: After EVERY browser_snapshot(), scan ALL links and navigation items.
   For EACH link that points to a different page/route on this domain, call add_discovered_page({ url }) RIGHT AWAY.
   This is CRITICAL — it builds the queue of pages to explore. Do this BEFORE anything else.
5. INTERACT: Use browser_click() with element refs from the snapshot to click links and buttons
6. OBSERVE AGAIN: After EVERY interaction, call browser_snapshot() to see the resulting page state.
   Again, call add_discovered_page() for any NEW links you see.
7. ONLY THEN SAVE: Save test cases based on what you ACTUALLY observed using save_test_case()
8. REPORT: Log any bugs or issues you find using save_bug()
9. MARK DONE: Call mark_page_explored() when you've finished testing a page

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
3. ★★★ IMMEDIATELY call add_discovered_page() for EVERY internal link you see ★★★
   Look for all <a> links, nav items, sidebar links, footer links, breadcrumbs, etc.
   Each unique URL on the same domain = one add_discovered_page() call.
   This populates your exploration queue for future iterations!
4. Identify elements by their ref IDs (e.g., ref="e5" for a button)
5. browser_click({ element: "Login button", ref: "e5" }) — interact with elements
6. browser_snapshot() — observe the result; call add_discovered_page() for any NEW links
7. Save test cases for what you observed, then mark_page_explored() and move on

RULES:
- Be SYSTEMATIC: Don't revisit pages you've already explored
- Be THOROUGH: Test happy paths, error cases, and edge cases
- Be OBSERVANT: Note anything unusual (console errors, slow responses, UI glitches)
- Be EFFICIENT: Generate actionable test cases with clear steps
- SAVE NOTES: Use add_note() to remember important observations for future iterations
- ★ DISCOVER FIRST: After EVERY browser_snapshot(), IMMEDIATELY call add_discovered_page() for all new links
- MANDATORY WORKFLOW: For every page you test: navigate → snapshot → DISCOVER LINKS → interact → snapshot → save_test_case → mark_page_explored
- NEVER save_test_case without having called browser_snapshot() on that page FIRST
- ONLY ONE PAGE AT A TIME: Fully explore and test one page before moving to the next

═══ TEST CASE GENERATION TARGETS (MANDATORY) ═══

For EVERY page you visit, generate at least 2-3 test cases:
- One for the happy path (main functionality works as expected)
- One for edge cases (empty inputs, long text, special characters)
- One for error handling (what happens when things go wrong)

For forms, generate test cases for:
- Valid submission
- Empty required fields
- Invalid input formats (wrong email, short password)
- Boundary values

For navigation, generate test cases for:
- All links work and go to correct pages
- Back button behavior
- Direct URL access

Generate test cases EARLY and OFTEN. Don't wait until you've explored everything.
Each test case must include clear steps and expected results.

WHEN TO COMPLETE:
Output "EXPLORATION_COMPLETE" ONLY when ALL of these conditions are met:
- You have called add_discovered_page() for at least 3 different URLs
- All discovered pages have been explored (get_unexplored_pages() returns empty)
- You've generated at least 5 test cases with save_test_case()
Do NOT output "EXPLORATION_COMPLETE" if you have unexplored pages or fewer than 3 discovered pages.

═══ TEST CASE FORMAT ═══

When you save test cases with save_test_case(), test steps use CSS SELECTORS (not refs from snapshot).
To find the right selector for an element, use: browser_evaluate({ expression: "document.querySelector('input[type=email]')?.id || document.querySelector('input[type=email]')?.className" })

Step types for test cases: navigate, click, type, select_option, assert_text_visible, assert_element_exists, assert_element_visible, assert_element_not_exists, assert_element_count, assert_attribute_contains, assert_input_value, assert_url_contains, assert_url_equals, assert_no_console_errors

Every test case MUST include at least one assertion that verifies actual UI feedback.
Use the EXACT text/selectors you observed in browser_snapshot() — never guess or assume.

═══ FEATURE CATEGORY (MANDATORY) ═══
For each test case you generate, assign a feature_category field — the feature area it belongs to.
Common categories: Authentication, Dashboard, Navigation, Profile, Settings, Forms, Search, Checkout, Admin.
Use the page context to determine the appropriate category. Include the category in the test case data you save.

Also set requires_auth to true if the test requires authentication (logged-in functionality).

═══ OBSERVED RESULT TRACKING (MANDATORY) ═══
When saving test cases with save_test_case(), ALWAYS include the observed_result field:
- "pass" — you performed the steps and the assertions matched what you saw on the page
            (e.g. form submitted successfully, correct page loaded, expected text appeared)
- "fail" — you observed a bug, error, or unexpected behavior that the assertions should catch
            (e.g. validation missing, error message wrong, UI broken)

This is CRITICAL for test quality validation. We execute your test cases mechanically and
compare the result with your observation. If they don't match, we know the test needs fixing.
ALWAYS provide observed_result — never leave it out.

═══ PLAYWRIGHT CODE GENERATION (MANDATORY) ═══
For EVERY test case you save, you MUST also generate Playwright commands
in the playwright_code field. This code will be executed directly as raw commands.

CRITICAL RULES for playwright_code:
1. Do NOT include any import statements (no "import { test, expect } from '@playwright/test'")
2. Do NOT wrap code in test() or describe() blocks
3. Do NOT use expect() from @playwright/test — use page.locator().isVisible(), page.textContent(), etc. for checks
4. Assume "page" is already available as a variable — just write raw page commands
5. Use the EXACT CSS selectors you discovered during exploration
6. Add selector quality comments where appropriate: // Note: fragile selector — consider adding data-testid
7. If login credentials were provided, use process.env.TEST_USERNAME and process.env.TEST_PASSWORD — NEVER hardcode credentials
8. Include await page.screenshot() at key verification points
9. Set reasonable timeouts for navigation and element waits
10. TIMING — CRITICAL TO AVOID FALSE POSITIVES:
    - After EVERY page.goto(), add: await page.waitForLoadState('networkidle');
    - After clicking a navigation link that loads a new page, add: await page.waitForTimeout(1000);
    - The verification browser starts cold (no cache, no cookies), so pages take longer to render.
    - NEVER check for elements immediately after navigation — always wait for load state first.
11. For assertions, use plain JavaScript with throw:
    - const el = page.locator('.error-message');
    - if (!(await el.isVisible())) throw new Error('Error message not visible');
    - const text = await el.textContent();
    - if (!text?.includes('valid email')) throw new Error('Expected error text not found');

SELECTOR QUALITY RULES (CRITICAL):
- ALWAYS prefer selectors in this order: data-testid > aria-label > id > name > role > CSS class > CSS path
- NEVER use auto-generated class names (e.g., css-1a2b3c, sc-abc123, MuiButton-root)
- NEVER use nth-child or positional selectors unless absolutely necessary
- If you must use a fragile selector, add a comment: // FRAGILE: Consider adding data-testid="submit-btn" to this element
- Use page.getByRole(), page.getByLabel(), page.getByText() when possible — they're more resilient
- For forms: use page.getByLabel('Email') instead of page.locator('input[type="email"]')
- Always add a brief comment explaining what each selector targets

When generating Playwright code, use SPECIFIC selectors that match exactly ONE element:
- Prefer: page.locator('[data-testid="login-btn"]') or page.locator('#username')
- Prefer: page.getByRole('button', { name: 'Login' }) or page.getByText('Submit')
- Avoid: page.locator('.menu') or page.locator('div.container') — these often match multiple elements
- Use .first() if you know there are multiple matches: page.locator('.item').first()
- CRITICAL: If a selector might match multiple elements, ALWAYS append .first() or use a more specific selector.
  Strict mode violations (multiple matches) cause test failures. Use page.getByRole() with exact name matching
  to avoid ambiguity. Example: page.getByRole('link', { name: 'Login', exact: true })

Example playwright_code format:
\`\`\`
await page.goto('https://example.com/login');
await page.waitForLoadState('networkidle');
// Note: fragile selector — consider adding data-testid
await page.fill('input[type="email"]', 'invalid-email');
await page.fill('input[type="password"]', 'password123');
await page.click('button[type="submit"]');
await page.screenshot({ path: 'login-validation.png' });
// Verify error message is visible
const errorMsg = page.locator('.error-message');
if (!(await errorMsg.isVisible())) throw new Error('Error message not visible');
const errorText = await errorMsg.textContent();
if (!errorText?.includes('valid email')) throw new Error('Expected "valid email" error text not found');
\`\`\`

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

    // Add project context / knowledge base (Feature 9)
    logger.info('Building system prompt — project context check', {
      sessionId: this.sessionId,
      hasProjectContext: !!(this.config.projectContext && Object.keys(this.config.projectContext).length > 0),
      hasUserPrd: !!this.config.userPrd,
      contextKeys: this.config.projectContext ? Object.keys(this.config.projectContext) : [],
    });
    if (this.config.projectContext && Object.keys(this.config.projectContext).length > 0) {
      const ctx = this.config.projectContext;
      let projectContextBlock = '\n\n═══ PROJECT KNOWLEDGE BASE ═══\n';
      projectContextBlock += 'This project has been scanned before. Use this knowledge to be more efficient.\n\n';

      if (ctx.known_pages && ctx.known_pages.length > 0) {
        const explored = ctx.known_pages.filter((p: any) => p.explored);
        const unexplored = ctx.known_pages.filter((p: any) => !p.explored);
        projectContextBlock += `KNOWN PAGES (${ctx.known_pages.length} total, ${explored.length} explored, ${unexplored.length} unexplored):\n`;
        if (unexplored.length > 0) {
          projectContextBlock += `Unexplored pages (PRIORITIZE THESE):\n`;
          unexplored.slice(0, 20).forEach((p: any) => { projectContextBlock += `  - ${p.url}\n`; });
        }
        if (explored.length > 0) {
          projectContextBlock += `Previously explored pages (skip unless re-verifying):\n`;
          explored.slice(0, 10).forEach((p: any) => { projectContextBlock += `  - ${p.url}\n`; });
        }
        projectContextBlock += '\n';
      }

      if (ctx.known_bugs && ctx.known_bugs.length > 0) {
        projectContextBlock += `KNOWN BUGS (${ctx.known_bugs.length}):\n`;
        ctx.known_bugs.slice(0, 15).forEach((b: any) => {
          projectContextBlock += `  - [${b.severity}] ${b.title} (status: ${b.status})${b.page_url ? ` on ${b.page_url}` : ''}\n`;
        });
        projectContextBlock += 'Strategy: Re-verify bugs marked as "open" — they may have been fixed.\n\n';
      }

      if (ctx.total_scans) {
        projectContextBlock += `SCAN HISTORY: ${ctx.total_scans} previous scans. Last scan: ${ctx.last_scan_at || 'unknown'}\n`;
      }

      projectContextBlock += `\nSTRATEGY:\n- Focus on UNEXPLORED pages first\n- Re-verify previously found bugs to check if fixed\n- Skip pages that were thoroughly tested and had no issues\n- Generate NEW test cases for areas not yet covered\n`;

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
