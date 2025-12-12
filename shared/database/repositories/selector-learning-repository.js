"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectorLearningRepository = void 0;
const connection_1 = require("../connection");
const crypto = __importStar(require("crypto"));
class SelectorLearningRepository {
    /**
     * Generate hash from HTML content for page state tracking
     */
    generatePageStateHash(html) {
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
    async findByStep(testCaseId, stepId) {
        const result = await (0, connection_1.query)('SELECT * FROM selector_learning WHERE test_case_id = $1 AND step_id = $2 ORDER BY success_count DESC, last_used_at DESC LIMIT 1', [testCaseId, stepId]);
        return result[0] || null;
    }
    /**
     * Find proven selectors by page state hash (for similar pages)
     */
    async findByPageState(pageStateHash, targetDescription) {
        const targetJson = JSON.stringify(targetDescription);
        const result = await (0, connection_1.query)(`SELECT * FROM selector_learning 
       WHERE page_state_hash = $1 
       AND target_description::text LIKE $2
       ORDER BY success_count DESC, last_used_at DESC
       LIMIT 5`, [pageStateHash, `%${targetJson.substring(0, 50)}%`]);
        return result;
    }
    /**
     * Save or update proven selector
     */
    async saveProvenSelector(testCaseId, stepId, targetDescription, provenSelector, html) {
        return await (0, connection_1.transaction)(async (client) => {
            // Check if learning record exists
            const existing = await client.query('SELECT * FROM selector_learning WHERE test_case_id = $1 AND step_id = $2', [testCaseId, stepId]);
            const pageStateHash = html ? this.generatePageStateHash(html) : null;
            const targetJson = JSON.stringify(targetDescription);
            const selectorJson = JSON.stringify(provenSelector);
            if (existing.rows.length > 0) {
                // Update existing record
                const existingSelectors = existing.rows[0].proven_selectors || [];
                const selectorKey = `${provenSelector.type}:${provenSelector.value}`;
                // Check if this selector already exists
                const selectorExists = existingSelectors.some((sel) => sel.type === provenSelector.type && sel.value === provenSelector.value);
                if (selectorExists) {
                    // Increment success count for existing selector
                    const updatedSelectors = existingSelectors.map((sel) => {
                        if (sel.type === provenSelector.type && sel.value === provenSelector.value) {
                            return { ...sel, success_count: (sel.success_count || 1) + 1 };
                        }
                        return sel;
                    });
                    const result = await client.query(`UPDATE selector_learning 
             SET proven_selectors = $1, 
                 success_count = success_count + 1,
                 last_used_at = NOW(),
                 page_state_hash = COALESCE($2, page_state_hash)
             WHERE test_case_id = $3 AND step_id = $4
             RETURNING *`, [JSON.stringify(updatedSelectors), pageStateHash, testCaseId, stepId]);
                    return result.rows[0];
                }
                else {
                    // Add new selector to proven list
                    const updatedSelectors = [...existingSelectors, provenSelector];
                    const result = await client.query(`UPDATE selector_learning 
             SET proven_selectors = $1, 
                 success_count = success_count + 1,
                 last_used_at = NOW(),
                 page_state_hash = COALESCE($2, page_state_hash)
             WHERE test_case_id = $3 AND step_id = $4
             RETURNING *`, [JSON.stringify(updatedSelectors), pageStateHash, testCaseId, stepId]);
                    return result.rows[0];
                }
            }
            else {
                // Create new record
                const result = await client.query(`INSERT INTO selector_learning 
           (test_case_id, step_id, target_description, proven_selectors, page_state_hash, success_count, last_used_at)
           VALUES ($1, $2, $3, $4, $5, 1, NOW())
           RETURNING *`, [testCaseId, stepId, targetJson, JSON.stringify([provenSelector]), pageStateHash]);
                return result.rows[0];
            }
        });
    }
    /**
     * Update last used timestamp
     */
    async updateLastUsed(id) {
        await (0, connection_1.query)('UPDATE selector_learning SET last_used_at = NOW() WHERE id = $1', [id]);
    }
    /**
     * Delete old learning records (cleanup)
     */
    async deleteOldRecords(olderThanDays = 90) {
        const result = await (0, connection_1.query)(`DELETE FROM selector_learning 
       WHERE last_used_at < NOW() - INTERVAL '${olderThanDays} days'`, []);
        return result.length;
    }
}
exports.SelectorLearningRepository = SelectorLearningRepository;
//# sourceMappingURL=selector-learning-repository.js.map