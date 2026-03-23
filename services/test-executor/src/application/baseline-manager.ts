import * as fs from 'fs';
import * as path from 'path';
import { VisualRegressionRepository, VisualBaselineEntity } from '../../shared/database/repositories/visual-regression-repository';
import { VisualComparator } from './visual-comparator';
import { VisualBaseline } from '../../shared/types';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('baseline-manager');

export class BaselineManager {
  private repository: VisualRegressionRepository;
  private visualComparator: VisualComparator;
  private autoBaseline: boolean;

  constructor(
    repository?: VisualRegressionRepository,
    visualComparator?: VisualComparator
  ) {
    this.repository = repository || new VisualRegressionRepository();
    this.visualComparator = visualComparator || new VisualComparator();
    this.autoBaseline = process.env.VISUAL_REGRESSION_AUTO_BASELINE !== 'false';
  }

  /**
   * Check if baseline exists for a test case and step
   */
  async hasBaseline(testCaseId: string, stepId: string): Promise<boolean> {
    const baseline = await this.repository.getLatestBaseline(testCaseId, stepId);
    return baseline !== null;
  }

  /**
   * Get the latest baseline for a test case and step
   */
  async getBaseline(testCaseId: string, stepId: string): Promise<VisualBaseline | null> {
    const baseline = await this.repository.getLatestBaseline(testCaseId, stepId);
    if (!baseline) {
      return null;
    }

    return this.mapEntityToBaseline(baseline);
  }

  /**
   * Get baseline history for a test case and step
   */
  async getBaselineHistory(testCaseId: string, stepId: string): Promise<VisualBaseline[]> {
    const baselines = await this.repository.getBaselineHistory(testCaseId, stepId);
    return baselines.map((b: VisualBaselineEntity) => this.mapEntityToBaseline(b));
  }

  /**
   * Get all baselines for a test case
   */
  async getBaselinesByTestCase(testCaseId: string): Promise<VisualBaseline[]> {
    const baselines = await this.repository.getBaselinesByTestCase(testCaseId);
    return baselines.map((b: VisualBaselineEntity) => this.mapEntityToBaseline(b));
  }

  /**
   * Create a new baseline
   */
  async createBaseline(
    testCaseId: string,
    stepId: string,
    screenshotPath: string,
    executionId: string
  ): Promise<VisualBaseline> {
    // Verify screenshot file exists
    if (!fs.existsSync(screenshotPath)) {
      throw new Error(`Screenshot file not found: ${screenshotPath}`);
    }

    // Calculate screenshot hash
    const screenshotHash = VisualComparator.calculateScreenshotHash(screenshotPath);

    // Check if baseline exists and is locked
    const existingBaseline = await this.repository.getLatestBaseline(testCaseId, stepId);
    if (existingBaseline && existingBaseline.is_locked) {
      throw new Error('Cannot create baseline: existing baseline is locked');
    }

    // Create new baseline
    try {
      const baseline = await this.repository.createBaseline({
        test_case_id: testCaseId,
        step_id: stepId,
        screenshot_path: screenshotPath,
        screenshot_hash: screenshotHash,
        execution_id: executionId,
        is_locked: false,
        created_by: 'system'
      });

      logger.info('Baseline created', {
        baselineId: baseline.id,
        testCaseId,
        stepId,
        version: baseline.baseline_version
      });

      return this.mapEntityToBaseline(baseline);
    } catch (err: any) {
      logger.warn('Visual baseline save failed (non-critical)', { error: err.message, testCaseId, stepId });
      throw err; // re-throw so caller's catch handles it
    }
  }

  /**
   * Update an existing baseline
   */
  async updateBaseline(
    baselineId: string,
    screenshotPath: string,
    executionId: string
  ): Promise<VisualBaseline> {
    // Verify screenshot file exists
    if (!fs.existsSync(screenshotPath)) {
      throw new Error(`Screenshot file not found: ${screenshotPath}`);
    }

    // Check if baseline is locked
    const existingBaseline = await this.repository.getBaselineById(baselineId);
    if (!existingBaseline) {
      throw new Error(`Baseline not found: ${baselineId}`);
    }
    if (existingBaseline.is_locked) {
      throw new Error('Cannot update baseline: baseline is locked');
    }

    // Calculate new screenshot hash
    const screenshotHash = VisualComparator.calculateScreenshotHash(screenshotPath);

    // Update baseline (this will create a new version)
    const baseline = await this.createBaseline(
      existingBaseline.test_case_id,
      existingBaseline.step_id,
      screenshotPath,
      executionId
    );

    logger.info('Baseline updated', { 
      baselineId: baseline.id, 
      oldBaselineId: baselineId,
      version: baseline.baseline_version 
    });

    return baseline;
  }

  /**
   * Lock a baseline to prevent automatic updates
   */
  async lockBaseline(baselineId: string): Promise<void> {
    const success = await this.repository.setBaselineLock(baselineId, true);
    if (!success) {
      throw new Error(`Failed to lock baseline: ${baselineId}`);
    }
    logger.info('Baseline locked', { baselineId });
  }

  /**
   * Unlock a baseline to allow automatic updates
   */
  async unlockBaseline(baselineId: string): Promise<void> {
    const success = await this.repository.setBaselineLock(baselineId, false);
    if (!success) {
      throw new Error(`Failed to unlock baseline: ${baselineId}`);
    }
    logger.info('Baseline unlocked', { baselineId });
  }

  /**
   * Promote an execution's screenshots as baselines (auto-baseline on success)
   */
  async promoteExecutionAsBaseline(
    testCaseId: string,
    executionId: string,
    stepScreenshots: Array<{ stepId: string; screenshotPath: string }>
  ): Promise<VisualBaseline[]> {
    if (!this.autoBaseline) {
      logger.debug('Auto-baseline disabled, skipping promotion', { testCaseId, executionId });
      return [];
    }

    const stepScreenshotsWithHash = stepScreenshots.map(({ stepId, screenshotPath }) => {
      if (!fs.existsSync(screenshotPath)) {
        logger.warn('Screenshot file not found, skipping', { stepId, screenshotPath });
        return null;
      }

      const screenshotHash = VisualComparator.calculateScreenshotHash(screenshotPath);
      return { stepId, screenshotPath, screenshotHash };
    }).filter((item): item is { stepId: string; screenshotPath: string; screenshotHash: string } => item !== null);

    if (stepScreenshotsWithHash.length === 0) {
      logger.warn('No valid screenshots to promote as baseline', { testCaseId, executionId });
      return [];
    }

    try {
      const createdBaselines = await this.repository.promoteExecutionAsBaseline(
        testCaseId,
        executionId,
        stepScreenshotsWithHash
      );

      logger.info('Execution promoted as baseline', {
        testCaseId,
        executionId,
        baselineCount: createdBaselines.length
      });

      return createdBaselines.map((b: VisualBaselineEntity) => this.mapEntityToBaseline(b));
    } catch (err: any) {
      logger.warn('Visual baseline save failed (non-critical)', { error: err.message, testCaseId, executionId });
      return [];
    }
  }

  /**
   * Map database entity to domain model
   */
  private mapEntityToBaseline(entity: VisualBaselineEntity): VisualBaseline {
    return {
      id: entity.id,
      test_case_id: entity.test_case_id,
      step_id: entity.step_id,
      screenshot_path: entity.screenshot_path,
      screenshot_hash: entity.screenshot_hash,
      baseline_version: entity.baseline_version,
      execution_id: entity.execution_id || undefined,
      is_locked: entity.is_locked,
      created_at: entity.created_at.toISOString(),
      created_by: entity.created_by
    };
  }
}
