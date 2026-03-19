import { TestCase } from '../../types';
export interface TestCaseEntity {
    id: string;
    name: string;
    description: string | null;
    website_url: string;
    user_story: string;
    steps: any;
    metadata: any | null;
    created_at: Date;
    updated_at: Date;
}
export declare class TestCaseRepository {
    /**
     * Create a new test case
     */
    create(testCase: TestCase): Promise<TestCaseEntity>;
    /**
     * Find test case by ID
     */
    findById(id: string): Promise<TestCaseEntity | null>;
    /**
     * Find test cases by website URL
     */
    findByWebsiteUrl(websiteUrl: string, limit?: number): Promise<TestCaseEntity[]>;
    /**
     * List all test cases with pagination
     */
    list(offset?: number, limit?: number): Promise<TestCaseEntity[]>;
    /**
     * Update test case
     */
    update(id: string, updates: Partial<TestCase>): Promise<TestCaseEntity | null>;
    /**
     * Delete test case
     */
    delete(id: string): Promise<boolean>;
}
//# sourceMappingURL=test-case-repository.d.ts.map