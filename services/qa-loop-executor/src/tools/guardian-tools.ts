import { createLogger } from '../../../shared/logger/logger';
import {
  GuardianAgent,
  QualityScore,
  IterationPlan,
  LoopDecision,
  QAReport,
  BudgetStatus
} from '../agents/guardian-agent';
import { QALoopRepository } from '../repositories/qa-loop-repository';

const logger = createLogger('guardian-tools');

export class GuardianTools {
  private sessionId: string;
  private repository: QALoopRepository;
  private guardianAgent: GuardianAgent;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.repository = new QALoopRepository();
    this.guardianAgent = new GuardianAgent(sessionId);
  }

  /**
   * Calculate current quality score
   */
  async calculateQualityScore(): Promise<{
    success: boolean;
    score?: QualityScore;
    error?: string
  }> {
    try {
      logger.info('Calculating quality score', { sessionId: this.sessionId });

      const score = await this.guardianAgent.calculateQualityScore();

      return { success: true, score };

    } catch (error: any) {
      logger.error('Failed to calculate quality score', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Plan the next iteration based on current quality
   */
  async planNextIteration(params: {
    currentScore?: number;
    forceArea?: 'explore' | 'chaos' | 'retest' | 'investigate';
  }): Promise<{ success: boolean; plan?: IterationPlan; error?: string }> {
    try {
      logger.info('Planning next iteration', { sessionId: this.sessionId, params });

      // Get current quality score if not provided
      let score: QualityScore;
      if (params.currentScore !== undefined) {
        // Create a minimal score object
        score = await this.guardianAgent.calculateQualityScore();
      } else {
        score = await this.guardianAgent.calculateQualityScore();
      }

      // If force area is specified, modify the plan
      let plan = await this.guardianAgent.planNextIteration(score);

      if (params.forceArea) {
        plan = { ...plan, focusArea: params.forceArea };
      }

      return { success: true, plan };

    } catch (error: any) {
      logger.error('Failed to plan iteration', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Decide if the loop should continue
   */
  async shouldContinue(params: {
    threshold: number;
    maxIterations: number;
    currentIteration: number;
  }): Promise<{ success: boolean; decision?: LoopDecision; error?: string }> {
    try {
      logger.info('Evaluating continue decision', { sessionId: this.sessionId, params });

      const score = await this.guardianAgent.calculateQualityScore();
      const decision = this.guardianAgent.shouldContinue(score, params);

      return { success: true, decision };

    } catch (error: any) {
      logger.error('Failed to evaluate continue', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate comprehensive QA report
   */
  async generateReport(params?: {
    includeDetails?: boolean;
    format?: 'full' | 'summary' | 'executive';
  }): Promise<{ success: boolean; report?: QAReport; error?: string }> {
    try {
      logger.info('Generating QA report', { sessionId: this.sessionId, params });

      const report = await this.guardianAgent.generateReport();

      return { success: true, report };

    } catch (error: any) {
      logger.error('Failed to generate report', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current budget status
   */
  async getBudgetStatus(): Promise<{
    success: boolean;
    budget?: BudgetStatus;
    error?: string
  }> {
    try {
      logger.info('Getting budget status', { sessionId: this.sessionId });

      const budget = this.guardianAgent.getBudgetStatus();

      return { success: true, budget };

    } catch (error: any) {
      logger.error('Failed to get budget status', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Set budget limits for the session
   */
  async setBudgetLimits(params: {
    maxTokens?: number;
    maxCostCents?: number;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Setting budget limits', { sessionId: this.sessionId, params });

      this.guardianAgent.setBudgetLimits(params.maxTokens, params.maxCostCents);

      return { success: true };

    } catch (error: any) {
      logger.error('Failed to set budget limits', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Track token usage
   */
  async trackUsage(params: {
    phase: 'exploration' | 'chaos' | 'detective' | 'guardian' | 'retest';
    tokens: number;
    costCents: number;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      this.guardianAgent.trackTokenUsage(params.phase, params.tokens, params.costCents);
      return { success: true };

    } catch (error: any) {
      logger.error('Failed to track usage', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get recommendations for improving quality
   */
  async getRecommendations(): Promise<{
    success: boolean;
    recommendations?: string[];
    error?: string
  }> {
    try {
      logger.info('Getting recommendations', { sessionId: this.sessionId });

      const score = await this.guardianAgent.calculateQualityScore();
      const report = await this.guardianAgent.generateReport();

      return { success: true, recommendations: report.recommendations };

    } catch (error: any) {
      logger.error('Failed to get recommendations', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get quality trend over iterations
   */
  async getQualityTrend(params?: {
    limit?: number;
  }): Promise<{
    success: boolean;
    trend?: Array<{ iteration: number; score: number; timestamp: string }>;
    error?: string;
  }> {
    try {
      logger.info('Getting quality trend', { sessionId: this.sessionId });

      // This would query qa_loop_quality_scores table
      // For now return mock trend data
      const trend = [
        { iteration: 1, score: 30, timestamp: new Date(Date.now() - 3600000).toISOString() },
        { iteration: 2, score: 45, timestamp: new Date(Date.now() - 2700000).toISOString() },
        { iteration: 3, score: 52, timestamp: new Date(Date.now() - 1800000).toISOString() },
        { iteration: 4, score: 58, timestamp: new Date(Date.now() - 900000).toISOString() },
        { iteration: 5, score: 65, timestamp: new Date().toISOString() }
      ];

      return { success: true, trend };

    } catch (error: any) {
      logger.error('Failed to get quality trend', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  getAgent(): GuardianAgent {
    return this.guardianAgent;
  }
}

// Tool definitions for Claude
export const GUARDIAN_TOOL_DEFINITIONS = [
  {
    name: 'calculate_quality_score',
    description: 'Calculate the current overall quality score and breakdown by category (coverage, stability, security, accessibility, performance).',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'plan_next_iteration',
    description: 'Plan what to focus on in the next iteration based on current quality metrics.',
    input_schema: {
      type: 'object' as const,
      properties: {
        currentScore: {
          type: 'number',
          description: 'Current quality score if known'
        },
        forceArea: {
          type: 'string',
          enum: ['explore', 'chaos', 'retest', 'investigate'],
          description: 'Force focus on a specific area regardless of quality metrics'
        }
      },
      required: []
    }
  },
  {
    name: 'should_continue',
    description: 'Determine if the QA loop should continue running based on quality threshold, iteration count, and risk factors.',
    input_schema: {
      type: 'object' as const,
      properties: {
        threshold: {
          type: 'number',
          description: 'Quality score threshold to reach (0-100)'
        },
        maxIterations: {
          type: 'number',
          description: 'Maximum number of iterations allowed'
        },
        currentIteration: {
          type: 'number',
          description: 'Current iteration number'
        }
      },
      required: ['threshold', 'maxIterations', 'currentIteration']
    }
  },
  {
    name: 'generate_report',
    description: 'Generate a comprehensive QA report with all findings, metrics, and recommendations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        includeDetails: {
          type: 'boolean',
          description: 'Include detailed findings and evidence'
        },
        format: {
          type: 'string',
          enum: ['full', 'summary', 'executive'],
          description: 'Report format'
        }
      },
      required: []
    }
  },
  {
    name: 'get_budget_status',
    description: 'Get current token usage and cost tracking status.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'set_budget_limits',
    description: 'Set maximum token or cost limits for the session.',
    input_schema: {
      type: 'object' as const,
      properties: {
        maxTokens: {
          type: 'number',
          description: 'Maximum tokens allowed'
        },
        maxCostCents: {
          type: 'number',
          description: 'Maximum cost in cents allowed'
        }
      },
      required: []
    }
  },
  {
    name: 'get_recommendations',
    description: 'Get prioritized recommendations for improving quality.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'get_quality_trend',
    description: 'Get quality score trend over recent iterations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Number of iterations to include in trend'
        }
      },
      required: []
    }
  }
];
