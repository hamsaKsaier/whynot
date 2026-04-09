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
    let prompt = `You are a QA Lead planning a test session for ${targetUrl}.

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

    let prompt = `You are an Exploratory Tester for ${targetUrl}.

MISSION: Navigate every page, discover forms/links/APIs, find bugs. Other agents depend on your discoveries.

RULES:
1. Call get_session_state() FIRST
2. After EVERY navigate/click, IMMEDIATELY call browser_snapshot()
3. After EVERY snapshot: call write_to_board() for every form, link, and API you see
4. Call save_test_case() for each page you test, then mark_page_explored()
5. Max 5 tool calls per page then move on
6. Call save_bug() for ANY issue you see
7. TARGET: explore 4-5 pages per iteration

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

    let prompt = `You are a Security Tester for ${targetUrl}.

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

    let prompt = `You are an API Tester for ${targetUrl}.

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

    let prompt = `You are an Auto Tester for ${targetUrl}.

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
    return `\n\nLOGIN STEPS (include in every test behind auth):
await page.goto('${creds.loginUrl || ''}');
await page.waitForLoadState('networkidle');
await page.fill('${creds.emailSelector || "input[name=\\"username\\"]"}', process.env.TEST_USERNAME || '${creds.email}');
await page.fill('${creds.passwordSelector || "input[name=\\"password\\"]"}', process.env.TEST_PASSWORD || '${creds.password}');
await page.click('${creds.submitSelector || "button[type=\\"submit\\"]"}');
await page.waitForLoadState('networkidle');`;
  }
}
