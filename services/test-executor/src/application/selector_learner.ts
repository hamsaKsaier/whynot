import { SelectorLearningRepository } from '../../shared/database/repositories/selector-learning-repository';
import { ElementSelector, ElementDescription } from '../domain/models';

export class SelectorLearner {
  private repository: SelectorLearningRepository;

  constructor() {
    this.repository = new SelectorLearningRepository();
  }

  /**
   * Load proven selectors for a test case step
   */
  async loadProvenSelectors(testCaseId: string, stepId: string): Promise<ElementSelector[]> {
    try {
      const learning = await this.repository.findByStep(testCaseId, stepId);
      if (learning && learning.proven_selectors && learning.proven_selectors.length > 0) {
        // Update last used timestamp
        await this.repository.updateLastUsed(learning.id);

        // Convert to ElementSelector format and sort by success count (if available)
        return learning.proven_selectors.map((sel: any) => ({
          type: sel.type,
          value: sel.value,
          stability_score: sel.stability_score || 0.8, // Default high score for proven selectors
          confidence: sel.success_count || 1
        })) as ElementSelector[];
      }
      return [];
    } catch (error) {
      console.warn('Failed to load proven selectors:', error);
      return [];
    }
  }

  /**
   * Save a proven selector after successful execution
   */
  async saveProvenSelector(
    testCaseId: string,
    stepId: string,
    targetDescription: ElementDescription,
    provenSelector: ElementSelector,
    html?: string
  ): Promise<void> {
    try {
      await this.repository.saveProvenSelector(
        testCaseId,
        stepId,
        targetDescription,
        provenSelector,
        html
      );
    } catch (error) {
      console.warn('Failed to save proven selector:', error);
      // Don't throw - learning is optional, shouldn't break execution
    }
  }

  /**
   * Find similar proven selectors by page state
   */
  async findSimilarSelectors(
    pageStateHash: string,
    targetDescription: ElementDescription
  ): Promise<ElementSelector[]> {
    try {
      const learningRecords = await this.repository.findByPageState(pageStateHash, targetDescription);
      const selectors: ElementSelector[] = [];

      for (const record of learningRecords) {
        if (record.proven_selectors) {
          selectors.push(...(record.proven_selectors as ElementSelector[]));
        }
      }

      // Remove duplicates and sort by confidence
      const unique = new Map<string, ElementSelector>();
      for (const sel of selectors) {
        const key = `${sel.type}:${sel.value}`;
        if (!unique.has(key) || (sel.confidence || 0) > (unique.get(key)?.confidence || 0)) {
          unique.set(key, sel);
        }
      }

      return Array.from(unique.values()).sort((a, b) =>
        (b.confidence || 0) - (a.confidence || 0)
      );
    } catch (error) {
      console.warn('Failed to find similar selectors:', error);
      return [];
    }
  }

  /**
   * Track selector attempt (success or failure)
   */
  async trackSelectorAttempt(
    testCaseId: string,
    stepId: string,
    selector: ElementSelector,
    success: boolean
  ): Promise<void> {
    try {
      await this.repository.trackSelectorAttempt(testCaseId, stepId, selector, success);
    } catch (error) {
      console.warn('Failed to track selector attempt:', error);
      // Don't throw - tracking is optional, shouldn't break execution
    }
  }
}














