import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../../../shared/logger/logger';
import { QALoopRepository, QALoopTestCase, QALoopBug } from '../repositories/qa-loop-repository';
import { emitToSession } from '../api/websocket';

const logger = createLogger('detective-agent');

export interface TestFailure {
  id: string;
  testCaseId: string;
  testCaseName: string;
  failedStepIndex: number;
  failureReason: string;
  failureType: string;
  pageUrl?: string;
  screenshot?: string;
  consoleErrors?: string[];
  networkErrors?: any[];
  domSnapshot?: string;
  timestamp: Date;
}

export interface TestHistory {
  testCaseId: string;
  totalRuns: number;
  passCount: number;
  failCount: number;
  recentResults: Array<{ status: string; timestamp: Date }>;
  avgDurationMs: number;
  durationVariance: number;
}

export interface RootCauseAnalysis {
  failureId: string;
  category: 'bug' | 'flaky' | 'environment' | 'test_issue' | 'data_issue';
  subCategory?: string;
  confidence: number;
  rootCause: string;
  hypothesis: string;
  explanation?: string;
  suspectedFile?: string;
  suspectedLine?: number;
  suspectedFunction?: string;
  relatedCode?: string;
  evidence: {
    consoleErrors: string[];
    networkIssues: any[];
    timingAnalysis?: any;
    domState?: any;
  };
  minimalSteps: string[];
  environmentFactors: string[];
  fixSuggestion?: string;
  preventionSuggestion?: string;
  testImprovement?: string;
}

export interface CorrelationReport {
  failureIds: string[];
  correlationType: 'same_root_cause' | 'same_component' | 'same_timing' | 'cascading';
  sharedRootCause?: string;
  sharedComponent?: string;
  patternDescription: string;
  confidence: number;
  failureCount: number;
  occurrenceRate?: number;
}

export interface StabilityClassification {
  testCaseId: string;
  isFlaky: boolean;
  flakyConfidence: number;
  flakyPattern?: 'random' | 'time_dependent' | 'order_dependent' | 'resource_dependent';
  passRate: number;
  recommendation: string;
}

export interface MinimalRepro {
  originalStepsCount: number;
  minimalStepsCount: number;
  steps: string[];
  preconditions: string[];
  environmentFactors: string[];
}

export class DetectiveAgent {
  private sessionId: string;
  private repository: QALoopRepository;
  private client: Anthropic;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.repository = new QALoopRepository();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      logger.warn('ANTHROPIC_API_KEY not set, detective agent AI features disabled');
      this.client = null as any;
    }
  }

  /**
   * Analyze a single test failure
   */
  async analyzeFailure(failure: TestFailure): Promise<RootCauseAnalysis> {
    logger.info('Analyzing failure', {
      sessionId: this.sessionId,
      failureId: failure.id,
      testCaseName: failure.testCaseName
    });

    emitToSession(this.sessionId, {
      type: 'progress',
      data: {
        phase: 'detective',
        message: `Analyzing failure: ${failure.testCaseName}`
      }
    });

    // Get test history for this test case
    const history = await this.getTestHistory(failure.testCaseId);

    // Check for obvious patterns first
    const quickAnalysis = this.quickAnalysis(failure, history);
    if (quickAnalysis.confidence > 0.8) {
      return quickAnalysis;
    }

    // Use AI for deeper analysis if available
    if (this.client) {
      return this.aiAnalyzeFailure(failure, history);
    }

    return quickAnalysis;
  }

  /**
   * Quick pattern-based analysis
   */
  private quickAnalysis(failure: TestFailure, history: TestHistory): RootCauseAnalysis {
    const consoleErrors = failure.consoleErrors || [];
    const networkErrors = failure.networkErrors || [];

    // Check for flaky test
    if (history.totalRuns > 5 && history.passCount > 0 && history.failCount > 0) {
      const passRate = history.passCount / history.totalRuns;
      if (passRate > 0.3 && passRate < 0.9) {
        return {
          failureId: failure.id,
          category: 'flaky',
          confidence: 0.75,
          rootCause: 'Test appears to be flaky based on historical pass/fail ratio',
          hypothesis: `Test passes ${Math.round(passRate * 100)}% of the time, suggesting intermittent issues`,
          evidence: { consoleErrors, networkIssues: networkErrors },
          minimalSteps: [],
          environmentFactors: ['Timing', 'Race conditions'],
          testImprovement: 'Add explicit waits or make assertions more resilient'
        };
      }
    }

    // Check for selector issues
    if (failure.failureType === 'selector' ||
      failure.failureReason.toLowerCase().includes('element not found')) {
      return {
        failureId: failure.id,
        category: 'test_issue',
        subCategory: 'selector',
        confidence: 0.85,
        rootCause: 'Element selector no longer matches any element on the page',
        hypothesis: 'The UI may have changed, or the selector was too fragile',
        evidence: { consoleErrors, networkIssues: networkErrors },
        minimalSteps: [failure.failureReason],
        environmentFactors: [],
        fixSuggestion: 'Update the selector to match the new UI or use more robust selector strategies',
        testImprovement: 'Use data-testid attributes for more stable selectors'
      };
    }

    // Check for timeout issues
    if (failure.failureType === 'timeout' ||
      failure.failureReason.toLowerCase().includes('timeout')) {
      return {
        failureId: failure.id,
        category: 'environment',
        subCategory: 'timeout',
        confidence: 0.7,
        rootCause: 'Operation timed out before completing',
        hypothesis: 'The application may be slow or the timeout threshold is too low',
        evidence: { consoleErrors, networkIssues: networkErrors },
        minimalSteps: [],
        environmentFactors: ['Network latency', 'Server performance', 'Resource constraints'],
        fixSuggestion: 'Increase timeout thresholds or investigate application performance'
      };
    }

    // Check for network errors
    if (networkErrors.length > 0 ||
      failure.failureReason.toLowerCase().includes('network')) {
      return {
        failureId: failure.id,
        category: 'environment',
        subCategory: 'network',
        confidence: 0.75,
        rootCause: 'Network request failed',
        hypothesis: 'API endpoint may be down or returning errors',
        evidence: { consoleErrors, networkIssues: networkErrors },
        minimalSteps: [],
        environmentFactors: ['API availability', 'Network connectivity'],
        fixSuggestion: 'Check API health and add retry logic for network requests'
      };
    }

    // Check for assertion failures
    if (failure.failureType === 'assertion' ||
      failure.failureReason.toLowerCase().includes('expect')) {
      return {
        failureId: failure.id,
        category: 'bug',
        subCategory: 'assertion',
        confidence: 0.6,
        rootCause: 'Assertion failed - expected value did not match actual',
        hypothesis: 'Either the application behavior changed or the expected value is incorrect',
        evidence: { consoleErrors, networkIssues: networkErrors },
        minimalSteps: [failure.failureReason],
        environmentFactors: [],
        fixSuggestion: 'Verify expected behavior and update test or fix application bug'
      };
    }

    // Default analysis
    return {
      failureId: failure.id,
      category: 'bug',
      confidence: 0.4,
      rootCause: 'Unable to determine specific root cause',
      hypothesis: failure.failureReason,
      evidence: { consoleErrors, networkIssues: networkErrors },
      minimalSteps: [],
      environmentFactors: [],
      fixSuggestion: 'Manual investigation required'
    };
  }

  /**
   * AI-powered deep analysis
   */
  private async aiAnalyzeFailure(
    failure: TestFailure,
    history: TestHistory
  ): Promise<RootCauseAnalysis> {
    try {
      const prompt = this.buildAnalysisPrompt(failure, history);

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return this.parseAnalysisResponse(failure.id, text);

    } catch (error: any) {
      logger.error('AI analysis failed', { error: error.message });
      return this.quickAnalysis(failure, history);
    }
  }

  private buildAnalysisPrompt(failure: TestFailure, history: TestHistory): string {
    return `Analyze this test failure and provide root cause analysis.

TEST FAILURE:
- Test: ${failure.testCaseName}
- Failed step: ${failure.failedStepIndex}
- Error: ${failure.failureReason}
- Error type: ${failure.failureType}
- Page URL: ${failure.pageUrl || 'N/A'}
- Console errors: ${JSON.stringify(failure.consoleErrors || [])}
- Network errors: ${JSON.stringify(failure.networkErrors || [])}

TEST HISTORY:
- Total runs: ${history.totalRuns}
- Pass count: ${history.passCount}
- Fail count: ${history.failCount}
- Pass rate: ${history.totalRuns > 0 ? Math.round(history.passCount / history.totalRuns * 100) : 0}%
- Avg duration: ${history.avgDurationMs}ms
- Duration variance: ${history.durationVariance}

Analyze and respond in JSON format:
{
  "category": "bug|flaky|environment|test_issue|data_issue",
  "subCategory": "specific type",
  "confidence": 0.0-1.0,
  "rootCause": "description of root cause",
  "hypothesis": "explanation of what went wrong",
  "minimalSteps": ["step1", "step2"],
  "environmentFactors": ["factor1", "factor2"],
  "fixSuggestion": "how to fix",
  "testImprovement": "how to improve test"
}`;
  }

  private parseAnalysisResponse(failureId: string, response: string): RootCauseAnalysis {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          failureId,
          category: parsed.category || 'bug',
          subCategory: parsed.subCategory,
          confidence: parsed.confidence || 0.5,
          rootCause: parsed.rootCause || 'Unknown',
          hypothesis: parsed.hypothesis || '',
          evidence: { consoleErrors: [], networkIssues: [] },
          minimalSteps: parsed.minimalSteps || [],
          environmentFactors: parsed.environmentFactors || [],
          fixSuggestion: parsed.fixSuggestion,
          testImprovement: parsed.testImprovement
        };
      }
    } catch (e) {
      logger.warn('Failed to parse AI response', { error: e });
    }

    return {
      failureId,
      category: 'bug',
      confidence: 0.3,
      rootCause: 'AI analysis could not determine root cause',
      hypothesis: '',
      evidence: { consoleErrors: [], networkIssues: [] },
      minimalSteps: [],
      environmentFactors: []
    };
  }

  /**
   * Correlate multiple failures to find patterns
   */
  async correlateFailures(failures: TestFailure[]): Promise<CorrelationReport[]> {
    logger.info('Correlating failures', {
      sessionId: this.sessionId,
      failureCount: failures.length
    });

    const correlations: CorrelationReport[] = [];

    // Group by error message similarity
    const errorGroups = new Map<string, TestFailure[]>();
    for (const failure of failures) {
      const key = this.normalizeErrorMessage(failure.failureReason);
      if (!errorGroups.has(key)) {
        errorGroups.set(key, []);
      }
      errorGroups.get(key)!.push(failure);
    }

    // Create correlations for groups with multiple failures
    for (const [errorKey, group] of errorGroups) {
      if (group.length > 1) {
        correlations.push({
          failureIds: group.map(f => f.id),
          correlationType: 'same_root_cause',
          sharedRootCause: errorKey,
          patternDescription: `${group.length} failures with similar error: ${errorKey.substring(0, 100)}`,
          confidence: 0.8,
          failureCount: group.length
        });
      }
    }

    // Group by page URL
    const pageGroups = new Map<string, TestFailure[]>();
    for (const failure of failures) {
      if (failure.pageUrl) {
        const url = new URL(failure.pageUrl).pathname;
        if (!pageGroups.has(url)) {
          pageGroups.set(url, []);
        }
        pageGroups.get(url)!.push(failure);
      }
    }

    for (const [page, group] of pageGroups) {
      if (group.length > 1) {
        correlations.push({
          failureIds: group.map(f => f.id),
          correlationType: 'same_component',
          sharedComponent: page,
          patternDescription: `${group.length} failures on page: ${page}`,
          confidence: 0.7,
          failureCount: group.length
        });
      }
    }

    return correlations;
  }

  private normalizeErrorMessage(message: string): string {
    // Remove dynamic parts like IDs, timestamps, line numbers
    return message
      .replace(/\d+/g, 'N')
      .replace(/"[^"]+"/g, '"..."')
      .substring(0, 200);
  }

  /**
   * Classify test stability (flaky detection)
   */
  async classifyStability(
    testCaseId: string,
    history: TestHistory
  ): Promise<StabilityClassification> {
    const passRate = history.totalRuns > 0
      ? history.passCount / history.totalRuns
      : 0;

    let isFlaky = false;
    let flakyConfidence = 0;
    let flakyPattern: StabilityClassification['flakyPattern'] | undefined;
    let recommendation = '';

    // Determine flakiness
    if (history.totalRuns >= 5) {
      if (passRate > 0.1 && passRate < 0.9) {
        isFlaky = true;
        flakyConfidence = 1 - Math.abs(passRate - 0.5) * 2; // Highest confidence around 50% pass rate

        // Analyze pattern
        if (history.durationVariance > history.avgDurationMs * 0.5) {
          flakyPattern = 'time_dependent';
          recommendation = 'Add explicit waits or increase timeouts';
        } else {
          flakyPattern = 'random';
          recommendation = 'Investigate race conditions or external dependencies';
        }
      } else if (passRate >= 0.9) {
        recommendation = 'Test is stable';
      } else {
        recommendation = 'Test consistently fails - investigate root cause';
      }
    } else {
      recommendation = 'Not enough data for stability classification';
    }

    return {
      testCaseId,
      isFlaky,
      flakyConfidence,
      flakyPattern,
      passRate: passRate * 100,
      recommendation
    };
  }

  /**
   * Generate minimal reproduction steps
   */
  async minimizeReproduction(failure: TestFailure): Promise<MinimalRepro> {
    // Get the test case steps
    const testCases = await this.repository.getTestCases(this.sessionId);
    const testCase = testCases.find(tc => tc.id === failure.testCaseId);

    if (!testCase) {
      return {
        originalStepsCount: 0,
        minimalStepsCount: 0,
        steps: [failure.failureReason],
        preconditions: [],
        environmentFactors: []
      };
    }

    const originalSteps = testCase.steps || [];
    const failedStepIndex = failure.failedStepIndex;

    // Minimal repro is steps up to and including the failed step
    const minimalSteps = originalSteps.slice(0, failedStepIndex + 1).map((step: any) =>
      step.description || `${step.action}: ${step.target || ''}`
    );

    return {
      originalStepsCount: originalSteps.length,
      minimalStepsCount: minimalSteps.length,
      steps: minimalSteps,
      preconditions: [],
      environmentFactors: []
    };
  }

  /**
   * Get test history for a test case
   */
  private async getTestHistory(testCaseId: string): Promise<TestHistory> {
    // This would query the test_runs table for historical data
    // For now, return default values
    return {
      testCaseId,
      totalRuns: 0,
      passCount: 0,
      failCount: 0,
      recentResults: [],
      avgDurationMs: 0,
      durationVariance: 0
    };
  }

  /**
   * Save analysis result
   */
  async saveAnalysis(analysis: RootCauseAnalysis): Promise<void> {
    // Would save to qa_loop_root_cause_analysis table
    logger.info('Saving root cause analysis', {
      failureId: analysis.failureId,
      category: analysis.category,
      confidence: analysis.confidence
    });
  }
}
