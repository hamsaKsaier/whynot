import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../../shared/logger/logger';
import { LoopConfig } from './loop-orchestrator';
import { ToolExecutor } from './tool-executor';
import { emitToSession } from './api/websocket';
import { getToolDefinitions } from './tools/tool-definitions';
import { ClaudeModel, calculateCost, getModelDisplayName, MODEL_CAPABILITIES } from './model-selector';
import { QALoopRepository } from './repositories/qa-loop-repository';
import { combineDocuments, ParsedDocument } from './document-parser';

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
  private documentContext: string | null = null;

  constructor(sessionId: string, config: LoopConfig) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    this.client = new Anthropic({ apiKey });
    this.sessionId = sessionId;
    this.config = config;
    this.toolExecutor = new ToolExecutor(sessionId, config);
    this.tools = getToolDefinitions();
    this.repository = new QALoopRepository();
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
      this.documentContext = null;
    }
  }

  async runIteration(
    prompt: string,
    model: ClaudeModel = 'claude-sonnet-4-20250514'
  ): Promise<IterationResult> {
    this.abortController = new AbortController();

    // Load document context if not already loaded (Phase 7)
    if (this.documentContext === null) {
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
      // Run conversation loop until Claude stops calling tools
      // COST OPTIMIZATION: Reduced from 50 to 12 max loops
      let continueLoop = true;
      let loopCount = 0;
      const maxLoops = 12; // Reduced for cost savings

      while (continueLoop && loopCount < maxLoops) {
        loopCount++;

        logger.debug('Calling Claude API', {
          sessionId: this.sessionId,
          messageCount: messages.length,
          loopCount,
          model
        });

        // Make the API call with streaming using dynamic model
        const stream = await this.client.messages.stream({
          model,
          max_tokens: maxTokens,
          system: this.buildSystemPrompt(),
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
2. NAVIGATE: Use navigate() to visit pages, starting from the target URL
3. DISCOVER: Call get_page_elements() to identify all interactive elements
4. EXPLORE: Click links and buttons to discover new pages
5. TEST: For forms, test with both valid and invalid inputs
6. DOCUMENT: Save test cases for every significant behavior
7. REPORT: Log any bugs or issues you find
8. TRACK: Add pages you discover to the exploration queue

RULES:
- Be SYSTEMATIC: Don't revisit pages you've already explored
- Be THOROUGH: Test happy paths, error cases, and edge cases
- Be OBSERVANT: Note anything unusual (console errors, slow responses, UI glitches)
- Be EFFICIENT: Generate actionable test cases with clear steps
- SAVE NOTES: Use add_note() to remember important observations for future iterations

WHEN TO COMPLETE:
Output "EXPLORATION_COMPLETE" when:
- All discovered pages have been explored
- No new pages can be found
- You've generated sufficient test coverage

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
