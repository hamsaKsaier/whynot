import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../../../shared/logger/logger';
import { QALoopRepository, QALoopTestCase, QALoopBug } from '../repositories/qa-loop-repository';
import { emitToSession } from '../api/websocket';
import { calculateCost, FOCUS_AREA_MODELS } from '../model-selector';

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
  private client: Anthropic | null = null;
  private clientInitialized = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.repository = new QALoopRepository();
  }

  /** Lazily initialize the Anthropic client using the platform key. */
  private async getClient(): Promise<Anthropic | null> {
    if (!this.clientInitialized) {
      this.clientInitialized = true;
      const { getPlatformKey } = await import('../platform-config');
      const apiKey = await getPlatformKey('anthropic');
      if (apiKey) {
        this.client = new Anthropic({ apiKey });
      } else {
        logger.warn('No Anthropic API key configured on platform, detective agent AI features disabled');
      }
    }
    return this.client;
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
    const client = await this.getClient();
    if (client) {
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

      const client = await this.getClient();
      if (!client) {
        return this.buildFallbackAnalysis(failure, history);
      }
      const DETECTIVE_MODEL = FOCUS_AREA_MODELS['investigate'];
      const response = await client.messages.create({
        model: DETECTIVE_MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      });

      // Track token usage through the frontend budget display (2.5)
      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      const cost = calculateCost(DETECTIVE_MODEL, inputTokens, outputTokens);
      emitToSession(this.sessionId, {
        type: 'progress',
        data: {
          phase: 'cost_update',
          model: DETECTIVE_MODEL,
          modelName: 'Claude Sonnet (Detective)',
          inputTokens,
          outputTokens,
          costCents: cost.costCents
        }
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
    const runs = await this.repository.getTestRunsForCase(testCaseId);
    const totalRuns = runs.length;
    const passCount = runs.filter((r: any) => r.status === 'passed').length;
    const failCount = runs.filter((r: any) => r.status === 'failed').length;
    const recentResults = runs.slice(0, 10).map((r: any) => ({
      status: r.status,
      timestamp: new Date(r.executed_at)
    }));
    const durations = runs
      .filter((r: any) => r.duration_ms != null)
      .map((r: any) => r.duration_ms as number);
    const avgDurationMs = durations.length > 0
      ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
      : 0;
    const durationVariance = durations.length > 1
      ? Math.sqrt(durations.reduce((sq: number, d: number) => sq + Math.pow(d - avgDurationMs, 2), 0) / durations.length)
      : 0;
    return { testCaseId, totalRuns, passCount, failCount, recentResults, avgDurationMs, durationVariance };
  }

  /**
   * Save analysis result
   */
  async saveAnalysis(analysis: RootCauseAnalysis): Promise<void> {
    logger.info('Saving root cause analysis', {
      failureId: analysis.failureId,
      category: analysis.category,
      confidence: analysis.confidence
    });
    await this.repository.saveRootCauseAnalysis(this.sessionId, analysis.failureId, {
      category: analysis.category,
      subCategory: analysis.subCategory,
      confidence: analysis.confidence,
      rootCause: analysis.rootCause,
      hypothesis: analysis.hypothesis,
      consoleErrors: analysis.evidence?.consoleErrors,
      networkIssues: analysis.evidence?.networkIssues,
      minimalSteps: analysis.minimalSteps,
      environmentFactors: analysis.environmentFactors,
      fixSuggestion: analysis.fixSuggestion,
      preventionSuggestion: analysis.preventionSuggestion,
      testImprovement: analysis.testImprovement
    });
  }
}
