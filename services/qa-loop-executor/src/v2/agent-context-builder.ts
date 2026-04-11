/**
 * Agent Context Builder — constructs targeted system prompts for each agent.
 *
 * Each agent gets a DIFFERENT prompt with ONLY their relevant context:
 * - Their role and objectives from the session plan
 * - Relevant project memory slice (not the full blob)
 * - Live board data from other agents
 *
 * Target: <1,500 tokens per agent prompt.
 */
import { createLogger } from '../../../shared/logger/logger';
import { AgentType, SessionPlan, AgentBoardEntry, BoardDiscovery, PlanObjective } from './types';

const logger = createLogger('agent-context-builder');

const MAX_LIST_ITEMS = 10;

/**
 * Preamble added to EVERY agent's system prompt.
 * These rules are critical for correct tool usage and error recovery.
 */
const CRITICAL_TOOL_RULES = `CRITICAL RULES:
Be concise. Output only structured data when asked. No long explanations, no commentary. Take action via tools instead of describing what you would do.

TOOL USAGE:
1. Every tool you call REQUIRES specific fields. Never call a tool without all required fields.
2. If a tool call fails, READ the error message and retry with the missing fields.
3. For save_bug: ALWAYS include title (5+ chars), description (10+ chars), and severity.
4. For add_note: ALWAYS include the note text (5+ chars).
5. For mark_page_explored: ALWAYS include the url.
6. For add_discovered_page: ALWAYS include the url.
7. For save_test_case: ALWAYS include name, description, feature_category, observed_result, and playwright_code.
8. Tool errors are learning moments — fix the missing fields and retry immediately.

If you see "Tool X failed: null value in column Y", you forgot field Y. Retry with field Y filled.
If you see "Tool X failed: Please check all REQUIRED fields", re-read the tool description and include every REQUIRED field.

`;

export class AgentContextBuilder {
  /**
   * Build a focused system prompt for the given agent type.
   */
  buildSystemPrompt(
    agentType: AgentType,
    targetUrl: string,
    plan: SessionPlan,
    projectContext: any,
    boardEntries: AgentBoardEntry[],
    loginCredentials?: { loginUrl?: string; emailSelector?: string; passwordSelector?: string; submitSelector?: string; email: string; password: string }
  ): string {
    switch (agentType) {
      case 'qa_lead':
        return this.buildQALeadPrompt(targetUrl, projectContext);
      case 'exploratory':
        return this.buildExploratoryPrompt(targetUrl, plan, projectContext, loginCredentials);
      case 'security':
        return this.buildSecurityPrompt(targetUrl, plan, projectContext, boardEntries);
      case 'api_tester':
        return this.buildAPITesterPrompt(targetUrl, plan, projectContext, boardEntries);
      case 'auto_tester':
        return this.buildAutoTesterPrompt(targetUrl, plan, projectContext, boardEntries, loginCredentials);
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  // ─── QA Lead (planning phase) ───────────────────────────────────────

  private buildQALeadPrompt(targetUrl: string, projectContext: any): string {
    let prompt = `${CRITICAL_TOOL_RULES}You are a QA Lead planning a test session for ${targetUrl}.

YOUR JOB: Analyze this app and create a test plan. Make ONE decision:
1. What type of app is this? (e-commerce, SaaS, blog, etc.)
2. What are the critical flows to test?
3. What are the risk areas?
4. Assign objectives to these agents: exploratory, security, api_tester, auto_tester

Respond with ONLY a JSON object:
{
  "app_analysis": { "app_type": "...", "critical_flows": [...], "risk_areas": [...], "total_pages_to_test": N },
  "objectives": [
    { "id": 1, "agent": "exploratory", "objective": "...", "pages": [...], "priority": "critical", "depends_on": [] },
    { "id": 2, "agent": "security", "objective": "...", "priority": "high", "depends_on": [1] },
    { "id": 3, "agent": "api_tester", "objective": "...", "priority": "high", "depends_on": [1] },
    { "id": 4, "agent": "auto_tester", "objective": "...", "priority": "medium", "depends_on": [1, 2, 3] }
  ]
}`;

    if (projectContext) {
      prompt += '\n\nPROJECT MEMORY (from previous scans):';
      if (projectContext.app_profile) {
        prompt += `\nApp type: ${projectContext.app_profile.type || 'unknown'}`;
        prompt += `\nPages: ${projectContext.app_profile.page_count || '?'}, Forms: ${projectContext.app_profile.form_count || '?'}`;
      }
      if (projectContext.known_pages) {
        const unexplored = projectContext.known_pages.filter((p: any) => !p.explored);
        if (unexplored.length > 0) {
          prompt += `\nUnexplored pages (${unexplored.length}): ${unexplored.slice(0, MAX_LIST_ITEMS).map((p: any) => p.url).join(', ')}`;
        }
      }
      if (projectContext.known_bugs) {
        const open = projectContext.known_bugs.filter((b: any) => b.status === 'open');
        if (open.length > 0) {
          prompt += `\nOpen bugs (${open.length}): ${open.slice(0, 5).map((b: any) => b.title).join(', ')}`;
        }
      }
      if (projectContext.total_scans) {
        prompt += `\nPrevious scans: ${projectContext.total_scans}`;
      }
    }

    return prompt;
  }

  // ─── Exploratory Tester ─────────────────────────────────────────────

  private buildExploratoryPrompt(
    targetUrl: string,
    plan: SessionPlan,
    projectContext: any,
    loginCredentials?: any
  ): string {
    const objectives = plan.objectives.filter(o => o.agent === 'exploratory');
    const pages = objectives.flatMap(o => o.pages || []);

    const authNote = loginCredentials
      ? `\nIMPORTANT: The browser is ALREADY AUTHENTICATED as the admin user. DO NOT navigate to the login page. DO NOT try to log in again. Start directly from the authenticated dashboard and begin exploring features.\n\nYour first action should be:\n1. Call browser_snapshot() to see the current authenticated page\n2. Call add_discovered_page() for any new links/modules visible in the nav\n3. Start exploring the most important modules first\n\nNever navigate to /auth/login, /auth/requestPasswordResetCode, /login, /signin, or any unauthenticated route unless specifically testing auth flows.\n`
      : '';

    let prompt = `${CRITICAL_TOOL_RULES}You are an Exploratory Tester for ${targetUrl}.
${authNote}
MISSION: Navigate every page, discover forms/links/APIs, find bugs. Other agents depend on your discoveries.

MANDATORY WORKFLOW — do not skip steps:
1. browser_navigate(url) → go to the page
2. browser_snapshot() → see the page structure
3. Look at the links in the snapshot → for EVERY new URL, call add_discovered_page({ url })
4. Interact with the page (click, fill, etc.) if it has forms or buttons
5. browser_snapshot() → see the result of your interactions
6. save_bug() if you found any issue (with title, description, severity ALL REQUIRED)
7. mark_page_explored({ url, description, page_type }) → MANDATORY before moving to next page
8. Repeat for next page

You are NOT done with a page until you call mark_page_explored(). Call it EVERY time.

RULES:
- Call get_session_state() FIRST to see progress
- After EVERY navigate/click, IMMEDIATELY call browser_snapshot()
- After EVERY snapshot: call write_to_board() for every form, link, and API you see
- Call save_test_case() when you have actually tested a feature (with ALL required fields)
- Max 5 tool calls per page then move on
- TARGET: explore 4-5 pages per iteration

You are evaluated on DISCOVERY THROUGHPUT. Find forms, links, APIs — the Security and API agents need them.`;

    if (objectives.length > 0) {
      prompt += `\n\nYOUR OBJECTIVES:\n${objectives.map(o => `- [${o.priority}] ${o.objective}`).join('\n')}`;
    }
    if (pages.length > 0) {
      prompt += `\nPages to explore: ${pages.slice(0, MAX_LIST_ITEMS).join(', ')}`;
    }

    if (projectContext?.known_pages) {
      const unexplored = projectContext.known_pages.filter((p: any) => !p.explored);
      if (unexplored.length > 0) {
        prompt += `\n\nUNEXPLORED PAGES (${unexplored.length}): ${unexplored.slice(0, MAX_LIST_ITEMS).map((p: any) => p.url).join(', ')}`;
      }
    }
    if (projectContext?.agent_learnings?.flaky_pages) {
      prompt += `\nFLAKY PAGES (use longer timeout): ${projectContext.agent_learnings.flaky_pages.slice(0, 5).join(', ')}`;
    }
    if (projectContext?.agent_learnings?.pages_behind_paywall) {
      prompt += `\nSKIP (paywall): ${projectContext.agent_learnings.pages_behind_paywall.slice(0, 5).join(', ')}`;
    }

    if (loginCredentials) {
      prompt += this.loginBlock(loginCredentials);
    }

    return prompt;
  }

  // ─── Security Tester ────────────────────────────────────────────────

  private buildSecurityPrompt(
    targetUrl: string,
    plan: SessionPlan,
    projectContext: any,
    boardEntries: AgentBoardEntry[]
  ): string {
    const objectives = plan.objectives.filter(o => o.agent === 'security');

    let prompt = `${CRITICAL_TOOL_RULES}You are a Security Tester for ${targetUrl}.

MISSION: Test all discovered forms and endpoints for OWASP Top 10 vulnerabilities.

FOR EACH FORM:
- XSS: <script>alert(1)</script>, <img onerror=alert(1)>
- SQLi: ' OR 1=1--, '; DROP TABLE--
- CSRF: check for token in form/headers
- Auth bypass: access admin pages without login

ALSO CHECK:
- HTTP headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- IDOR: try accessing /profile/1, /profile/2 without auth

Write findings to board with save_bug(). Set severity accurately.`;

    if (objectives.length > 0) {
      prompt += `\n\nYOUR OBJECTIVES:\n${objectives.map(o => `- [${o.priority}] ${o.objective}`).join('\n')}`;
    }

    // Inject forms discovered by Exploratory from the board
    const forms = this.extractDiscoveries(boardEntries, 'form');
    if (forms.length > 0) {
      prompt += `\n\nFORMS DISCOVERED (from Exploratory):\n${forms.slice(0, MAX_LIST_ITEMS).map(f =>
        `- ${f.page || f.url}: fields [${(f.fields || []).join(', ')}]`
      ).join('\n')}`;
    }

    if (projectContext?.known_security_issues) {
      const open = projectContext.known_security_issues.filter((i: any) => i.status === 'open');
      if (open.length > 0) {
        prompt += `\n\nKNOWN OPEN SECURITY ISSUES: ${open.slice(0, 5).map((i: any) => `${i.type} on ${i.page}`).join(', ')}`;
      }
    }

    return prompt;
  }

  // ─── API Tester ─────────────────────────────────────────────────────

  private buildAPITesterPrompt(
    targetUrl: string,
    plan: SessionPlan,
    projectContext: any,
    boardEntries: AgentBoardEntry[]
  ): string {
    const objectives = plan.objectives.filter(o => o.agent === 'api_tester');

    let prompt = `${CRITICAL_TOOL_RULES}You are an API Tester for ${targetUrl}.

MISSION: Test all discovered API endpoints with edge cases.

FOR EACH ENDPOINT:
- Empty body: should return 400, not 500
- Wrong types: send string where number expected
- Missing auth: hit authenticated endpoints without token
- Large payloads: send oversized data
- Validate response schema consistency

Write findings to board with save_bug(). Include endpoint + request + response in reproduction steps.`;

    if (objectives.length > 0) {
      prompt += `\n\nYOUR OBJECTIVES:\n${objectives.map(o => `- [${o.priority}] ${o.objective}`).join('\n')}`;
    }

    // Inject API endpoints from board
    const endpoints = this.extractDiscoveries(boardEntries, 'api_endpoint');
    if (endpoints.length > 0) {
      prompt += `\n\nAPI ENDPOINTS DISCOVERED:\n${endpoints.slice(0, MAX_LIST_ITEMS).map(e =>
        `- ${e.method || 'GET'} ${e.path || e.url}${e.auth_required ? ' (auth required)' : ''}`
      ).join('\n')}`;
    }

    if (projectContext?.known_api_endpoints) {
      prompt += `\n\nKNOWN ENDPOINTS (from previous scans): ${projectContext.known_api_endpoints.slice(0, 5).map((e: any) => `${e.method} ${e.path}`).join(', ')}`;
    }

    return prompt;
  }

  // ─── Auto Tester ────────────────────────────────────────────────────

  private buildAutoTesterPrompt(
    targetUrl: string,
    plan: SessionPlan,
    projectContext: any,
    boardEntries: AgentBoardEntry[],
    loginCredentials?: any
  ): string {
    const objectives = plan.objectives.filter(o => o.agent === 'auto_tester');

    let prompt = `${CRITICAL_TOOL_RULES}You are an Auto Tester for ${targetUrl}.

MISSION: Write Playwright regression tests for every bug found + happy-path tests for critical flows.

PLAYWRIGHT RULES:
- No imports, no test() wrapper. Assume "page" is available.
- Use page.goto, page.fill, page.click, page.locator, page.getByRole
- After every page.goto(): await page.waitForLoadState('networkidle')
- Use throw new Error() for assertions, NOT expect()
- Each test MUST be self-contained (include login steps if behind auth)
- Use process.env.TEST_USERNAME / TEST_PASSWORD for credentials
- Don't duplicate existing test cases

FOR EVERY BUG: write a test that reproduces it (fails = confirmed bug)
FOR EVERY CRITICAL FLOW: write a happy-path test (passes = regression guard)`;

    if (objectives.length > 0) {
      prompt += `\n\nYOUR OBJECTIVES:\n${objectives.map(o => `- [${o.priority}] ${o.objective}`).join('\n')}`;
    }

    // Inject all bugs from the board
    const bugs = this.extractDiscoveries(boardEntries, 'bug');
    const securityBugs = this.extractDiscoveries(boardEntries, 'security_issue');
    const allBugs = [...bugs, ...securityBugs];
    if (allBugs.length > 0) {
      prompt += `\n\nBUGS FOUND (write regression tests for each):\n${allBugs.slice(0, MAX_LIST_ITEMS).map(b =>
        `- [${b.severity || 'medium'}] ${b.title || b.description || 'untitled'}${b.page ? ` on ${b.page}` : ''}`
      ).join('\n')}`;
    }

    // Critical flows from plan
    if (plan.app_analysis?.critical_flows) {
      prompt += `\n\nCRITICAL FLOWS (write happy-path tests):\n${plan.app_analysis.critical_flows.map(f => `- ${f}`).join('\n')}`;
    }

    if (projectContext?.test_coverage) {
      const existing = projectContext.test_coverage.length;
      prompt += `\n\nExisting test cases: ${existing} (don't duplicate)`;
    }
    if (projectContext?.agent_learnings?.selectors_that_break) {
      prompt += `\nFRAGILE SELECTORS (avoid): ${projectContext.agent_learnings.selectors_that_break.slice(0, 5).join(', ')}`;
    }

    if (loginCredentials) {
      prompt += this.loginBlock(loginCredentials);
    }

    return prompt;
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  /**
   * Build the board context update injected every N tool calls.
   * Returns a compact summary of new discoveries from other agents.
   */
  buildBoardUpdate(
    agentType: AgentType,
    boardEntries: AgentBoardEntry[],
    sinceTimestamp: string
  ): string {
    const others = boardEntries.filter(e => e.agent_type !== agentType);
    const updates: string[] = [];

    for (const entry of others) {
      const newDiscoveries = (entry.discoveries || []).filter(d => d.at > sinceTimestamp);
      if (newDiscoveries.length > 0) {
        updates.push(`${entry.agent_type}: ${newDiscoveries.map(d => `[${d.type}] ${d.title || d.page || d.path || 'new'}`).join(', ')}`);
      }
    }

    if (updates.length === 0) return '';

    return `\n--- BOARD UPDATE ---\nNew discoveries from other agents:\n${updates.join('\n')}\n---`;
  }

  private extractDiscoveries(boardEntries: AgentBoardEntry[], type: string): BoardDiscovery[] {
    return boardEntries
      .flatMap(e => Array.isArray(e.discoveries) ? e.discoveries : [])
      .filter(d => d.type === type);
  }

  private loginBlock(creds: any): string {
    const loginUrl = creds.loginUrl || '';
    const emailSel = creds.emailSelector || 'input[name="username"]';
    const passSel = creds.passwordSelector || 'input[name="password"]';
    const submitSel = creds.submitSelector || 'button[type="submit"]';
    return '\n\nLOGIN STEPS (include in every test behind auth):\n'
      + 'await page.goto(\'' + loginUrl + '\');\n'
      + 'await page.waitForLoadState(\'networkidle\');\n'
      + 'await page.fill(\'' + emailSel + '\', process.env.TEST_USERNAME || \'' + creds.email + '\');\n'
      + 'await page.fill(\'' + passSel + '\', process.env.TEST_PASSWORD || \'' + creds.password + '\');\n'
      + 'await page.click(\'' + submitSel + '\');\n'
      + 'await page.waitForLoadState(\'networkidle\');';
  }
}
