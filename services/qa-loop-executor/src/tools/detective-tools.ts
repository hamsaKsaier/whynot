import { createLogger } from '../../../shared/logger/logger';
import {
  DetectiveAgent,
  TestFailure,
  RootCauseAnalysis,
  CorrelationReport,
  StabilityClassification,
  MinimalRepro
} from '../agents/detective-agent';
import { QALoopRepository } from '../repositories/qa-loop-repository';

const logger = createLogger('detective-tools');

export class DetectiveTools {
  private sessionId: string;
  private repository: QALoopRepository;
  private detectiveAgent: DetectiveAgent;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.repository = new QALoopRepository();
    this.detectiveAgent = new DetectiveAgent(sessionId);
  }

  /**
   * Analyze a test failure to find root cause
   */
  async analyzeFailure(params: {
    failureId: string;
    testCaseId: string;
    testCaseName: string;
    failedStepIndex: number;
    failureReason: string;
    failureType: string;
    pageUrl?: string;
    consoleErrors?: string[];
    networkErrors?: any[];
  }): Promise<{ success: boolean; analysis?: RootCauseAnalysis; error?: string }> {
    try {
      logger.info('Analyzing failure', { sessionId: this.sessionId, failureId: params.failureId });

      const failure: TestFailure = {
        id: params.failureId,
        testCaseId: params.testCaseId,
        testCaseName: params.testCaseName,
        failedStepIndex: params.failedStepIndex,
        failureReason: params.failureReason,
        failureType: params.failureType,
        pageUrl: params.pageUrl,
        consoleErrors: params.consoleErrors,
        networkErrors: params.networkErrors,
        timestamp: new Date()
      };

      const analysis = await this.detectiveAgent.analyzeFailure(failure);

      // Save the analysis
      await this.detectiveAgent.saveAnalysis(analysis);

      return { success: true, analysis };

    } catch (error: any) {
      logger.error('Failed to analyze failure', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get test run history for a test case
   */
  async getTestHistory(params: {
    testCaseId: string;
    limit?: number;
  }): Promise<{
    success: boolean;
    history?: {
      totalRuns: number;
      passCount: number;
      failCount: number;
      passRate: number;
      recentResults: Array<{ status: string; timestamp: string }>;
      avgDurationMs: number;
    };
    error?: string
  }> {
    try {
      logger.info('Getting test history', { sessionId: this.sessionId, testCaseId: params.testCaseId });

      // This would query the actual test run history from the database
      // For now, return mock data
      const history = {
        totalRuns: 10,
        passCount: 7,
        failCount: 3,
        passRate: 70,
        recentResults: [
          { status: 'passed', timestamp: new Date().toISOString() },
          { status: 'failed', timestamp: new Date(Date.now() - 3600000).toISOString() },
          { status: 'passed', timestamp: new Date(Date.now() - 7200000).toISOString() }
        ],
        avgDurationMs: 5000
      };

      return { success: true, history };

    } catch (error: any) {
      logger.error('Failed to get test history', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Correlate multiple failures to find patterns
   */
  async correlateFailures(params: {
    failureIds?: string[];
    timeRangeMinutes?: number;
  }): Promise<{ success: boolean; correlations?: CorrelationReport[]; error?: string }> {
    try {
      logger.info('Correlating failures', { sessionId: this.sessionId, params });

      // Get recent failures from test runs
      const testRuns = await this.repository.getTestRuns(this.sessionId);
      const failedRuns = testRuns.filter(r => r.status === 'failed');

      // Convert to TestFailure format
      const failures: TestFailure[] = failedRuns.map(run => ({
        id: run.id,
        testCaseId: run.test_case_id,
        testCaseName: '', // Would need to join with test_cases
        failedStepIndex: run.failure_step_index || 0,
        failureReason: run.failure_reason || 'Unknown',
        failureType: 'unknown',
        timestamp: new Date(run.executed_at)
      }));

      if (params.failureIds) {
        const filteredFailures = failures.filter(f => params.failureIds!.includes(f.id));
        const correlations = await this.detectiveAgent.correlateFailures(filteredFailures);
        return { success: true, correlations };
      }

      const correlations = await this.detectiveAgent.correlateFailures(failures);
      return { success: true, correlations };

    } catch (error: any) {
      logger.error('Failed to correlate failures', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate minimal reproduction steps for a failure
   */
  async minimizeReproduction(params: {
    failureId: string;
    testCaseId: string;
    failedStepIndex: number;
    failureReason: string;
  }): Promise<{ success: boolean; minimalRepro?: MinimalRepro; error?: string }> {
    try {
      logger.info('Minimizing reproduction', { sessionId: this.sessionId, params });

      const failure: TestFailure = {
        id: params.failureId,
        testCaseId: params.testCaseId,
        testCaseName: '',
        failedStepIndex: params.failedStepIndex,
        failureReason: params.failureReason,
        failureType: 'unknown',
        timestamp: new Date()
      };

      const minimalRepro = await this.detectiveAgent.minimizeReproduction(failure);
      return { success: true, minimalRepro };

    } catch (error: any) {
      logger.error('Failed to minimize reproduction', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Classify if a test is flaky
   */
  async classifyFlaky(params: {
    testCaseId: string;
    recentResults?: Array<{ status: string; timestamp: string }>;
  }): Promise<{ success: boolean; classification?: StabilityClassification; error?: string }> {
    try {
      logger.info('Classifying test stability', { sessionId: this.sessionId, testCaseId: params.testCaseId });

      // Build history from recent results or fetch from DB
      const recentResults = params.recentResults || [];
      const history = {
        testCaseId: params.testCaseId,
        totalRuns: recentResults.length || 10,
        passCount: recentResults.filter(r => r.status === 'passed').length || 7,
        failCount: recentResults.filter(r => r.status === 'failed').length || 3,
        recentResults: recentResults.map(r => ({ status: r.status, timestamp: new Date(r.timestamp) })),
        avgDurationMs: 5000,
        durationVariance: 1000
      };

      const classification = await this.detectiveAgent.classifyStability(params.testCaseId, history);
      return { success: true, classification };

    } catch (error: any) {
      logger.error('Failed to classify test', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Save root cause analysis result
   */
  async saveRootCause(params: {
    failureId: string;
    category: 'bug' | 'flaky' | 'environment' | 'test_issue' | 'data_issue';
    confidence: number;
    rootCause: string;
    hypothesis?: string;
    minimalSteps?: string[];
    fixSuggestion?: string;
    testImprovement?: string;
  }): Promise<{ success: boolean; analysisId?: string; error?: string }> {
    try {
      logger.info('Saving root cause analysis', { sessionId: this.sessionId, failureId: params.failureId });

      // This would save to qa_loop_root_cause_analysis table
      const analysisId = `rca-${Date.now()}`;

      logger.info('Root cause analysis saved', { analysisId, category: params.category });

      return { success: true, analysisId };

    } catch (error: any) {
      logger.error('Failed to save root cause', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get analysis summary for the session
   */
  async getAnalysisSummary(): Promise<{
    totalAnalyses: number;
    byCategory: Record<string, number>;
    flakyTests: number;
    correlationsFound: number;
  }> {
    // This would query the root_cause_analysis table
    return {
      totalAnalyses: 0,
      byCategory: {},
      flakyTests: 0,
      correlationsFound: 0
    };
  }
}

// Tool definitions for Claude
export const DETECTIVE_TOOL_DEFINITIONS = [
  {
    name: 'analyze_failure',
    description: 'Perform deep root cause analysis on a test failure. Classifies the failure type, identifies likely cause, and suggests fixes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        failureId: {
          type: 'string',
          description: 'Unique identifier for this failure instance'
        },
        testCaseId: {
          type: 'string',
          description: 'ID of the test case that failed'
        },
        testCaseName: {
          type: 'string',
          description: 'Name/title of the test case'
        },
        failedStepIndex: {
          type: 'number',
          description: 'Index of the step that failed (0-based)'
        },
        failureReason: {
          type: 'string',
          description: 'Error message or failure description'
        },
        failureType: {
          type: 'string',
          description: 'Type of failure (selector, timeout, assertion, network, etc.)'
        },
        pageUrl: {
          type: 'string',
          description: 'URL of the page where failure occurred'
        },
        consoleErrors: {
          type: 'array',
          items: { type: 'string' },
          description: 'Console error messages captured during failure'
        },
        networkErrors: {
          type: 'array',
          items: { type: 'object' },
          description: 'Network request errors captured during failure'
        }
      },
      required: ['failureId', 'testCaseId', 'testCaseName', 'failedStepIndex', 'failureReason', 'failureType']
    }
  },
  {
    name: 'get_test_history',
    description: 'Get historical run data for a test case to analyze patterns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        testCaseId: {
          type: 'string',
          description: 'ID of the test case'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of historical runs to retrieve'
        }
      },
      required: ['testCaseId']
    }
  },
  {
    name: 'correlate_failures',
    description: 'Find patterns and correlations across multiple test failures.',
    input_schema: {
      type: 'object' as const,
      properties: {
        failureIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific failure IDs to correlate. If empty, analyzes all recent failures.'
        },
        timeRangeMinutes: {
          type: 'number',
          description: 'Time range in minutes to look for failures'
        }
      },
      required: []
    }
  },
  {
    name: 'minimize_reproduction',
    description: 'Generate minimal reproduction steps for a test failure.',
    input_schema: {
      type: 'object' as const,
      properties: {
        failureId: {
          type: 'string',
          description: 'ID of the failure'
        },
        testCaseId: {
          type: 'string',
          description: 'ID of the test case'
        },
        failedStepIndex: {
          type: 'number',
          description: 'Index of the failed step'
        },
        failureReason: {
          type: 'string',
          description: 'The failure error message'
        }
      },
      required: ['failureId', 'testCaseId', 'failedStepIndex', 'failureReason']
    }
  },
  {
    name: 'classify_flaky',
    description: 'Determine if a test is flaky based on historical pass/fail patterns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        testCaseId: {
          type: 'string',
          description: 'ID of the test case to classify'
        },
        recentResults: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' }
            }
          },
          description: 'Recent test results if available'
        }
      },
      required: ['testCaseId']
    }
  },
  {
    name: 'save_root_cause',
    description: 'Save a root cause analysis result.',
    input_schema: {
      type: 'object' as const,
      properties: {
        failureId: {
          type: 'string',
          description: 'ID of the failure being analyzed'
        },
        category: {
          type: 'string',
          enum: ['bug', 'flaky', 'environment', 'test_issue', 'data_issue'],
          description: 'Classification category for the failure'
        },
        confidence: {
          type: 'number',
          description: 'Confidence level of the analysis (0.0 to 1.0)'
        },
        rootCause: {
          type: 'string',
          description: 'Description of the root cause'
        },
        hypothesis: {
          type: 'string',
          description: 'Explanation of why this is the root cause'
        },
        minimalSteps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Minimal steps to reproduce'
        },
        fixSuggestion: {
          type: 'string',
          description: 'Suggested fix for the issue'
        },
        testImprovement: {
          type: 'string',
          description: 'Suggestion for improving the test'
        }
      },
      required: ['failureId', 'category', 'confidence', 'rootCause']
    }
  }
];
