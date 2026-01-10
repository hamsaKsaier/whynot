import { SelectorLearningRepository } from '../../shared/database/repositories/selector-learning-repository';
import { TestCase, TestStep, ElementSelector } from '../domain/models';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('selector-health-monitor');

export interface SelectorHealthReport {
  testCaseId: string;
  stepId: string;
  currentSelector: ElementSelector | null;
  healthScore: number; // 0-1, where 1 is perfect
  successRate: number;
  totalAttempts: number;
  recommendation: 'keep' | 'update' | 'replace';
  suggestedSelectors: ElementSelector[];
}

export class SelectorHealthMonitor {
  private repository: SelectorLearningRepository;

  constructor() {
    this.repository = new SelectorLearningRepository();
  }

  /**
   * Check health of all selectors in a test case
   */
  async checkTestCaseHealth(testCase: TestCase): Promise<SelectorHealthReport[]> {
    const reports: SelectorHealthReport[] = [];

    for (const step of testCase.steps) {
      if (step.suggested_selectors && step.suggested_selectors.length > 0) {
        const report = await this.checkStepHealth(testCase.id, step);
        if (report) {
          reports.push(report);
        }
      }
    }

    return reports;
  }

  /**
   * Check health of selectors for a specific step
   */
  async checkStepHealth(testCaseId: string, step: TestStep): Promise<SelectorHealthReport | null> {
    try {
      const highConfidenceSelectors = await this.repository.getHighConfidenceSelectors(
        testCaseId,
        step.id,
        0.7 // 70% success rate minimum
      );

      const currentSelector = step.suggested_selectors?.[0] || null;
      let healthScore = 1.0;
      let successRate = 1.0;
      let totalAttempts = 0;
      let recommendation: 'keep' | 'update' | 'replace' = 'keep';

      if (currentSelector) {
        // Get stats for current selector
        const learning = await this.repository.findByStep(testCaseId, step.id);
        if (learning && learning.proven_selectors) {
          const selectorStats = learning.proven_selectors.find(
            (sel: any) => sel.type === currentSelector.type && sel.value === currentSelector.value
          );

          if (selectorStats) {
            const success = selectorStats.success_count || 0;
            const failure = selectorStats.failure_count || 0;
            totalAttempts = success + failure;
            successRate = totalAttempts > 0 ? success / totalAttempts : 1.0;
            healthScore = successRate;

            // Determine recommendation
            if (successRate < 0.5) {
              recommendation = 'replace';
            } else if (successRate < 0.8) {
              recommendation = 'update';
            } else {
              recommendation = 'keep';
            }
          }
        }
      }

      // Find better selectors if current one is degrading
      const suggestedSelectors = highConfidenceSelectors.filter(
        sel => !currentSelector || 
        sel.type !== currentSelector.type || 
        sel.value !== currentSelector.value
      );

      return {
        testCaseId,
        stepId: step.id,
        currentSelector,
        healthScore,
        successRate,
        totalAttempts,
        recommendation,
        suggestedSelectors: suggestedSelectors.slice(0, 3)
      };
    } catch (error: any) {
      logger.warn('Failed to check step health', { error: error.message, testCaseId, stepId: step.id });
      return null;
    }
  }

  /**
   * Auto-update test case with better selectors
   */
  async autoUpdateTestCase(testCase: TestCase, minHealthScore: number = 0.8): Promise<TestCase | null> {
    const reports = await this.checkTestCaseHealth(testCase);
    const needsUpdate = reports.some(r => r.healthScore < minHealthScore);

    if (!needsUpdate) {
      return null; // No update needed
    }

    const updatedTestCase = { ...testCase };
    let updated = false;

    for (const report of reports) {
      if (report.recommendation === 'replace' || 
          (report.recommendation === 'update' && report.suggestedSelectors.length > 0)) {
        const step = updatedTestCase.steps.find(s => s.id === report.stepId);
        if (step && report.suggestedSelectors.length > 0) {
          // Replace with best proven selector
          step.suggested_selectors = [
            report.suggestedSelectors[0],
            ...(step.suggested_selectors || []).filter(
              sel => sel.type !== report.suggestedSelectors[0].type || 
                     sel.value !== report.suggestedSelectors[0].value
            )
          ];
          updated = true;
          logger.info('Auto-updated selector', {
            testCaseId: testCase.id,
            stepId: step.id,
            oldSelector: report.currentSelector,
            newSelector: report.suggestedSelectors[0]
          });
        }
      }
    }

    return updated ? updatedTestCase : null;
  }
}
