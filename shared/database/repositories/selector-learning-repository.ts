import { query, transaction } from '../connection';
import { ElementSelector, ElementDescription } from '../../types';
import { PoolClient } from 'pg';
import * as crypto from 'crypto';

export interface SelectorLearningEntity {
  id: string;
  test_case_id: string;
  step_id: string;
  target_description: any; // JSONB
  proven_selectors: any[]; // JSONB[]
  page_state_hash: string | null;
  success_count: number;
  last_used_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class SelectorLearningRepository {
  /**
   * Generate hash from HTML content for page state tracking
   */
  private generatePageStateHash(html: string): string {
    // Use first 1000 chars of HTML structure (without content) for hashing
    const structure = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/>[^<]+</g, '><') // Remove text content
      .substring(0, 1000);

    return crypto.createHash('sha256').update(structure).digest('hex').substring(0, 64);
  }

  /**
   * Find proven selectors for a test case step
   */
  async findByStep(testCaseId: string, stepId: string): Promise<SelectorLearningEntity | null> {
    const result = await query<SelectorLearningEntity>(
      'SELECT * FROM selector_learning WHERE test_case_id = $1 AND step_id = $2 ORDER BY success_count DESC, last_used_at DESC LIMIT 1',
      [testCaseId, stepId]
    );

    return result[0] || null;
  }

  /**
   * Find proven selectors by page state hash (for similar pages)
   */
  async findByPageState(pageStateHash: string, targetDescription: ElementDescription): Promise<SelectorLearningEntity[]> {
    const targetJson = JSON.stringify(targetDescription);
    const result = await query<SelectorLearningEntity>(
      `SELECT * FROM selector_learning 
       WHERE page_state_hash = $1 
       AND target_description::text LIKE $2
       ORDER BY success_count DESC, last_used_at DESC
       LIMIT 5`,
      [pageStateHash, `%${targetJson.substring(0, 50)}%`]
    );

    return result;
  }

  /**
   * Save or update proven selector
   */
  async saveProvenSelector(
    testCaseId: string,
    stepId: string,
    targetDescription: ElementDescription,
    provenSelector: ElementSelector,
    html?: string
  ): Promise<SelectorLearningEntity> {
    return await transaction(async (client) => {
      // Check if learning record exists
      const existing = await client.query<SelectorLearningEntity>(
        'SELECT * FROM selector_learning WHERE test_case_id = $1 AND step_id = $2',
        [testCaseId, stepId]
      );

      const pageStateHash = html ? this.generatePageStateHash(html) : null;
      const targetJson = JSON.stringify(targetDescription);
      const selectorJson = JSON.stringify(provenSelector);

      if (existing.rows.length > 0) {
        // Update existing record
        const existingSelectors = existing.rows[0].proven_selectors || [];
        const selectorKey = `${provenSelector.type}:${provenSelector.value}`;

        // Check if this selector already exists
        const selectorExists = existingSelectors.some((sel: any) =>
          sel.type === provenSelector.type && sel.value === provenSelector.value
        );

        if (selectorExists) {
          // Increment success count for existing selector
          const updatedSelectors = existingSelectors.map((sel: any) => {
            if (sel.type === provenSelector.type && sel.value === provenSelector.value) {
              return { ...sel, success_count: (sel.success_count || 1) + 1 };
            }
            return sel;
          });

          const result = await client.query<SelectorLearningEntity>(
            `UPDATE selector_learning 
             SET proven_selectors = $1, 
                 success_count = success_count + 1,
                 last_used_at = NOW(),
                 page_state_hash = COALESCE($2, page_state_hash)
             WHERE test_case_id = $3 AND step_id = $4
             RETURNING *`,
            [JSON.stringify(updatedSelectors), pageStateHash, testCaseId, stepId]
          );
          return result.rows[0];
        } else {
          // Add new selector to proven list
          const updatedSelectors = [...existingSelectors, provenSelector];
          const result = await client.query<SelectorLearningEntity>(
            `UPDATE selector_learning 
             SET proven_selectors = $1, 
                 success_count = success_count + 1,
                 last_used_at = NOW(),
                 page_state_hash = COALESCE($2, page_state_hash)
             WHERE test_case_id = $3 AND step_id = $4
             RETURNING *`,
            [JSON.stringify(updatedSelectors), pageStateHash, testCaseId, stepId]
          );
          return result.rows[0];
        }
      } else {
        // Create new record
        const result = await client.query<SelectorLearningEntity>(
          `INSERT INTO selector_learning 
           (test_case_id, step_id, target_description, proven_selectors, page_state_hash, success_count, last_used_at)
           VALUES ($1, $2, $3, $4, $5, 1, NOW())
           RETURNING *`,
          [testCaseId, stepId, targetJson, JSON.stringify([provenSelector]), pageStateHash]
        );
        return result.rows[0];
      }
    });
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(id: string): Promise<void> {
    await query(
      'UPDATE selector_learning SET last_used_at = NOW() WHERE id = $1',
      [id]
    );
  }

  /**
   * Delete old learning records (cleanup)
   */
  async deleteOldRecords(olderThanDays: number = 90): Promise<number> {
    const result = await query(
      `DELETE FROM selector_learning 
       WHERE last_used_at < NOW() - INTERVAL '${olderThanDays} days'`,
      []
    );
    return result.length;
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
    return await transaction(async (client) => {
      const existing = await client.query<SelectorLearningEntity>(
        'SELECT * FROM selector_learning WHERE test_case_id = $1 AND step_id = $2',
        [testCaseId, stepId]
      );

      if (existing.rows.length > 0) {
        const existingSelectors = existing.rows[0].proven_selectors || [];
        const selectorKey = `${selector.type}:${selector.value}`;
        
        const updatedSelectors = existingSelectors.map((sel: any) => {
          if (sel.type === selector.type && sel.value === selector.value) {
            const successCount = (sel.success_count || 0) + (success ? 1 : 0);
            const failureCount = (sel.failure_count || 0) + (success ? 0 : 1);
            const totalAttempts = successCount + failureCount;
            const successRate = totalAttempts > 0 ? successCount / totalAttempts : 0;
            
            return {
              ...sel,
              success_count: successCount,
              failure_count: failureCount,
              success_rate: successRate,
              last_attempted_at: new Date().toISOString()
            };
          }
          return sel;
        });

        // Check if selector exists, if not add it
        const selectorExists = updatedSelectors.some((sel: any) =>
          sel.type === selector.type && sel.value === selector.value
        );

        if (!selectorExists) {
          // Add new selector with initial stats
          updatedSelectors.push({
            ...selector,
            success_count: success ? 1 : 0,
            failure_count: success ? 0 : 1,
            success_rate: success ? 1.0 : 0.0,
            last_attempted_at: new Date().toISOString()
          });
        }

        await client.query(
          `UPDATE selector_learning 
           SET proven_selectors = $1, 
               last_attempted_at = NOW(),
               updated_at = NOW()
           WHERE test_case_id = $2 AND step_id = $3`,
          [JSON.stringify(updatedSelectors), testCaseId, stepId]
        );
      } else {
        // Create new record for tracking
        const initialSelector = {
          ...selector,
          success_count: success ? 1 : 0,
          failure_count: success ? 0 : 1,
          success_rate: success ? 1.0 : 0.0,
          last_attempted_at: new Date().toISOString()
        };

        await client.query(
          `INSERT INTO selector_learning 
           (test_case_id, step_id, target_description, proven_selectors, success_count, last_used_at, last_attempted_at)
           VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
           RETURNING *`,
          [testCaseId, stepId, JSON.stringify({}), JSON.stringify([initialSelector])]
        );
      }
    });
  }

  /**
   * Get selectors with success rate above threshold
   */
  async getHighConfidenceSelectors(
    testCaseId: string,
    stepId: string,
    minSuccessRate: number = 0.8
  ): Promise<ElementSelector[]> {
    const learning = await this.findByStep(testCaseId, stepId);
    if (!learning || !learning.proven_selectors) {
      return [];
    }

    return learning.proven_selectors
      .filter((sel: any) => {
        const successCount = sel.success_count || 0;
        const failureCount = sel.failure_count || 0;
        const totalAttempts = successCount + failureCount;
        
        if (totalAttempts === 0) {
          // If no attempts tracked, use success_count from old format
          return (sel.success_count || 0) > 0;
        }
        
        const successRate = successCount / totalAttempts;
        return successRate >= minSuccessRate;
      })
      .sort((a: any, b: any) => {
        const rateA = a.success_rate || ((a.success_count || 0) / ((a.success_count || 0) + (a.failure_count || 0)) || 0);
        const rateB = b.success_rate || ((b.success_count || 0) / ((b.success_count || 0) + (b.failure_count || 0)) || 0);
        return rateB - rateA;
      })
      .map((sel: any) => ({
        type: sel.type,
        value: sel.value,
        stability_score: sel.stability_score || 0.8,
        confidence: sel.success_rate || ((sel.success_count || 0) / ((sel.success_count || 0) + (sel.failure_count || 0)) || 0)
      })) as ElementSelector[];
  }
}














