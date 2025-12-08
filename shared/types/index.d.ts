export declare enum ActionType {
    NAVIGATE = "navigate",
    CLICK = "click",
    TYPE = "type",
    FILL = "fill",
    SELECT = "select",
    WAIT = "wait",
    ASSERT = "assert",
    SCROLL = "scroll",
    HOVER = "hover"
}
export interface ElementDescription {
    text?: string;
    role?: string;
    label?: string;
    placeholder?: string;
    position?: string;
    attributes?: Record<string, string>;
}
export interface TestStep {
    id: string;
    action: ActionType;
    target?: ElementDescription;
    value?: string;
    expected_outcome?: string;
    wait_time?: number;
    description: string;
}
export interface TestCase {
    id: string;
    name: string;
    description: string;
    steps: TestStep[];
    website_url: string;
    metadata?: Record<string, any>;
}
export interface UserStory {
    story: string;
    website_url: string;
    additional_context?: string;
}
export interface ExecutionResult {
    execution_id: string;
    test_case_id: string;
    status: 'running' | 'completed' | 'failed' | 'timeout';
    steps: StepResult[];
    total_duration_ms: number;
    screenshots: string[];
    error?: string;
    started_at: string;
    completed_at?: string;
}
export interface StepResult {
    step_id: string;
    success: boolean;
    error?: string;
    screenshot_path?: string;
    execution_time_ms: number;
    element_found?: boolean;
    selector_used?: ElementSelector;
}
export interface ElementSelector {
    type: 'data-testid' | 'id' | 'class' | 'text' | 'xpath' | 'css' | 'aria-label' | 'visual';
    value: string;
    stability_score: number;
    confidence?: number;
}
//# sourceMappingURL=index.d.ts.map