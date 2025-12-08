import { ExecutionResult } from '../../types';
export interface ExecutionEntity {
    id: string;
    test_case_id: string;
    status: string;
    started_at: Date;
    completed_at: Date | null;
    total_duration_ms: number | null;
    error: string | null;
    screenshots: string[] | null;
    created_at: Date;
}
export interface StepResultEntity {
    id: string;
    execution_id: string;
    step_id: string;
    success: boolean;
    execution_time_ms: number;
    error: string | null;
    screenshot_path: string | null;
    element_found: boolean | null;
    selector_used: any | null;
    created_at: Date;
}
export declare class ExecutionRepository {
    /**
     * Create a new execution
     */
    create(execution: ExecutionResult): Promise<ExecutionEntity>;
    /**
     * Find execution by ID
     */
    findById(id: string): Promise<ExecutionEntity | null>;
    /**
     * Find step results for an execution
     */
    findStepResults(executionId: string): Promise<StepResultEntity[]>;
    /**
     * Find executions by test case ID
     */
    findByTestCaseId(testCaseId: string, limit?: number): Promise<ExecutionEntity[]>;
    /**
     * List all executions with pagination
     */
    list(offset?: number, limit?: number): Promise<ExecutionEntity[]>;
    /**
     * Get execution with step results
     */
    findByIdWithSteps(id: string): Promise<{
        execution: ExecutionEntity;
        steps: StepResultEntity[];
    } | null>;
    /**
     * Update execution status
     */
    updateStatus(id: string, status: string, completedAt?: Date, error?: string): Promise<ExecutionEntity | null>;
}
//# sourceMappingURL=execution-repository.d.ts.map