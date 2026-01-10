# Complete Test Generation and Execution Flow

This document explains the complete process from user input to test execution completion.

## High-Level Architecture

```
┌─────────────┐
│   Frontend  │ (React UI)
│  Port 5173  │
└──────┬──────┘
       │ HTTP POST
       ▼
┌─────────────────────────────────────────────────────────┐
│                    Gateway Service                       │
│                    Port 3000                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │         WorkflowOrchestrator                       │  │
│  │  - Coordinates entire workflow                     │  │
│  │  - Manages retries & circuit breakers             │  │
│  └──────────────────────────────────────────────────┘  │
└──────┬───────────────────────────────┬──────────────────┘
       │                               │
       │ HTTP                          │ HTTP
       ▼                               ▼
┌──────────────┐              ┌──────────────────┐
│ AI Service   │              │ Test Executor   │
│ Port 8000    │              │ Port 3001        │
│              │              │                  │
│ - Test Gen   │              │ - Browser Ctrl  │
│ - Vision AI  │              │ - Step Exec     │
│ - LLM Calls  │              │ - Element Find  │
└──────────────┘              └──────────────────┘
```

## Detailed Step-by-Step Process

### Phase 1: Request Reception & Validation

**Location:** `gateway/src/api/main.ts`

1. **User submits request** via Frontend or API
   ```
   POST /api/run-test
   {
     "website_url": "https://example.com",
     "user_story": "As a user, I want to login",
     "headless": true
   }
   ```

2. **Gateway receives request**
   - Rate limiting check (10 requests/hour for test execution)
   - Input validation (URL format, user story length)
   - Input sanitization (prevent XSS, SQL injection)
   - Request logging with unique ID

3. **WorkflowOrchestrator initialized**
   - Sets up circuit breakers for resilience
   - Configures retry logic with exponential backoff

---

### Phase 2: Page Content Capture (Optional but Recommended)

**Location:** `gateway/src/workflow/workflow-orchestrator.ts` → `capturePageContent()`

4. **Capture page content before test generation**
   ```
   Gateway → Test Executor: POST /api/capture-page
   {
     "website_url": "https://example.com"
   }
   ```

5. **Test Executor captures page**
   - Launches Playwright browser (headless)
   - Navigates to website
   - Captures HTML content
   - Takes screenshot (base64 encoded)
   - Returns: `{ html, screenshot_base64, url }`

6. **If capture fails:** Falls back to test generation without page context

---

### Phase 3: Test Case Generation

**Location:** `gateway/src/workflow/workflow-orchestrator.ts` → `generateTestCasesWithPageContext()`

7. **Gateway sends to AI Service**
   ```
   Gateway → AI Service: POST /api/generate-tests
   {
     "story": "As a user, I want to login",
     "website_url": "https://example.com",
     "screenshot_base64": "...",
     "html": "<html>..."
   }
   ```

8. **AI Service processes request**
   - **Location:** `services/ai-service/app/api/routes.py`
   - Creates `TestGenerator` instance
   - Optionally runs vision analysis on screenshot

9. **Test Generator creates prompt**
   - **Location:** `services/ai-service/app/application/test_generator.py`
   - Builds comprehensive prompt with:
     - User story
     - Website URL
     - HTML preview (first 5000 chars)
     - Vision analysis results (if available)
   - Includes instructions for:
     - Breaking down into testable scenarios
     - Creating atomic steps
     - Generating suggested selectors

10. **Claude Sonnet 4.5 generates test cases**
    - **Location:** `services/ai-service/app/infrastructure/llm/llm_client.py`
    - Uses `generate_json_with_vision()` method
    - Sends to Anthropic API:
      ```
      POST https://api.anthropic.com/v1/messages
      {
        "model": "claude-sonnet-4-5-20250929",
        "system": "You are an expert QA engineer...",
        "messages": [{
          "role": "user",
          "content": [
            {
              "type": "image",
              "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": "screenshot_base64..."
              }
            },
            {
              "type": "text",
              "text": "prompt with HTML and instructions..."
            }
          ]
        }]
      }
      ```

11. **Parse LLM response**
    - Extracts JSON from response
    - Parses test cases array
    - For each test case:
      - Creates unique test case ID
      - Parses steps with actions, targets, values
      - Extracts suggested selectors (if provided)
      - Adds metadata (user story, timestamp)

12. **Returns test cases to Gateway**
    ```json
    [
      {
        "id": "test-abc123",
        "name": "User can login successfully",
        "steps": [
          {
            "id": "step-001",
            "action": "navigate",
            "value": "https://example.com"
          },
          {
            "id": "step-002",
            "action": "click",
            "target": {"text": "Login", "role": "button"},
            "suggested_selectors": [
              {"type": "data-testid", "value": "[data-testid='login-btn']", "stability_score": 0.95},
              {"type": "text", "value": "button:has-text('Login')", "stability_score": 0.60}
            ]
          }
        ]
      }
    ]
    ```

13. **Gateway selects first test case** (for POC, uses first generated test)

---

### Phase 4: Test Execution

**Location:** `gateway/src/workflow/workflow-orchestrator.ts` → `executeTest()`

14. **Gateway sends test case to Test Executor**
    ```
    Gateway → Test Executor: POST /api/execute-test?headless=true
    {
      "id": "test-abc123",
      "name": "User can login successfully",
      "steps": [...]
    }
    ```

15. **Test Executor initializes**
    - **Location:** `services/test-executor/src/application/test-runner.ts`
    - Creates `TestRunner` instance
    - Initializes Playwright browser controller
    - Sets up hybrid selector (DOM + Vision)
    - Creates step executor
    - Generates execution ID

16. **Browser setup**
    - **Location:** `services/test-executor/src/infrastructure/browser/playwright-controller.ts`
    - Launches Chromium browser (headless or visible)
    - Creates new page
    - If not headless: Sets up browser streaming for live preview

17. **Navigate to website**
    - Navigates to `testCase.website_url`
    - Waits for page load
    - If streaming: Sends navigation event to WebSocket

---

### Phase 5: Step-by-Step Execution

**Location:** `services/test-executor/src/application/test-runner.ts` → `runTest()`

For each step in the test case:

18. **Step Executor processes step**
    - **Location:** `services/test-executor/src/application/step-executor.ts`
    - Determines action type (navigate, click, type, wait, assert, etc.)
    - Routes to appropriate handler

19. **Element Location (for interactive steps)**

    **Strategy 1: Try Claude's Suggested Selectors**
    - If step has `suggested_selectors` from test generation:
      - Tries each selector in order (by stability score)
      - Checks if element is visible
      - If found → uses it

    **Strategy 2: Hybrid Selector (DOM + Vision)**
    - If Claude's selectors fail or not available:
      - **Location:** `services/test-executor/src/infrastructure/selectors/hybrid-selector.ts`
      - Gets current page HTML
      - Takes screenshot
      - **DOM Analysis:**
        - Analyzes HTML structure
        - Looks for data-testid, IDs, aria-labels
        - Matches text content
        - Generates CSS selectors
      - **Vision Analysis (optional):**
        - Sends screenshot to AI Service
        - AI Service analyzes with Claude Vision
        - Returns element positions and text
      - **Combines and ranks selectors:**
        - Priority: data-testid (0.95) > ID (0.85) > aria-label (0.75) > stable class (0.65) > text (0.60) > unstable class (0.40) > visual (0.40) > xpath (0.30)
      - Tries selectors in order until one works

20. **Execute action based on step type**

    **Navigate:**
    - Navigates to URL from step.value
    - Waits for page load

    **Click:**
    - Locates element (using strategies above)
    - Clicks element
    - Waits for action to complete

    **Type/Fill:**
    - Locates input element
    - Clears existing value
    - Types step.value into element

    **Wait:**
    - Waits for specified time (default 1000ms)

    **Scroll:**
    - Scrolls to element (if target specified)
    - Or scrolls page

    **Hover:**
    - Locates element
    - Hovers over it

    **Assert:**
    - Locates element
    - Checks if visible
    - Verifies expected outcome

21. **Capture screenshot**
    - Takes screenshot after each step
    - Saves to `/app/screenshots/` directory
    - Returns path: `screenshot-step-001-1234567890.png`
    - If streaming: Sends screenshot to WebSocket

22. **Record step result**
    ```typescript
    {
      step_id: "step-001",
      success: true,
      error: undefined,
      screenshot_path: "screenshot-step-001-1234567890.png",
      execution_time_ms: 2345,
      element_found: true,
      selector_used: {
        type: "data-testid",
        value: "[data-testid='login-btn']",
        stability_score: 0.95
      }
    }
    ```

23. **Error handling**
    - If step fails:
      - Records error message
      - Captures screenshot for debugging
      - Marks test as "failed"
      - Stops execution (or continues based on config)

24. **Repeat for all steps**

---

### Phase 6: Completion & Results

25. **Test execution completes**
    - All steps executed (or failed)
    - Browser closed
    - If streaming: Sends final result via WebSocket

26. **Build execution result**
    ```typescript
    {
      execution_id: "exec-xyz789",
      test_case_id: "test-abc123",
      status: "completed" | "failed" | "timeout",
      steps: [/* all step results */],
      total_duration_ms: 12345,
      screenshots: ["screenshot-step-001-...", ...],
      error: undefined | "error message",
      started_at: "2025-12-08T10:00:00Z",
      completed_at: "2025-12-08T10:00:15Z"
    }
    ```

27. **Gateway receives result**
    - Persists to database (PostgreSQL)
    - Records metrics
    - Builds summary

28. **Response to user**
    ```json
    {
      "success": true,
      "test_case": { /* test case object */ },
      "execution_result": { /* execution result */ },
      "summary": {
        "test_name": "User can login successfully",
        "total_steps": 5,
        "passed_steps": 5,
        "failed_steps": 0,
        "status": "completed",
        "duration_ms": 12345
      }
    }
    ```

29. **Frontend displays results**
    - Shows test steps with status
    - Displays screenshots
    - Shows execution timeline
    - Highlights any failures

---

## Key Components Deep Dive

### 1. Element Detection Strategy

The system uses a **multi-layered approach**:

1. **Claude's Suggested Selectors** (from test generation)
   - Generated during test case creation
   - Based on actual page analysis
   - Pre-ranked by stability

2. **DOM Analyzer**
   - Parses HTML structure
   - Extracts attributes (data-testid, id, class, aria-label)
   - Intelligently detects stable vs unstable CSS classes
   - Stable classes (semantic names, BEM): score 0.65
   - Unstable classes (framework-generated): score 0.40
   - Matches text content
   - Generates CSS selectors

3. **Vision Analyzer**
   - Uses Claude Vision API
   - Analyzes screenshot
   - Identifies elements by visual position
   - Extracts text from images

4. **Hybrid Selector**
   - Combines DOM + Vision results
   - Ranks by stability score
   - Tries selectors in priority order

### 2. Resilience Features

- **Circuit Breakers:** Prevents cascading failures
- **Retry Logic:** Exponential backoff for transient errors
- **Timeout Handling:** Prevents hanging operations
- **Error Recovery:** Graceful degradation (e.g., fallback to non-context generation)

### 3. Live Preview (Non-Headless Mode)

- WebSocket connection for real-time updates
- Browser frame streaming
- Step-by-step progress updates
- Screenshot streaming

---

## Data Flow Diagram

```
User Input
    │
    ▼
Gateway (Validation, Rate Limiting)
    │
    ├─→ Test Executor (Page Capture)
    │       │
    │       └─→ Playwright Browser
    │               │
    │               └─→ HTML + Screenshot
    │
    ├─→ AI Service (Test Generation)
    │       │
    │       ├─→ Test Generator
    │       │       │
    │       │       └─→ LLM Client
    │       │               │
    │       │               └─→ Claude Sonnet 4.5 API
    │       │                       │
    │       │                       └─→ Test Cases JSON
    │       │
    │       └─→ Vision Analyzer (optional)
    │               │
    │               └─→ Claude Vision API
    │
    └─→ Test Executor (Execution)
            │
            ├─→ Test Runner
            │       │
            │       ├─→ Step Executor
            │       │       │
            │       │       ├─→ Hybrid Selector
            │       │       │       │
            │       │       │       ├─→ DOM Analyzer
            │       │       │       └─→ Vision Analyzer
            │       │       │
            │       │       └─→ Playwright Actions
            │       │
            │       └─→ Browser Controller
            │               │
            │               └─→ Playwright Browser
            │
            └─→ Execution Result
                    │
                    └─→ Database (PostgreSQL)
```

---

## Performance Characteristics

- **Test Generation:** 10-30 seconds (depends on LLM response time)
- **Page Capture:** 2-5 seconds
- **Test Execution:** 5-60 seconds (depends on number of steps and page complexity)
- **Total Workflow:** 20-90 seconds typically

---

## Error Scenarios & Handling

1. **Page Capture Fails:** Falls back to generation without context
2. **Test Generation Fails:** Returns error, suggests retry
3. **Element Not Found:** Tries multiple selectors, provides detailed error
4. **Browser Crash:** Captures error, returns partial results
5. **Network Timeout:** Retries with exponential backoff
6. **LLM API Error:** Circuit breaker opens, returns error after retries

---

This complete flow ensures robust, intelligent test automation from natural language user stories to executable test results.












