import { StepResult, FailureAnalysis } from '../domain/models';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('failure-reporter');

export interface BugReport {
  execution_id: string;
  step_id: string;
  category: string;
  error: string;
  screenshot?: string;
  page_state?: any;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggested_fix?: string[];
}

export class FailureReporter {
  /**
   * Report application failures (bugs) to developers
   */
  async reportApplicationFailure(
    executionId: string,
    stepResult: StepResult,
    analysis: FailureAnalysis
  ): Promise<BugReport | null> {
    // Only report if it's NOT a system failure
    if (analysis.isSystemFailure) {
      logger.debug('Skipping bug report for system failure', {
        executionId,
        stepId: stepResult.step_id,
        category: analysis.category
      });
      return null;
    }

    // Create bug report
    const bugReport: BugReport = {
      execution_id: executionId,
      step_id: stepResult.step_id,
      category: analysis.category,
      error: stepResult.error || 'Unknown error',
      screenshot: stepResult.screenshot_path,
      page_state: stepResult.page_state,
      timestamp: new Date().toISOString(),
      severity: this.calculateSeverity(analysis),
      suggested_fix: analysis.suggestedActions
    };

    logger.info('Application failure detected - bug report created', {
      executionId,
      stepId: stepResult.step_id,
      category: analysis.category,
      severity: bugReport.severity
    });

    // TODO: Store in database or send to bug tracking system
    // For now, just log it
    // In the future, this could integrate with:
    // - Database (bug_reports table)
    // - Jira
    // - GitHub Issues
    // - Slack notifications

    return bugReport;
  }

  /**
   * Track system failures for improvement
   */
  async trackSystemFailure(
    stepResult: StepResult,
    analysis: FailureAnalysis
  ): Promise<void> {
    // Only track system failures
    if (!analysis.isSystemFailure) {
      return;
    }

    logger.info('System failure tracked for improvement', {
      stepId: stepResult.step_id,
      category: analysis.category,
      reason: analysis.reason,
      recoveryAttempted: analysis.recoveryAttempted,
      recoverySuccess: analysis.recoverySuccess
    });

    // TODO: Store in database for analytics
    // This helps:
    // - Identify common failure patterns
    // - Improve selector strategies
    // - Update selector learning
    // - Generate reports on system reliability
  }

  /**
   * Calculate severity based on failure category
   */
  private calculateSeverity(analysis: FailureAnalysis): 'low' | 'medium' | 'high' | 'critical' {
    switch (analysis.category) {
      case 'element_missing':
      case 'functional_bug':
        return 'high';
      
      case 'element_not_visible':
      case 'element_not_interactable':
        return 'medium';
      
      case 'assertion_failure':
        return 'medium';
      
      default:
        return 'low';
    }
  }
}






