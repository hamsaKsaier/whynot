# WhyNot QA — Multi-Agent Context Architecture

## The Core Principle

> Agents without shared context are 5 strangers in a room.
> Agents WITH shared context are a team that's worked together for years.

Every agent must know:
- **What the app is** (type, pages, structure, tech stack)
- **What the plan is** (test objectives, priorities, assignments)
- **What others found** (bugs, test results, observations)
- **What's already done** (explored pages, passed tests — don't repeat)
- **What's blocked** (login walls, CAPTCHAs, broken pages — don't waste time)

---

## Context Layers

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: PROJECT MEMORY  (persists across scans)       │
│  "What we know about this app from ALL previous scans"  │
│  Stored: projects.context JSONB + projects.user_prd     │
│  Read by: ALL agents at session start                   │
│  Updated: QA Lead at session end                        │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  LAYER 2: SESSION PLAN  (created once per scan)         │
│  "What we're doing THIS scan and who does what"         │
│  Stored: qa_session_plan (new table)                    │
│  Created by: QA Lead                                    │
│  Read by: ALL agents before they start                  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  LAYER 3: LIVE BOARD  (updated in real-time)            │
│  "What's happening RIGHT NOW across all agents"         │
│  Stored: qa_agent_board (new table)                     │
│  Written by: ALL agents as they work                    │
│  Read by: ALL agents to coordinate                      │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  LAYER 4: AGENT OUTPUTS  (results per agent)            │
│  "What each agent found — bugs, tests, findings"        │
│  Stored: existing tables (test_cases, bugs, pages)      │
│  Written by: each agent in their specialty              │
│  Read by: QA Lead for final synthesis                   │
└─────────────────────────────────────────────────────────┘
```

---

## LAYER 1: Project Memory

**What exists today:** `projects.context` JSONB with known_pages, known_bugs, test_coverage, scan_history.

**What to ADD:**

```json
{
  "app_profile": {
    "type": "e-commerce",
    "tech_stack": ["React", "Node.js"],
    "auth_type": "session-cookie",
    "login_url": "/auth/login",
    "login_selectors": {
      "email": "input[name='username']",
      "password": "input[name='password']",
      "submit": "button[type='submit']"
    },
    "discovered_api_base": "/api/v1",
    "has_captcha": false,
    "page_count": 15,
    "form_count": 8
  },
  "known_pages": [...],
  "known_bugs": [...],
  "test_coverage": [...],
  "known_api_endpoints": [
    { "method": "POST", "path": "/api/cart", "auth_required": true },
    { "method": "GET", "path": "/api/products", "auth_required": false }
  ],
  "known_security_issues": [
    { "type": "missing_csrf", "page": "/checkout", "status": "open" },
    { "type": "xss_reflected", "page": "/search", "input": "q", "status": "fixed" }
  ],
  "scan_history": [...],
  "agent_learnings": {
    "selectors_that_break": ["div.MuiButton-root", ".css-1a2b3c"],
    "pages_behind_paywall": ["/premium", "/billing"],
    "flaky_pages": ["/dashboard (loads slow, timeout 50% of time)"]
  }
}
```

**Why:** When agents scan the app for the 5th time, they already know:
- The login selectors (no AI call needed)
- Which API endpoints exist (API Tester starts immediately)
- Which security issues were found before (Security Tester focuses on new areas)
- Which selectors are fragile (Auto Tester avoids them)

---

## LAYER 2: Session Plan

**New table: `qa_session_plans`**

```sql
CREATE TABLE qa_session_plans (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES qa_loop_sessions(id),
  created_by VARCHAR(50) DEFAULT 'qa_lead',

  -- App analysis (from QA Lead's first look)
  app_analysis JSONB NOT NULL,
  -- {
  --   "app_type": "e-commerce",
  --   "critical_flows": ["login", "checkout", "search"],
  --   "risk_areas": ["payment form", "user data"],
  --   "total_pages_to_test": 12
  -- }

  -- Task assignments per agent
  objectives JSONB NOT NULL,
  -- [
  --   {
  --     "id": 1,
  --     "agent": "exploratory",
  --     "objective": "Explore all pages, discover forms and flows",
  --     "pages": ["/", "/products", "/cart", "/checkout", "/profile"],
  --     "priority": "critical",
  --     "depends_on": []
  --   },
  --   {
  --     "id": 2,
  --     "agent": "security",
  --     "objective": "Test all discovered forms for XSS/SQLi/CSRF",
  --     "depends_on": [1],    -- waits for exploratory to find forms
  --     "priority": "high"
  --   },
  --   {
  --     "id": 3,
  --     "agent": "api_tester",
  --     "objective": "Test all discovered API endpoints",
  --     "depends_on": [1],    -- waits for exploratory to capture network requests
  --     "priority": "high"
  --   },
  --   {
  --     "id": 4,
  --     "agent": "auto_tester",
  --     "objective": "Write regression tests for all bugs found",
  --     "depends_on": [1, 2, 3],  -- waits for ALL agents to finish
  --     "priority": "medium"
  --   }
  -- ]

  -- Status
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**How it flows:**
1. QA Lead receives URL + project memory
2. QA Lead makes ONE AI call → produces `app_analysis` + `objectives`
3. Session plan stored in DB
4. Each agent reads the plan, finds their objectives, starts working
5. Dependencies are respected — Security Tester waits until Exploratory discovers forms

---

## LAYER 3: Live Board (Real-time Coordination)

**New table: `qa_agent_board`**

```sql
CREATE TABLE qa_agent_board (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES qa_loop_sessions(id),
  agent_type VARCHAR(50) NOT NULL,    -- 'qa_lead', 'exploratory', 'security', 'auto', 'api'
  
  -- Status
  status VARCHAR(20) DEFAULT 'idle',  -- 'idle', 'working', 'blocked', 'done'
  current_task TEXT,                    -- "Testing /checkout form for XSS"
  progress_pct INTEGER DEFAULT 0,
  
  -- Discoveries (shared with other agents in real-time)
  discoveries JSONB DEFAULT '[]',
  -- [
  --   { "type": "form", "page": "/login", "fields": ["email", "password"], "at": "..." },
  --   { "type": "api_endpoint", "method": "POST", "path": "/api/cart", "at": "..." },
  --   { "type": "bug", "title": "Missing CSRF on /checkout", "severity": "high", "at": "..." },
  --   { "type": "page", "url": "/admin", "needs_auth": true, "at": "..." }
  -- ]
  
  -- Messages to other agents
  messages JSONB DEFAULT '[]',
  -- [
  --   { "to": "security", "msg": "Found form at /checkout with no CSRF token", "at": "..." },
  --   { "to": "auto_tester", "msg": "Bug confirmed: XSS on /search?q=<script>", "at": "..." }
  -- ]
  
  -- Metrics
  pages_explored INTEGER DEFAULT 0,
  tests_generated INTEGER DEFAULT 0,
  bugs_found INTEGER DEFAULT 0,
  api_endpoints_tested INTEGER DEFAULT 0,
  
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**How agents use it:**

```
EXPLORATORY TESTER finds a form on /checkout:
  → Writes to board: { type: "form", page: "/checkout", fields: ["card", "cvv", "expiry"] }
  → Security Tester reads this → immediately tests that form for injection

SECURITY TESTER finds XSS on /search:
  → Writes to board: { type: "bug", title: "XSS on /search", severity: "high" }
  → Auto Tester reads this → writes a Playwright regression test for it

API TESTER finds 500 error on POST /api/cart with empty body:
  → Writes to board: { type: "bug", title: "500 on empty cart POST", severity: "medium" }
  → QA Lead reads this → includes in final report

EXPLORATORY TESTER hits a paywall on /premium:
  → Writes to board: { type: "blocked", page: "/premium", reason: "paywall" }
  → ALL agents skip /premium — no wasted effort
```

---

## LAYER 4: Agent Outputs (Existing Tables, Enhanced)

**What exists:** `qa_loop_test_cases`, `qa_loop_bugs`, `qa_loop_pages`, `qa_loop_notes`

**What to ADD:**

Add `agent_source` column to existing tables:

```sql
ALTER TABLE qa_loop_test_cases ADD COLUMN agent_source VARCHAR(50);
-- Values: 'exploratory', 'security', 'auto', 'api'

ALTER TABLE qa_loop_bugs ADD COLUMN agent_source VARCHAR(50);
-- Values: 'exploratory', 'security', 'auto', 'api'

ALTER TABLE qa_loop_pages ADD COLUMN discovered_by VARCHAR(50);
-- Which agent found this page

ALTER TABLE qa_loop_notes ADD COLUMN agent_source VARCHAR(50);
-- Which agent wrote this note
```

**Why:** The QA Lead needs to know WHO found what. The final report says:
- "Exploratory found 3 UX bugs"
- "Security found 2 injection vulnerabilities"
- "API Tester found 4 backend errors"
- "Auto Tester wrote 15 regression tests (12 passed, 3 failed)"

---

## How Context Flows Between Agents

```
USER: "Scan https://myapp.com"
  │
  ▼
QA LEAD reads:
  ├── Layer 1: Project Memory (known pages, past bugs, app profile)
  ├── Layer 1: User PRD (if provided)
  ├── Layer 1: Uploaded Documents (if any)
  │
  └── Produces → Layer 2: Session Plan
      {
        app_analysis: { type: "e-commerce", critical: ["checkout"] },
        objectives: [
          { agent: "exploratory", pages: [...], priority: "critical" },
          { agent: "security", depends_on: ["exploratory"], priority: "high" },
          { agent: "api_tester", depends_on: ["exploratory"], priority: "high" },
          { agent: "auto_tester", depends_on: ["all"], priority: "medium" }
        ]
      }
  │
  ├───────────────────────────┬──────────────────────┬──────────────────┐
  ▼                           ▼                      ▼                  ▼
EXPLORATORY reads:         SECURITY reads:        API reads:         AUTO reads:
├── Session Plan            ├── Session Plan       ├── Session Plan    ├── Session Plan
├── Project Memory          ├── Project Memory     ├── Project Memory  ├── Project Memory
│   (known pages)           │   (known vulns)      │   (known APIs)    │   (existing tests)
│                           │                      │                   │
│ Starts browsing...        │ WAITS for forms...   │ WAITS for reqs...│ WAITS for all...
│                           │                      │                   │
│ ──writes to board──►      │                      │                   │
│ "form at /checkout"       │ ◄──reads board──     │                   │
│ "api: POST /api/cart"     │ starts testing       │ ◄──reads board──  │
│                           │ /checkout form       │ starts testing    │
│                           │                      │ POST /api/cart    │
│ ──writes to board──►      │                      │                   │
│ "12 pages explored"       │ ──writes to board──► │                   │
│ "3 UX bugs found"         │ "XSS on /search"     │ ──writes to──►   │
│                           │ "missing CSRF"       │ "500 on empty"    │
│                           │                      │                   │
│ ✅ DONE                   │ ✅ DONE              │ ✅ DONE           │ ◄──reads ALL──
│                           │                      │                   │ all bugs + pages
│                           │                      │                   │ writes Playwright
│                           │                      │                   │ for EVERY finding
│                           │                      │                   │ ✅ DONE
  │                           │                      │                  │
  └───────────────────────────┴──────────────────────┴──────────────────┘
                                          │
                                          ▼
                                    QA LEAD reads:
                                    ├── All agent board entries
                                    ├── All bugs (with agent_source)
                                    ├── All test cases (with agent_source)
                                    ├── All pages explored
                                    │
                                    └── Produces:
                                        ├── Unified report (cross-referenced)
                                        ├── Quality score
                                        ├── Updated project memory (Layer 1)
                                        └── Recommendations for next scan
```

---

## What Each Agent Receives (System Prompt Context)

### QA Lead — Full Context

```
PROJECT MEMORY:
  App type: e-commerce (React + Node.js)
  15 known pages (12 explored, 3 unexplored)
  5 known bugs (3 open, 2 fixed)
  23 existing test cases (19 passed, 4 failed)
  4 previous scans
  Login: session-cookie, selectors known

YOUR JOB:
  1. Analyze this app
  2. Create a test plan with objectives for each agent
  3. Assign priorities and dependencies
  4. After all agents finish, review and synthesize findings
```

### Exploratory Tester — Navigation Context

```
SESSION PLAN:
  Your objectives: Explore pages [/products, /cart, /checkout, /profile, /settings]
  Priority: critical
  Dependencies: none (you go first)

PROJECT MEMORY:
  Known pages: [list] — skip explored ones unless retesting
  Known login selectors: email=input[name='username'], password=...
  Flaky pages: /dashboard (loads slow, use longer timeout)
  Pages behind paywall: /premium (skip)

YOUR JOB:
  1. Navigate to each page in your objective list
  2. For each page: screenshot, discover forms/links, test basic flows
  3. Write to board: every form, link, API request, and bug you find
  4. Other agents depend on your discoveries — be thorough
  5. Save bugs with save_bug(), mark pages with mark_page_explored()
```

### Security Tester — Attack Context

```
SESSION PLAN:
  Your objectives: Test all forms for OWASP Top 10
  Priority: high
  Dependencies: wait for Exploratory to discover forms

LIVE BOARD (from Exploratory):
  Forms found:
    - /login: fields [email, password], submit=button[type='submit']
    - /checkout: fields [card, cvv, expiry, address]
    - /search: field [q], method=GET
    - /profile/edit: fields [name, email, phone]

PROJECT MEMORY:
  Known security issues: XSS on /search (fixed), missing CSRF on /checkout (open)
  
YOUR JOB:
  1. Read the board for newly discovered forms
  2. For each form, test:
     - XSS: <script>alert(1)</script>, <img onerror=...>, javascript:
     - SQLi: ' OR 1=1--, '; DROP TABLE--, UNION SELECT
     - CSRF: check for token in form/headers
     - Auth bypass: access /admin without login, IDOR on /profile/123
  3. Check HTTP headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
  4. Write findings to board immediately
  5. Save bugs with severity + reproduction steps
```

### API Tester — Backend Context

```
SESSION PLAN:
  Your objectives: Test all discovered API endpoints
  Priority: high
  Dependencies: wait for Exploratory to capture network requests

LIVE BOARD (from Exploratory):
  API endpoints captured:
    - POST /api/cart {product_id, quantity} → 200
    - GET /api/products → 200 (list)
    - GET /api/products/:id → 200 (detail)
    - PUT /api/profile {name, email} → 200
    - DELETE /api/cart/:item_id → 204

PROJECT MEMORY:
  Known API base: /api/v1
  Known endpoints from previous scans: [list]

YOUR JOB:
  1. Read the board for captured API requests
  2. For each endpoint, test:
     - Empty body: POST /api/cart {} → should return 400, not 500
     - Wrong types: POST /api/cart {product_id: "abc"} → should validate
     - Missing auth: hit authenticated endpoints without token
     - Large payloads: send 10MB body → should reject gracefully
     - Rate limiting: hit same endpoint 100 times → should throttle
  3. Validate response schemas (consistent field names, types)
  4. Write findings to board
  5. Save API bugs with endpoint + request + response
```

### Auto Tester — Regression Context

```
SESSION PLAN:
  Your objectives: Write Playwright tests for all findings
  Priority: medium
  Dependencies: wait for ALL agents to finish

LIVE BOARD (all agents done):
  Exploratory found: 12 pages, 8 forms, 3 UX bugs
  Security found: XSS on /search, missing CSRF on /checkout
  API found: 500 on empty cart, missing validation on /profile

PROJECT MEMORY:
  Existing test cases: 23 (don't duplicate)
  Selectors that break: [list — avoid these]
  Login steps: [exact code for login]

YOUR JOB:
  1. For EVERY bug found by any agent, write a Playwright test that reproduces it
  2. For every critical flow (login, checkout, search), write a happy-path test
  3. Playwright code must be self-contained (include login steps)
  4. Execute each test immediately — report pass/fail
  5. Tests that PASS = regression suite (run on every future scan)
  6. Tests that FAIL = confirmed bugs
  7. Don't duplicate existing test cases from project memory
```

---

## Database Changes Required

```sql
-- New: Session plan table
CREATE TABLE qa_session_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
  created_by VARCHAR(50) DEFAULT 'qa_lead',
  app_analysis JSONB NOT NULL DEFAULT '{}',
  objectives JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- New: Agent live board
CREATE TABLE qa_agent_board (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES qa_loop_sessions(id) ON DELETE CASCADE,
  agent_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'idle',
  current_task TEXT,
  progress_pct INTEGER DEFAULT 0,
  discoveries JSONB DEFAULT '[]',
  messages JSONB DEFAULT '[]',
  pages_explored INTEGER DEFAULT 0,
  tests_generated INTEGER DEFAULT 0,
  bugs_found INTEGER DEFAULT 0,
  api_endpoints_tested INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, agent_type)
);

-- Add agent_source to existing tables
ALTER TABLE qa_loop_test_cases ADD COLUMN IF NOT EXISTS agent_source VARCHAR(50);
ALTER TABLE qa_loop_bugs ADD COLUMN IF NOT EXISTS agent_source VARCHAR(50);
ALTER TABLE qa_loop_pages ADD COLUMN IF NOT EXISTS discovered_by VARCHAR(50);
ALTER TABLE qa_loop_notes ADD COLUMN IF NOT EXISTS agent_source VARCHAR(50);

-- Enhance project context with app_profile and learnings
-- (No schema change needed — JSONB is flexible)
```

---

## File Structure

```
services/qa-loop-executor/src/
├── v2/
│   ├── orchestrator.ts           # Main entry: creates QA Lead, manages lifecycle
│   ├── session-plan.ts           # Plan creation + storage
│   ├── agent-board.ts            # Live board read/write
│   ├── agent-context-builder.ts  # Builds context for each agent type
│   ├── agents/
│   │   ├── base-agent.ts         # Shared: AI call, tools, board access
│   │   ├── qa-lead.ts            # Plan + review + report
│   │   ├── exploratory-tester.ts # Browser exploration
│   │   ├── security-tester.ts    # OWASP injection tests
│   │   ├── api-tester.ts         # Backend endpoint tests
│   │   └── auto-tester.ts        # Playwright regression suite
│   └── tools/
│       ├── board-tools.ts        # write_to_board, read_board
│       └── agent-tools.ts        # Agent-specific tool definitions
```

---

## Key Design Decisions

### 1. Board Polling, Not Real-Time Push

Agents poll the board every N tool calls (e.g., every 5 loops):
```typescript
if (loopCount % 5 === 0) {
  const boardUpdates = await agentBoard.getUpdates(sessionId, sinceTimestamp);
  // Inject new discoveries into the next AI message
}
```

Why: Simpler than WebSocket between agents. The DB is the coordination layer.

### 2. Dependencies Are Soft, Not Hard

Security Tester doesn't WAIT for Exploratory to finish completely. It polls the board:
- Exploratory finds form at /login → writes to board
- Security reads board, sees 1 form → starts testing it
- Meanwhile Exploratory finds more forms
- Security polls again → gets new forms → tests those too

This means agents overlap in time, maximizing throughput.

### 3. Project Memory Updated ONLY by QA Lead

Individual agents don't write to project memory directly. QA Lead:
1. Reads all agent outputs at the end
2. Decides what's valuable to remember
3. Updates project memory in one atomic operation

This prevents conflicting writes and ensures quality of the knowledge base.

### 4. Each Agent Gets a DIFFERENT System Prompt

Not one prompt with "you can do everything." Each agent gets:
- **Only their role description** (300 tokens)
- **Only their relevant context** (plan objectives, board data)
- **Only their tools** (Security doesn't get save_test_case, Auto doesn't get browser_click)

This keeps each agent focused and reduces token waste.
