import { query, transaction } from '../connection';
import { TestCase } from '../../types';
import { PoolClient } from 'pg';

export interface TestCaseEntity {
  id: string;
  name: string;
  description: string | null;
  website_url: string;
  user_story: string;
  steps: any; // JSONB
  metadata: any | null; // JSONB
  created_at: Date;
  updated_at: Date;
}

export class TestCaseRepository {
  /**
   * Create a new test case
   */
  async create(testCase: TestCase): Promise<TestCaseEntity> {
    // Convert test case ID to UUID format if needed, or let database generate one
    let testCaseId = testCase.id;
    
    // If ID is not a valid UUID format, generate a new UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(testCaseId)) {
      // Import uuid dynamically to avoid issues
      const { v4: uuidv4 } = require('uuid');
      testCaseId = uuidv4();
    }
    
    const result = await query<TestCaseEntity>(
      `INSERT INTO test_cases (id, name, description, website_url, user_story, steps, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        testCaseId,
        testCase.name,
        testCase.description || null,
        testCase.website_url,
        JSON.stringify({ story: testCase.website_url }), // Store user story context
        JSON.stringify(testCase.steps),
        testCase.metadata ? JSON.stringify(testCase.metadata) : null
      ]
    );
    
    return result[0];
  }

  /**
   * Find test case by ID
   */
  async findById(id: string): Promise<TestCaseEntity | null> {
    const result = await query<TestCaseEntity>(
      'SELECT * FROM test_cases WHERE id = $1',
      [id]
    );
    
    return result[0] || null;
  }

  /**
   * Find test cases by website URL
   */
  async findByWebsiteUrl(websiteUrl: string, limit: number = 50): Promise<TestCaseEntity[]> {
    return await query<TestCaseEntity>(
      'SELECT * FROM test_cases WHERE website_url = $1 ORDER BY created_at DESC LIMIT $2',
      [websiteUrl, limit]
    );
  }

  /**
   * List all test cases with pagination
   */
  async list(offset: number = 0, limit: number = 50): Promise<TestCaseEntity[]> {
    return await query<TestCaseEntity>(
      'SELECT * FROM test_cases ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
  }

  /**
   * Update test case
   */
  async update(id: string, updates: Partial<TestCase>): Promise<TestCaseEntity | null> {
    const updatesList: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updatesList.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      updatesList.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.steps !== undefined) {
      updatesList.push(`steps = $${paramIndex++}`);
      values.push(JSON.stringify(updates.steps));
    }
    if (updates.metadata !== undefined) {
      updatesList.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (updatesList.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query<TestCaseEntity>(
      `UPDATE test_cases SET ${updatesList.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result[0] || null;
  }

  /**
   * Delete test case
   */
  async delete(id: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM test_cases WHERE id = $1',
      [id]
    );
    
    return true;
  }
}

