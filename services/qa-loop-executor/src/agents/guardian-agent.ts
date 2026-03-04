// Anthropic import removed — GuardianAgent uses rule-based scoring only
// and never calls this.client; the SDK dependency was dead code (5.8).
import { createLogger } from '../../../shared/logger/logger';
import { QALoopRepository } from '../repositories/qa-loop-repository';
import { emitToSession } from '../api/websocket';
import { ChaosSummary } from './chaos-agent';

const logger = createLogger('guardian-agent');

export interface QualityScore {
  overall: number;  // 0-100
  breakdown: {
    coverage: number;      // % of app explored
    stability: number;     // % of tests passing consistently
    security: number;      // Vulnerabilities score (inverted)
    accessibility: number; // A11y compliance score
    performance: number;   // Load time, responsiveness
  };
  metrics: QualityMetrics;
  risks: RiskCounts;
  trend: 'improving' | 'stable' | 'declining';
  scoreDelta: number;
}

export interface QualityMetrics {
  pagesExplored: number;
  pagesTotal: number;
  testsGenerated: number;
  testsPassing: number;
  testsFailing: number;
  testsFlaky: number;
  bugsFound: number;
  bugsCritical: number;
  bugsHigh: number;
  vulnerabilitiesFound: number;
  a11yIssues: number;
  avgPageLoadMs: number;
}

export interface RiskCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface IterationPlan {
  focusArea: 'explore' | 'chaos' | 'retest' | 'investigate';
  targets: string[];
  priorityReasoning: string;
  riskAssessment: string;
  estimatedDurationMs: number;
  estimatedToolCalls: number;
}

export interface LoopDecision {
  shouldContinue: boolean;
  reason: string;
  nextFocus?: string;
  recommendation?: string;
}

export interface QAReport {
  sessionId: string;
  generatedAt: Date;
  totalIterations: number;
  totalDurationMs: number;
  finalQualityScore: number;

  coverageSummary: {
    pagesExplored: number;
    pagesTotal: number;
    coveragePercentage: number;
  };

  testSummary: {
    testsGenerated: number;
    testsPassed: number;
    testsFailed: number;
    testsFlaky: number;
    passRate: number;
  };

  bugSummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };

  securitySummary: {
    vulnerabilitiesFound: number;
    securityScore: number;
    issues: Array<{ type: string; severity: string; count: number }>;
  };

  accessibilitySummary: {
    issuesFound: number;
    score: number;
    wcagCompliance: Record<string, boolean>;
  };

  recommendations: string[];
  riskAssessment: string;
  nextSteps: string;

  executiveSummary: string;
}

export interface BudgetStatus {
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
  estimatedCostCents: number; // legacy alias
  maxTokens?: number;
  maxCostCents?: number;
  budgetExceeded: boolean;
  warningThresholdReached: boolean;
  currentAlertLevel: 'none' | 'info' | 'warning' | 'critical';
  alertPercentage: number;
  tokensByPhase: {
    exploration: number;
    chaos: number;
    detective: number;
    guardian: number;
    retest: number;
  };
  costByPhase: {
    exploration: number;
    chaos: number;
    detective: number;
    guardian: number;
    retest: number;
  };
  costByModel: {
    'claude-3-haiku-20240307': number;
    'claude-sonnet-4-20250514': number;
    'claude-3-opus-20240229': number;
  };
  tokensByModel: {
    'claude-3-haiku-20240307': number;
    'claude-sonnet-4-20250514': number;
    'claude-3-opus-20240229': number;
  };
}

// Quality score weights
const QUALITY_WEIGHTS = {
  coverage: 0.25,
  stability: 0.30,
  security: 0.20,
  accessibility: 0.15,
  performance: 0.10
};

export interface GuardianConfig {
  testPriority?: 'functional_first' | 'balanced' | 'security_first';
}

export class GuardianAgent {
  private sessionId: string;
  private repository: QALoopRepository;
  // NOTE: this.client was removed in 5.8 — GuardianAgent uses rule-based scoring
  // and never made Anthropic API calls; the field was dead code.
  private previousScore: QualityScore | null = null;
  private budgetTracking: BudgetStatus;
  private config: GuardianConfig;

  constructor(sessionId: string, config?: GuardianConfig) {
    this.sessionId = sessionId;
    this.repository = new QALoopRepository();
    this.config = config || {};

    this.budgetTracking = {
      totalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostCents: 0,
      estimatedCostCents: 0,
      budgetExceeded: false,
      warningThresholdReached: false,
      currentAlertLevel: 'none',
      alertPercentage: 0,
      tokensByPhase: {
        exploration: 0,
        chaos: 0,
        detective: 0,
        guardian: 0,
        retest: 0
      },
      costByPhase: {
        exploration: 0,
        chaos: 0,
        detective: 0,
        guardian: 0,
        retest: 0
      },
      costByModel: {
        'claude-3-haiku-20240307': 0,
        'claude-sonnet-4-20250514': 0,
        'claude-3-opus-20240229': 0
      },
      tokensByModel: {
        'claude-3-haiku-20240307': 0,
        'claude-sonnet-4-20250514': 0,
        'claude-3-opus-20240229': 0
      }
    };
  }

  /**
   * Calculate current quality score
   */
  async calculateQualityScore(): Promise<QualityScore> {
    logger.info('Calculating quality score', { sessionId: this.sessionId });

    // Gather metrics
    const session = await this.repository.getSession(this.sessionId);
    const pages = await this.repository.getPages(this.sessionId);
    const testCases = await this.repository.getTestCases(this.sessionId);
    const bugs = await this.repository.getBugs(this.sessionId);

    const exploredPages = pages.filter(p => p.is_explored).length;
    const totalPages = pages.length;

    // Calculate individual scores
    const coverageScore = totalPages > 0
      ? Math.round((exploredPages / totalPages) * 100)
      : 0;

    // Stability score based on test results (mock for now)
    const testsPassing = testCases.filter(tc => tc.last_run_status === 'passed').length;
    const stabilityScore = testCases.length > 0
      ? Math.round((testsPassing / testCases.length) * 100)
      : 100;

    // Security score (inverted - fewer vulnerabilities = higher score)
    const securityBugs = bugs.filter(b => b.category === 'security');
    const criticalSecurity = securityBugs.filter(b => b.severity === 'critical').length;
    const highSecurity = securityBugs.filter(b => b.severity === 'high').length;
    const securityScore = Math.max(0, 100 - (criticalSecurity * 25 + highSecurity * 15));

    // Accessibility score (mock)
    const a11yBugs = bugs.filter(b => b.category === 'accessibility');
    const accessibilityScore = Math.max(0, 100 - (a11yBugs.length * 10));

    // Performance score (mock)
    const performanceScore = 80; // Would calculate from actual metrics

    // Calculate overall score
    const overall = Math.round(
      coverageScore * QUALITY_WEIGHTS.coverage +
      stabilityScore * QUALITY_WEIGHTS.stability +
      securityScore * QUALITY_WEIGHTS.security +
      accessibilityScore * QUALITY_WEIGHTS.accessibility +
      performanceScore * QUALITY_WEIGHTS.performance
    );

    // Calculate risks
    const risks: RiskCounts = {
      critical: bugs.filter(b => b.severity === 'critical').length,
      high: bugs.filter(b => b.severity === 'high').length,
      medium: bugs.filter(b => b.severity === 'medium').length,
      low: bugs.filter(b => b.severity === 'low').length
    };

    // Calculate trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    let scoreDelta = 0;
    if (this.previousScore) {
      scoreDelta = overall - this.previousScore.overall;
      if (scoreDelta > 2) trend = 'improving';
      else if (scoreDelta < -2) trend = 'declining';
    }

    const qualityScore: QualityScore = {
      overall,
      breakdown: {
        coverage: coverageScore,
        stability: stabilityScore,
        security: securityScore,
        accessibility: accessibilityScore,
        performance: performanceScore
      },
      metrics: {
        pagesExplored: exploredPages,
        pagesTotal: totalPages,
        testsGenerated: testCases.length,
        testsPassing,
        testsFailing: testCases.length - testsPassing,
        testsFlaky: 0,
        bugsFound: bugs.length,
        bugsCritical: risks.critical,
        bugsHigh: risks.high,
        vulnerabilitiesFound: securityBugs.length,
        a11yIssues: a11yBugs.length,
        avgPageLoadMs: 0
      },
      risks,
      trend,
      scoreDelta
    };

    this.previousScore = qualityScore;

    // Emit to frontend
    emitToSession(this.sessionId, {
      type: 'progress',
      data: {
        phase: 'guardian',
        qualityScore: overall,
        breakdown: qualityScore.breakdown,
        trend
      }
    });

    return qualityScore;
  }

  /**
   * Decide if the loop should continue
   */
  shouldContinue(
    score: QualityScore,
    config: { threshold: number; maxIterations: number; currentIteration: number }
  ): LoopDecision {
    // Check quality threshold
    if (score.overall >= config.threshold) {
      return {
        shouldContinue: false,
        reason: 'quality_threshold_reached',
        recommendation: 'Quality threshold met. Consider running chaos testing for security validation.'
      };
    }

    // Check max iterations
    if (config.currentIteration >= config.maxIterations) {
      return {
        shouldContinue: false,
        reason: 'max_iterations_reached',
        recommendation: `Reached ${config.maxIterations} iterations. Quality score: ${score.overall}%`
      };
    }

    // Check for critical risks that need human review
    if (score.risks.critical > 3) {
      return {
        shouldContinue: false,
        reason: 'critical_risks_threshold',
        recommendation: 'Multiple critical issues found. Human review recommended before continuing.'
      };
    }

    // Check budget
    if (this.budgetTracking.budgetExceeded) {
      return {
        shouldContinue: false,
        reason: 'budget_exceeded',
        recommendation: 'Token/cost budget exceeded.'
      };
    }

    // Check for stagnation
    if (this.previousScore && score.trend === 'declining' && Math.abs(score.scoreDelta) < 1) {
      return {
        shouldContinue: true,
        reason: 'stagnating',
        nextFocus: 'investigate',
        recommendation: 'Quality score not improving. Switching to investigation mode.'
      };
    }

    return {
      shouldContinue: true,
      reason: 'continue',
      nextFocus: this.determineNextFocus(score)
    };
  }

  /**
   * Plan the next iteration
   */
  async planNextIteration(score: QualityScore): Promise<IterationPlan> {
    logger.info('Planning next iteration', {
      sessionId: this.sessionId,
      currentScore: score.overall
    });

    const focusArea = this.determineNextFocus(score);
    const targets = await this.selectTargets(focusArea, score);

    const plan: IterationPlan = {
      focusArea,
      targets,
      priorityReasoning: this.generatePriorityReasoning(focusArea, score),
      riskAssessment: this.generateRiskAssessment(score),
      estimatedDurationMs: this.estimateDuration(focusArea, targets.length),
      estimatedToolCalls: this.estimateToolCalls(focusArea, targets.length)
    };

    emitToSession(this.sessionId, {
      type: 'progress',
      data: {
        phase: 'guardian',
        plan: {
          focusArea: plan.focusArea,
          targetCount: plan.targets.length,
          reasoning: plan.priorityReasoning
        }
      }
    });

    return plan;
  }

  private determineNextFocus(score: QualityScore): IterationPlan['focusArea'] {
    const priority = this.config.testPriority || 'functional_first';

    // Functional First: Keep exploring until 70% coverage before switching to other modes
    if (priority === 'functional_first') {
      if (score.breakdown.coverage < 70) {
        return 'explore';
      }
      // After good coverage, proceed to normal logic
      if (score.breakdown.security < 70 && score.metrics.pagesExplored > 3) {
        return 'chaos';
      }
      if (score.breakdown.stability < 70) {
        return 'investigate';
      }
      if (score.metrics.testsFailing > 0) {
        return 'retest';
      }
      return 'explore';
    }

    // Security First: Allow chaos testing earlier (at 30% coverage)
    if (priority === 'security_first') {
      if (score.breakdown.coverage >= 30) {
        if (score.breakdown.security < 70 && score.metrics.pagesExplored > 2) {
          return 'chaos';
        }
      }
      if (score.breakdown.coverage < 50) {
        return 'explore';
      }
      if (score.breakdown.stability < 70) {
        return 'investigate';
      }
      if (score.metrics.testsFailing > 0) {
        return 'retest';
      }
      return 'chaos'; // Keep running security tests
    }

    // Balanced (original logic)
    if (score.breakdown.coverage < 50) {
      return 'explore';
    }

    // If we have untested pages and security is concerning, do chaos
    if (score.breakdown.security < 70 && score.metrics.pagesExplored > 5) {
      return 'chaos';
    }

    // If stability is low, investigate failures
    if (score.breakdown.stability < 70) {
      return 'investigate';
    }

    // If we have failing tests, retest
    if (score.metrics.testsFailing > 0) {
      return 'retest';
    }

    // Default to exploration
    return 'explore';
  }

  private async selectTargets(
    focusArea: IterationPlan['focusArea'],
    score: QualityScore
  ): Promise<string[]> {
    const pages = await this.repository.getPages(this.sessionId);

    switch (focusArea) {
      case 'explore':
        // Return unexplored pages
        return pages
          .filter(p => !p.is_explored)
          .slice(0, 5)
          .map(p => p.url);

      case 'chaos':
        // Return pages with forms/inputs
        return pages
          .filter(p => p.is_explored && p.discovered_elements?.inputs?.length > 0)
          .slice(0, 3)
          .map(p => p.url);

      case 'retest':
        // Return test case IDs that failed
        const testCases = await this.repository.getTestCases(this.sessionId);
        return testCases
          .filter(tc => tc.last_run_status === 'failed')
          .slice(0, 10)
          .map(tc => tc.id);

      case 'investigate':
        // Return bug IDs
        const bugs = await this.repository.getBugs(this.sessionId);
        return bugs
          .filter(b => b.status === 'open')
          .slice(0, 5)
          .map(b => b.id);

      default:
        return [];
    }
  }

  private generatePriorityReasoning(
    focusArea: IterationPlan['focusArea'],
    score: QualityScore
  ): string {
    switch (focusArea) {
      case 'explore':
        return `Coverage is at ${score.breakdown.coverage}%. Prioritizing exploration to discover more application functionality.`;
      case 'chaos':
        return `Security score is ${score.breakdown.security}%. Running adversarial testing to identify vulnerabilities.`;
      case 'retest':
        return `${score.metrics.testsFailing} tests failing. Re-running tests to verify fixes and identify flaky tests.`;
      case 'investigate':
        return `Stability at ${score.breakdown.stability}%. Investigating failures to identify root causes.`;
      default:
        return 'Continuing standard exploration.';
    }
  }

  private generateRiskAssessment(score: QualityScore): string {
    const riskLevel = score.risks.critical > 0 ? 'CRITICAL' :
      score.risks.high > 0 ? 'HIGH' :
        score.risks.medium > 0 ? 'MEDIUM' : 'LOW';

    return `Risk Level: ${riskLevel}. Critical: ${score.risks.critical}, High: ${score.risks.high}, Medium: ${score.risks.medium}, Low: ${score.risks.low}`;
  }

  private estimateDuration(focusArea: string, targetCount: number): number {
    const baseTime = {
      explore: 60000,
      chaos: 120000,
      retest: 30000,
      investigate: 45000
    };
    return (baseTime[focusArea as keyof typeof baseTime] || 60000) * targetCount;
  }

  private estimateToolCalls(focusArea: string, targetCount: number): number {
    const baseCalls = {
      explore: 10,
      chaos: 20,
      retest: 5,
      investigate: 8
    };
    return (baseCalls[focusArea as keyof typeof baseCalls] || 10) * targetCount;
  }

  /**
   * Generate final QA report
   */
  async generateReport(): Promise<QAReport> {
    logger.info('Generating QA report', { sessionId: this.sessionId });

    const session = await this.repository.getSession(this.sessionId);
    const score = await this.calculateQualityScore();
    const bugs = await this.repository.getBugs(this.sessionId);
    const testCases = await this.repository.getTestCases(this.sessionId);

    const securityBugs = bugs.filter(b => b.category === 'security');
    const a11yBugs = bugs.filter(b => b.category === 'accessibility');

    const report: QAReport = {
      sessionId: this.sessionId,
      generatedAt: new Date(),
      totalIterations: session?.iteration_count || 0,
      totalDurationMs: session?.started_at
        ? Date.now() - new Date(session.started_at).getTime()
        : 0,
      finalQualityScore: score.overall,

      coverageSummary: {
        pagesExplored: score.metrics.pagesExplored,
        pagesTotal: score.metrics.pagesTotal,
        coveragePercentage: score.breakdown.coverage
      },

      testSummary: {
        testsGenerated: testCases.length,
        testsPassed: score.metrics.testsPassing,
        testsFailed: score.metrics.testsFailing,
        testsFlaky: score.metrics.testsFlaky,
        passRate: testCases.length > 0
          ? Math.round((score.metrics.testsPassing / testCases.length) * 100)
          : 0
      },

      bugSummary: {
        total: bugs.length,
        critical: score.risks.critical,
        high: score.risks.high,
        medium: score.risks.medium,
        low: score.risks.low
      },

      securitySummary: {
        vulnerabilitiesFound: securityBugs.length,
        securityScore: score.breakdown.security,
        issues: this.groupBugsByType(securityBugs)
      },

      accessibilitySummary: {
        issuesFound: a11yBugs.length,
        score: score.breakdown.accessibility,
        wcagCompliance: {}
      },

      recommendations: this.generateRecommendations(score, bugs),
      riskAssessment: this.generateRiskAssessment(score),
      nextSteps: this.generateNextSteps(score),

      executiveSummary: this.generateExecutiveSummary(score, bugs, testCases)
    };

    // Emit report to frontend
    emitToSession(this.sessionId, {
      type: 'session_complete',
      data: {
        report: {
          qualityScore: report.finalQualityScore,
          testsGenerated: report.testSummary.testsGenerated,
          bugsFound: report.bugSummary.total,
          recommendations: report.recommendations
        }
      }
    });

    return report;
  }

  private groupBugsByType(bugs: any[]): Array<{ type: string; severity: string; count: number }> {
    const groups = new Map<string, { type: string; severity: string; count: number }>();

    for (const bug of bugs) {
      const key = `${bug.bug_type || 'unknown'}-${bug.severity}`;
      if (!groups.has(key)) {
        groups.set(key, { type: bug.bug_type || 'unknown', severity: bug.severity, count: 0 });
      }
      groups.get(key)!.count++;
    }

    return Array.from(groups.values());
  }

  private generateRecommendations(score: QualityScore, bugs: any[]): string[] {
    const recommendations: string[] = [];

    if (score.breakdown.coverage < 70) {
      recommendations.push('Increase test coverage - consider exploring more application features');
    }

    if (score.risks.critical > 0) {
      recommendations.push(`Address ${score.risks.critical} critical issues before deployment`);
    }

    if (score.breakdown.security < 80) {
      recommendations.push('Security vulnerabilities detected - review and fix security issues');
    }

    if (score.breakdown.accessibility < 80) {
      recommendations.push('Accessibility issues found - ensure WCAG compliance');
    }

    if (score.metrics.testsFlaky > 0) {
      recommendations.push(`${score.metrics.testsFlaky} flaky tests detected - stabilize before CI/CD integration`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Application appears stable. Consider adding more edge case tests.');
    }

    return recommendations;
  }

  private generateNextSteps(score: QualityScore): string {
    if (score.overall >= 90) {
      return 'Quality threshold met. Consider setting up continuous monitoring.';
    }
    if (score.overall >= 70) {
      return 'Good progress. Focus on addressing remaining issues and increasing coverage.';
    }
    return 'Significant issues remain. Prioritize critical and high severity bugs.';
  }

  private generateExecutiveSummary(
    score: QualityScore,
    bugs: any[],
    testCases: any[]
  ): string {
    return `QA Loop completed with a quality score of ${score.overall}%. ` +
      `Explored ${score.metrics.pagesExplored} pages and generated ${testCases.length} test cases. ` +
      `Found ${bugs.length} issues (${score.risks.critical} critical, ${score.risks.high} high). ` +
      `Security score: ${score.breakdown.security}%, Stability: ${score.breakdown.stability}%.`;
  }

  /**
   * Get current budget status
   */
  getBudgetStatus(): BudgetStatus {
    return { ...this.budgetTracking };
  }

  /**
   * Track token usage with enhanced model and phase tracking (Phase 8)
   */
  trackTokenUsage(
    phase: keyof BudgetStatus['tokensByPhase'],
    tokens: number,
    costCents: number,
    options?: {
      model?: keyof BudgetStatus['costByModel'];
      inputTokens?: number;
      outputTokens?: number;
    }
  ): void {
    // Update totals
    this.budgetTracking.totalTokens += tokens;
    this.budgetTracking.totalCostCents += costCents;
    this.budgetTracking.estimatedCostCents = this.budgetTracking.totalCostCents; // legacy alias

    // Update phase tracking
    this.budgetTracking.tokensByPhase[phase] += tokens;
    this.budgetTracking.costByPhase[phase] += costCents;

    // Update model tracking if specified
    if (options?.model) {
      this.budgetTracking.tokensByModel[options.model] += tokens;
      this.budgetTracking.costByModel[options.model] += costCents;
    }

    // Update input/output token tracking
    if (options?.inputTokens) {
      this.budgetTracking.totalInputTokens += options.inputTokens;
    }
    if (options?.outputTokens) {
      this.budgetTracking.totalOutputTokens += options.outputTokens;
    }

    // Calculate budget percentage and alert levels
    this.updateBudgetAlerts();

    logger.debug('Token usage tracked', {
      sessionId: this.sessionId,
      phase,
      tokens,
      costCents,
      totalCostCents: this.budgetTracking.totalCostCents,
      alertLevel: this.budgetTracking.currentAlertLevel
    });
  }

  /**
   * Update budget alerts based on current usage (Phase 8)
   */
  private updateBudgetAlerts(): void {
    let percentage = 0;

    // Calculate percentage based on cost limit (primary) or token limit (secondary)
    if (this.budgetTracking.maxCostCents) {
      percentage = (this.budgetTracking.totalCostCents / this.budgetTracking.maxCostCents) * 100;
    } else if (this.budgetTracking.maxTokens) {
      percentage = (this.budgetTracking.totalTokens / this.budgetTracking.maxTokens) * 100;
    }

    this.budgetTracking.alertPercentage = percentage;

    // Determine alert level
    if (percentage >= 100) {
      this.budgetTracking.currentAlertLevel = 'critical';
      this.budgetTracking.budgetExceeded = true;
    } else if (percentage >= 90) {
      this.budgetTracking.currentAlertLevel = 'critical';
      this.budgetTracking.warningThresholdReached = true;
    } else if (percentage >= 75) {
      this.budgetTracking.currentAlertLevel = 'warning';
      this.budgetTracking.warningThresholdReached = true;
    } else if (percentage >= 50) {
      this.budgetTracking.currentAlertLevel = 'info';
    } else {
      this.budgetTracking.currentAlertLevel = 'none';
    }

    // Emit budget alert event if threshold reached
    if (this.budgetTracking.currentAlertLevel !== 'none') {
      emitToSession(this.sessionId, {
        type: 'progress',
        data: {
          phase: 'budget_alert',
          alertLevel: this.budgetTracking.currentAlertLevel,
          percentage: Math.round(percentage),
          totalCostCents: this.budgetTracking.totalCostCents,
          maxCostCents: this.budgetTracking.maxCostCents,
          budgetExceeded: this.budgetTracking.budgetExceeded
        }
      });
    }
  }

  /**
   * Get formatted cost summary
   */
  getCostSummary(): {
    totalCostDollars: string;
    costByPhase: Record<string, string>;
    costByModel: Record<string, string>;
    budgetRemaining: string | null;
  } {
    const formatCost = (cents: number) => `$${(cents / 100).toFixed(4)}`;

    const costByPhase: Record<string, string> = {};
    for (const [phase, cost] of Object.entries(this.budgetTracking.costByPhase)) {
      if (cost > 0) {
        costByPhase[phase] = formatCost(cost);
      }
    }

    const costByModel: Record<string, string> = {};
    for (const [model, cost] of Object.entries(this.budgetTracking.costByModel)) {
      if (cost > 0) {
        // Use friendly model names
        const friendlyName = model === 'claude-3-haiku-20240307' ? 'Haiku' :
          model === 'claude-sonnet-4-20250514' ? 'Sonnet' : 'Opus';
        costByModel[friendlyName] = formatCost(cost);
      }
    }

    return {
      totalCostDollars: formatCost(this.budgetTracking.totalCostCents),
      costByPhase,
      costByModel,
      budgetRemaining: this.budgetTracking.maxCostCents
        ? formatCost(Math.max(0, this.budgetTracking.maxCostCents - this.budgetTracking.totalCostCents))
        : null
    };
  }

  /**
   * Set budget limits
   */
  setBudgetLimits(maxTokens?: number, maxCostCents?: number): void {
    this.budgetTracking.maxTokens = maxTokens;
    this.budgetTracking.maxCostCents = maxCostCents;
  }
}
