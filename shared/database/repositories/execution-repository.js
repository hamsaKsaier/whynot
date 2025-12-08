"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionRepository = void 0;
const connection_1 = require("../connection");
class ExecutionRepository {
    /**
     * Create a new execution
     */
    async create(execution) {
        return await (0, connection_1.transaction)(async (client) => {
            // Insert execution
            const execResult = await client.query(`INSERT INTO executions (id, test_case_id, status, started_at, completed_at, total_duration_ms, error, screenshots)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`, [
                execution.execution_id,
                execution.test_case_id,
                execution.status,
                execution.started_at,
                execution.completed_at || null,
                execution.total_duration_ms,
                execution.error || null,
                execution.screenshots || []
            ]);
            // Insert step results
            if (execution.steps && execution.steps.length > 0) {
                for (const step of execution.steps) {
                    await client.query(`INSERT INTO step_results (execution_id, step_id, success, execution_time_ms, error, screenshot_path, element_found, selector_used)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                        execution.execution_id,
                        step.step_id,
                        step.success,
                        step.execution_time_ms,
                        step.error || null,
                        step.screenshot_path || null,
                        step.element_found ?? null,
                        step.selector_used ? JSON.stringify(step.selector_used) : null
                    ]);
                }
            }
            return execResult.rows[0];
        });
    }
    /**
     * Find execution by ID
     */
    async findById(id) {
        const result = await (0, connection_1.query)('SELECT * FROM executions WHERE id = $1', [id]);
        return result[0] || null;
    }
    /**
     * Find step results for an execution
     */
    async findStepResults(executionId) {
        return await (0, connection_1.query)('SELECT * FROM step_results WHERE execution_id = $1 ORDER BY created_at ASC', [executionId]);
    }
    /**
     * Find executions by test case ID
     */
    async findByTestCaseId(testCaseId, limit = 50) {
        return await (0, connection_1.query)('SELECT * FROM executions WHERE test_case_id = $1 ORDER BY started_at DESC LIMIT $2', [testCaseId, limit]);
    }
    /**
     * List all executions with pagination
     */
    async list(offset = 0, limit = 50) {
        return await (0, connection_1.query)('SELECT * FROM executions ORDER BY started_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    }
    /**
     * Get execution with step results
     */
    async findByIdWithSteps(id) {
        const execution = await this.findById(id);
        if (!execution) {
            return null;
        }
        const steps = await this.findStepResults(id);
        return { execution, steps };
    }
    /**
     * Update execution status
     */
    async updateStatus(id, status, completedAt, error) {
        const updates = [`status = $1`];
        const values = [status];
        let paramIndex = 2;
        if (completedAt) {
            updates.push(`completed_at = $${paramIndex++}`);
            values.push(completedAt);
        }
        if (error !== undefined) {
            updates.push(`error = $${paramIndex++}`);
            values.push(error);
        }
        values.push(id);
        const result = await (0, connection_1.query)(`UPDATE executions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values);
        return result[0] || null;
    }
}
exports.ExecutionRepository = ExecutionRepository;
//# sourceMappingURL=execution-repository.js.map