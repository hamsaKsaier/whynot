import { ElementSelector, ElementDescription } from '../../types';
export interface SelectorLearningEntity {
    id: string;
    test_case_id: string;
    step_id: string;
    target_description: any;
    proven_selectors: any[];
    page_state_hash: string | null;
    success_count: number;
    last_used_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare class SelectorLearningRepository {
    /**
     * Generate hash from HTML content for page state tracking
     */
    private generatePageStateHash;
    /**
     * Find proven selectors for a test case step
     */
    findByStep(testCaseId: string, stepId: string): Promise<SelectorLearningEntity | null>;
    /**
     * Find proven selectors by page state hash (for similar pages)
     */
    findByPageState(pageStateHash: string, targetDescription: ElementDescription): Promise<SelectorLearningEntity[]>;
    /**
     * Save or update proven selector
     */
    saveProvenSelector(testCaseId: string, stepId: string, targetDescription: ElementDescription, provenSelector: ElementSelector, html?: string): Promise<SelectorLearningEntity>;
    /**
     * Update last used timestamp
     */
    updateLastUsed(id: string): Promise<void>;
    /**
     * Delete old learning records (cleanup)
     */
    deleteOldRecords(olderThanDays?: number): Promise<number>;
}
//# sourceMappingURL=selector-learning-repository.d.ts.map