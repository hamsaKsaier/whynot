"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestCaseRepository = void 0;
const connection_1 = require("../connection");
class TestCaseRepository {
    /**
     * Create a new test case
     */
    async create(testCase) {
        // Convert test case ID to UUID format if needed, or let database generate one
        let testCaseId = testCase.id;
        // If ID is not a valid UUID format, generate a new UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(testCaseId)) {
            // Import uuid dynamically to avoid issues
            const { v4: uuidv4 } = require('uuid');
            testCaseId = uuidv4();
        }
        const result = await (0, connection_1.query)(`INSERT INTO test_cases (id, name, description, website_url, user_story, steps, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`, [
            testCaseId,
            testCase.name,
            testCase.description || null,
            testCase.website_url,
            JSON.stringify({ story: testCase.website_url }), // Store user story context
            JSON.stringify(testCase.steps),
            testCase.metadata ? JSON.stringify(testCase.metadata) : null
        ]);
        return result[0];
    }
    /**
     * Find test case by ID
     */
    async findById(id) {
        const result = await (0, connection_1.query)('SELECT * FROM test_cases WHERE id = $1', [id]);
        return result[0] || null;
    }
    /**
     * Find test cases by website URL
     */
    async findByWebsiteUrl(websiteUrl, limit = 50) {
        return await (0, connection_1.query)('SELECT * FROM test_cases WHERE website_url = $1 ORDER BY created_at DESC LIMIT $2', [websiteUrl, limit]);
    }
    /**
     * List all test cases with pagination
     */
    async list(offset = 0, limit = 50) {
        return await (0, connection_1.query)('SELECT * FROM test_cases ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    }
    /**
     * Update test case
     */
    async update(id, updates) {
        const updatesList = [];
        const values = [];
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
        const result = await (0, connection_1.query)(`UPDATE test_cases SET ${updatesList.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values);
        return result[0] || null;
    }
    /**
     * Delete test case
     */
    async delete(id) {
        const result = await (0, connection_1.query)('DELETE FROM test_cases WHERE id = $1', [id]);
        return true;
    }
}
exports.TestCaseRepository = TestCaseRepository;
//# sourceMappingURL=test-case-repository.js.map