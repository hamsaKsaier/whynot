/**
 * QA Lead Agent — the planner and reviewer.
 *
 * Phase 1 (Planning): Makes ONE AI call to analyze the target app and
 * produce a session plan with objectives for each agent.
 *
 * Phase 2 (Synthesis, Week 4): Reads all agent outputs after they finish,
 * cross-references findings, and produces a unified report.
 */
import { generateText, LanguageModel, CoreTool } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createLogger } from '../../../../shared/logger/logger';
import { AgentConfig, AppAnalysis, PlanObjective } from '../types';
import { AgentContextBuilder } from '../agent-context-builder';

const logger = createLogger('qa-lead');

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
  throw new Error('No AI API key configured');
}

export class QALeadAgent {
  private config: AgentConfig;
  private contextBuilder: AgentContextBuilder;

  constructor(config: AgentConfig) {
    this.config = config;
    this.contextBuilder = new AgentContextBuilder();
  }

  /**
   * Planning phase: one AI call to create the session plan.
   * Returns the plan data or null if it fails to parse.
   */
  async createPlan(): Promise<{
    app_analysis: AppAnalysis;
    objectives: PlanObjective[];
  } | null> {
    const { model, name: modelName } = selectModel();

    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      'qa_lead',
      this.config.targetUrl,
      null as any, // No plan yet — we're creating it
      this.config.projectContext,
      [], // No board entries yet
    );

    logger.info('QA Lead creating session plan', {
      sessionId: this.config.sessionId,
      model: modelName,
      targetUrl: this.config.targetUrl,
    });

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analyze ${this.config.targetUrl} and create a test plan. Respond with ONLY a JSON object containing app_analysis and objectives. No extra text.`,
          },
        ],
        maxTokens: 1024,
      });

      // Parse the JSON response
      const text = result.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('QA Lead response is not valid JSON', {
          sessionId: this.config.sessionId,
          response: text.slice(0, 200),
        });
        // Return a default plan
        return this.getDefaultPlan();
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!parsed.app_analysis || !parsed.objectives || !Array.isArray(parsed.objectives)) {
        logger.warn('QA Lead response missing required fields, using defaults', {
          sessionId: this.config.sessionId,
        });
        return this.getDefaultPlan();
      }

      // Ensure all required fields
      const appAnalysis: AppAnalysis = {
        app_type: parsed.app_analysis.app_type || 'web_app',
        critical_flows: parsed.app_analysis.critical_flows || ['login', 'main_page'],
        risk_areas: parsed.app_analysis.risk_areas || ['forms', 'auth'],
        total_pages_to_test: parsed.app_analysis.total_pages_to_test || 10,
      };

      // Validate objectives have correct structure
      const objectives: PlanObjective[] = parsed.objectives.map((o: any, idx: number) => ({
        id: o.id || idx + 1,
        agent: o.agent || 'exploratory',
        objective: o.objective || 'Explore and test',
        pages: o.pages || [],
        priority: o.priority || 'medium',
        depends_on: o.depends_on || [],
      }));

      logger.info('QA Lead plan parsed successfully', {
        sessionId: this.config.sessionId,
        appType: appAnalysis.app_type,
        objectiveCount: objectives.length,
      });

      return { app_analysis: appAnalysis, objectives };

    } catch (err: any) {
      logger.error('QA Lead plan creation failed', {
        sessionId: this.config.sessionId,
        error: err.message,
      });

      // Fall back to default plan
      return this.getDefaultPlan();
    }
  }

  /**
   * Default plan when AI call fails or returns invalid JSON.
   * Ensures the session can still proceed.
   */
  private getDefaultPlan(): {
    app_analysis: AppAnalysis;
    objectives: PlanObjective[];
  } {
    return {
      app_analysis: {
        app_type: 'web_app',
        critical_flows: ['login', 'navigation', 'main_features'],
        risk_areas: ['forms', 'authentication', 'data_display'],
        total_pages_to_test: 10,
      },
      objectives: [
        {
          id: 1,
          agent: 'exploratory',
          objective: `Explore all pages of ${this.config.targetUrl}, discover forms, links, and API endpoints`,
          pages: [],
          priority: 'critical',
          depends_on: [],
        },
        {
          id: 2,
          agent: 'security',
          objective: 'Test all discovered forms for XSS, SQLi, CSRF vulnerabilities',
          priority: 'high',
          depends_on: [1],
        },
        {
          id: 3,
          agent: 'api_tester',
          objective: 'Test all discovered API endpoints with edge cases',
          priority: 'high',
          depends_on: [1],
        },
        {
          id: 4,
          agent: 'auto_tester',
          objective: 'Write Playwright regression tests for all bugs found and critical flows',
          priority: 'medium',
          depends_on: [1, 2, 3],
        },
      ],
    };
  }
}
