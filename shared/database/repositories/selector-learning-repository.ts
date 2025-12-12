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
}



