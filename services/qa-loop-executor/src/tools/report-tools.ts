import { createLogger } from '../../../shared/logger/logger';
import { QALoopRepository } from '../repositories/qa-loop-repository';
import { ToolResult } from '../tool-executor';
import { emitToSession } from '../api/websocket';
import { notifyGateway } from '../notifications/email-notifier';
import { LoginCredentials } from '../loop-orchestrator';
import type { AgentEventBus } from '../v2/agent-event-bus';
import type { AgentType } from '../v2/types';

const logger = createLogger('report-tools');

/**
 * "This page failed to load" is only a bug for a page the app actually routes
 * to. SPAs (Angular, Vue, React) answer 200 + index.html for ANY path, so when
 * an agent guesses a URL the app never links to and navigates there, the app's
 * own scripts fail to resolve relative to the bogus path and throw real console
 * errors. The agent then files those as a page-load bug.
 *
 * This was not hypothetical: a scan of OWASP Juice Shop (an Angular shop)
 * produced four HIGH "Admin Page Failed to Load" bugs against invented
 * OrangeHRM-style paths like /web/index.php/admin/viewSystemRole — routes Juice
 * Shop does not have. Publishing those would have been trivially falsifiable.
 *
 * So a load-failure bug is only accepted for a page the crawler genuinely
 * reached via a real link (recorded in qa_loop_pages) or the scan target
 * itself. Matches on the failure vocabulary agents actually use.
 */
function isPageLoadFailureClaim(input: { title?: string; description?: string }): boolean {
  const text = `${input.title || ''} ${input.description || ''}`.toLowerCase();
  return (
    /\bfail(ed|s|ing)?\s+to\s+load\b/.test(text) ||
    /\b(page|site|app|screen)\s+(did\s*n'?t|does\s*n'?t|would\s*n'?t|failed\s+to)\s+(load|render|display)\b/.test(text) ||
    /\bblank\s+(page|screen)\b/.test(text) ||
    /\bmodule\s+script\b/.test(text) ||
    /\bfailed\s+to\s+(fetch|import)\b.*\b(script|module|stylesheet|css)\b/.test(text) ||
    /\b(page|route)\s+not\s+found\b/.test(text)
  );
}

/**
 * True when a bug is really one of WhyNot's OWN tools failing, misattributed to
 * the target app. When the browser_evaluate tool can't serialise a function, or
 * the Chrome DevTools MCP can't find a Chrome binary, that is our tooling — not
 * a defect in the app under test. Agents nonetheless file these, and as
 * critical: a scan of OWASP Juice Shop produced a CRITICAL "CDP functions fail:
 * Chrome executable not found" and a HIGH "browser_evaluate function not
 * serializable", neither of which is a Juice Shop bug.
 *
 * Matches on our internal tool/infra identifiers, which essentially never
 * appear when describing a genuine application defect.
 */
function isOwnToolFailure(input: { title?: string; description?: string }): boolean {
  const text = `${input.title || ''} ${input.description || ''}`.toLowerCase();
  const mentionsInternal =
    /\bbrowser_evaluate\b/.test(text) ||
    /\bcdp_[a-z_]+/.test(text) ||
    /\bpage\._evaluate/.test(text) ||
    /_evaluatefunction/.test(text) ||
    /\b(playwright|chrome\s+devtools)\s+mcp\b/.test(text) ||
    /\bmcp\s+(tool|server|browser)\b/.test(text);
  const infraError =
    /not\s+(well[-\s]?)?serializable/.test(text) ||
    /chrome(\s+executable)?\s+(not\s+found|is\s+not\s+installed|could\s*n'?t\s+be\s+found)/.test(text) ||
    /executable\s+doesn'?t\s+exist/.test(text);
  // Either an explicit internal-tool reference, or a bare infra-error string
  // that only our stack emits — both mean "our tool broke", not "app is buggy".
  return mentionsInternal || infraError;
}

/** Normalise a URL for comparison: drop trailing slash and SPA hash fragment. */
function canonicalUrl(u: string | null | undefined): string {
  if (!u) return '';
  return u.trim().replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
}

/**
 * Every concrete page route a bug refers to — from page_url AND the free text
 * of its title and description — resolved to canonical URLs on the target
 * origin.
 *
 * Why the free text matters: an agent can name a hallucinated route in the
 * title ("Blank page … on /admin/viewSystemRole") while leaving page_url on the
 * legitimate root. The load-failure gate that only inspected page_url waved
 * those through — a real hole, seen on a Juice Shop scan that filed four HIGH
 * "blank page" bugs against invented OrangeHRM paths.
 *
 * Asset URLs (…/main.js, …/styles.css) are excluded — a failed asset fetch is
 * not a "page route" and shouldn't be treated as one.
 */
function referencedRoutes(input: { page_url?: string; title?: string; description?: string }, targetUrl: string): string[] {
  let origin = '';
  try { origin = new URL(targetUrl).origin; } catch { /* no origin to resolve against */ }

  const text = [input.page_url, input.title, input.description].filter(Boolean).join('  ');
  const out = new Set<string>();

  // Absolute URLs mentioned anywhere.
  const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;
  for (const m of text.match(URL_RE) || []) {
    try { out.add(canonicalUrl(new URL(m).href)); } catch { /* skip malformed */ }
  }
  // Absolute, route-shaped paths (/admin/viewSystemRole). Two guards:
  //   - strip full URLs first, so the `//host` inside one isn't read as a path;
  //   - `(?<!#)` so an SPA hash route like /#/basket isn't split into "/basket"
  //     (hash routes collapse to the root and are trusted).
  // Skip anything whose last segment has a file extension — /assets/main.js is
  // an asset fetch, not a page route.
  if (origin) {
    const textNoUrls = text.replace(URL_RE, ' ');
    for (const m of textNoUrls.match(/(?<!#)\/[A-Za-z0-9._~\-]+(?:\/[A-Za-z0-9._~\-]+)*/g) || []) {
      const last = m.split('/').pop() || '';
      if (/\.[a-z0-9]{1,6}$/i.test(last)) continue;
      try { out.add(canonicalUrl(new URL(m, origin).href)); } catch { /* skip */ }
    }
  }
  return [...out];
}

/**
 * Safety net: if requires_auth is true but playwright_code has no login steps,
 * prepend them automatically so the cold verification browser can authenticate.
 */
function ensureLoginSteps(code: string, credentials: LoginCredentials): string {
  // If code already has login steps, return as-is
  if (code.includes('/auth/login') || code.includes('/login') || code.includes(credentials.loginUrl || '__none__')) {
    return code;
  }

  const loginUrl = credentials.loginUrl || '';
  const emailSelector = credentials.emailSelector || 'input[name="username"]';
  const passwordSelector = credentials.passwordSelector || 'input[name="password"]';
  const submitSelector = credentials.submitSelector || 'button[type="submit"]';

  const loginCode = `// Auto-injected login steps (verification browser has no session)
await page.goto('${loginUrl}');
await page.waitForLoadState('networkidle');
await page.fill('${emailSelector}', process.env.TEST_USERNAME || '${credentials.email}');
await page.fill('${passwordSelector}', process.env.TEST_PASSWORD || '${credentials.password}');
await page.click('${submitSelector}');
await page.waitForLoadState('networkidle');
`;
  return loginCode + '\n' + code;
}

export interface TestCaseInput {
  name: string;
  description?: string;
  steps: Array<{
    action: string;
    target?: string;
    value?: string;
    description: string;
  }>;
  category?: string;
  priority?: number;
  risk_level?: string;
  source_page_url?: string;
  observed_result?: 'pass' | 'fail';
  playwright_code?: string;
  feature_category?: string;
  requires_auth?: boolean;
}

/**
 * Auto-categorize a test case name into a feature area.
 */
export function categorizeTestCase(name: string): string {
  const n = name.toLowerCase();
  if (/login|password|credentials|auth|forgot|register|sign[\s_-]?(up|in|out)|logout/i.test(n)) return 'Authentication';
  if (/dashboard/i.test(n)) return 'Dashboard';
  if (/menu|nav|sidebar|header|footer|breadcrumb/i.test(n)) return 'Navigation';
  if (/profile|account|user/i.test(n)) return 'Profile';
  if (/settings|config|preference/i.test(n)) return 'Settings';
  if (/search|filter|sort/i.test(n)) return 'Search';
  if (/checkout|cart|payment|order/i.test(n)) return 'Checkout';
  if (/admin|manage|moderator/i.test(n)) return 'Admin';
  if (/form|input|submit|validation/i.test(n)) return 'Forms';
  return 'General';
}

export interface BugInput {
  title: string;
  description?: string;
  severity: string;
  category?: string;
  bug_type?: string;
  page_url?: string;
  reproduction_steps?: string[];
  root_cause?: string;
  suggested_fix?: string;
  video_path?: string;
}

export class ReportTools {
  private sessionId: string;
  private repository: QALoopRepository;
  private onTestCaseCreated?: (testCase: any, observedResult?: 'pass' | 'fail') => void;
  private loginCredentials?: LoginCredentials;
  // v4 Phase 1: optional event bus + agentType for emitting bug.confirmed
  // and test.saved after successful DB writes. Set via setEventBusContext
  // after construction so we don't disturb the existing constructor
  // signature (callers in v1 paths still build ReportTools with 1-3 args).
  private eventBus: AgentEventBus | null = null;
  private eventBusAgentType: AgentType | null = null;

  constructor(sessionId: string, onTestCaseCreated?: (testCase: any, observedResult?: 'pass' | 'fail') => void, loginCredentials?: LoginCredentials) {
    this.sessionId = sessionId;
    this.repository = new QALoopRepository();
    this.onTestCaseCreated = onTestCaseCreated;
    this.loginCredentials = loginCredentials;
  }

  /**
   * v4 Phase 1: attach the session's shared event bus + agent identity.
   * No-op when the feature flag is off (caller passes null).
   */
  setEventBusContext(bus: AgentEventBus | null, agentType: AgentType | null): void {
    this.eventBus = bus;
    this.eventBusAgentType = agentType;
  }

  async saveTestCase(input: TestCaseInput): Promise<ToolResult> {
    try {
      // Safety net: auto-inject login steps if requires_auth but code is missing them
      let playwrightCode = input.playwright_code;
      if (playwrightCode && input.requires_auth && this.loginCredentials) {
        playwrightCode = ensureLoginSteps(playwrightCode, this.loginCredentials);
      }

      // Validate: accept either structured steps OR playwright_code.
      // playwright_code is self-sufficient — derive a minimal step array if needed.
      let steps = input.steps;
      if (!steps || steps.length === 0) {
        if (!playwrightCode || playwrightCode.trim().length === 0) {
          return { error: 'Test case must have either steps OR playwright_code' };
        }
        // Derive a single placeholder step from playwright_code
        steps = [{
          action: 'execute_playwright',
          target: 'browser',
          description: input.description || input.name || 'Run playwright test',
        }];
      }

      // Determine feature category: use AI's suggestion, fall back to auto-categorize from name
      const featureCategory = input.feature_category || categorizeTestCase(input.name);

      const testCase = await this.repository.addTestCase(this.sessionId, {
        name: input.name,
        description: input.description,
        steps,
        category: input.category || 'functional',
        priority: input.priority || 50,
        riskLevel: input.risk_level || 'medium',
        sourcePageUrl: input.source_page_url,
        source: 'exploration',
        observedResult: input.observed_result,
        playwrightCode,
        featureCategory,
        requiresAuth: input.requires_auth || false
      });

      // Emit event for UI update. `agent` is what lets the team board credit
      // the test to the agent that saved it — without it every per-agent
      // counter on the board stays at zero even after a productive scan.
      emitToSession(this.sessionId, {
        type: 'test_generated',
        data: {
          id: testCase.id,
          name: testCase.name,
          category: testCase.category,
          stepsCount: steps.length,
          observedResult: input.observed_result,
          agent: this.eventBusAgentType || undefined,
        }
      });

      // Trigger parallel execution immediately (if callback registered)
      if (this.onTestCaseCreated) {
        try {
          this.onTestCaseCreated(testCase, input.observed_result);
        } catch (cbErr: any) {
          logger.warn('onTestCaseCreated callback failed', { error: cbErr.message });
        }
      }

      // Update session progress — wrapped in try/catch so a follow-up DB
      // error doesn't turn a successful test-case save into a reported error.
      // This was the root cause of v2's tests_generated counter drift:
      // test case rows were in the DB but the counter showed 0 because
      // updateSessionProgress failures poisoned the return path.
      try {
        const allTestCases = await this.repository.getTestCases(this.sessionId);
        await this.repository.updateSessionProgress(this.sessionId, {
          testsGenerated: allTestCases.length
        });
      } catch (progressErr: any) {
        logger.warn('updateSessionProgress failed after test case save (non-fatal)', {
          sessionId: this.sessionId,
          testCaseId: testCase.id,
          error: progressErr.message,
        });
      }

      logger.info('Test case saved', {
        sessionId: this.sessionId,
        testCaseId: testCase.id,
        name: input.name,
        observedResult: input.observed_result
      });

      // v4 Phase 1: broadcast test.saved on the session bus. Happens
      // AFTER the DB write so the event carries the real test case id,
      // and AFTER the non-fatal progress update so we don't publish for
      // a test that ultimately wasn't committed.
      if (this.eventBus && this.eventBusAgentType) {
        try {
          this.eventBus.publish({
            type: 'test.saved',
            agent: this.eventBusAgentType,
            at: new Date().toISOString(),
            data: {
              testCaseId: testCase.id,
              name: input.name,
              category: input.feature_category || input.category,
            },
          });
        } catch {
          // Never let a bus failure fail a DB-committed save.
        }
      }

      return {
        data: {
          success: true,
          testCaseId: testCase.id,
          message: `Test case "${input.name}" saved with ${steps.length} steps (observed: ${input.observed_result || 'not specified'})`
        },
        metrics: {
          testGenerated: true
        }
      };
    } catch (error: any) {
      logger.error('Failed to save test case', {
        sessionId: this.sessionId,
        name: input.name,
        error: error.message
      });
      return { error: `Failed to save test case: ${error.message}` };
    }
  }

  async saveBug(input: BugInput): Promise<ToolResult> {
    try {
      // ── Verification gate C: our own tool failures, not app defects ──
      // Checked first — cheap, no DB round-trip.
      if (isOwnToolFailure(input)) {
        logger.warn('Rejected own-tool-failure reported as app bug', {
          sessionId: this.sessionId,
          title: input.title,
        });
        return {
          error:
            `Not filed: this describes a failure of a testing tool (e.g. ` +
            `browser_evaluate, cdp_*, or a missing Chrome binary), not a defect ` +
            `in the app under test. That is an environment/tooling problem — do ` +
            `not report it as a bug in the target. Continue testing with other ` +
            `tools and only file bugs about the application's own behaviour.`,
        };
      }

      // ── Verification gate A: page-load failures on undiscovered routes ──
      // A "page failed to load" is only meaningful for a page the app actually
      // links to. SPA catch-all routing turns a guessed URL into a real-looking
      // load failure, so agents hallucinate routes and file bugs about them.
      //
      // Checks EVERY route the bug names — page_url and the routes mentioned in
      // its title/description — against the target root and the discovered
      // pages. Any concrete route on the target host that was never discovered
      // is the false-positive pattern, wherever in the bug it appears.
      if (isPageLoadFailureClaim(input)) {
        const session = await this.repository.getSession(this.sessionId);
        const target = canonicalUrl(session?.target_url);
        let targetHost = '';
        try { targetHost = new URL(session?.target_url || '').host; } catch { /* none */ }

        if (target && targetHost) {
          const pages = await this.repository.getPages(this.sessionId).catch(() => []);
          const discovered = new Set(pages.map(p => canonicalUrl(p.url)));

          const bogus = referencedRoutes(input, session!.target_url).find(u => {
            if (u === target || discovered.has(u)) return false;   // root or a real page
            let host = '', path = '';
            try { const p = new URL(u); host = p.host; path = p.pathname.replace(/\/+$/, ''); }
            catch { return false; }
            // Only judge routes ON the target host that are deeper than root.
            return host === targetHost && path !== '';
          });

          if (bogus) {
            logger.warn('Rejected page-load bug on undiscovered route', {
              sessionId: this.sessionId,
              title: input.title,
              page_url: input.page_url,
              bogusRoute: bogus,
            });
            return {
              error:
                `Not filed: "${bogus}" is not a page this app links to — it was never ` +
                `found via a real link, so a load failure there is not a bug (single-page ` +
                `apps return a page for any URL, and the app's own scripts then fail against ` +
                `the wrong path). Only report load failures for pages you reached by ` +
                `following an actual link. Do not re-file this under a different URL field.`,
            };
          }
        }
      }

      // ── Verification gate B: high/critical claims need reproduction steps ──
      // A "reflected XSS / arbitrary code execution" filed with no way to
      // reproduce it is the severity-inflation failure mode. Real high-severity
      // findings can be reproduced; require the steps rather than taking the
      // label on faith. (Observed: a HIGH "Reflected XSS" whose payload was in
      // fact escaped in the page body and merely reflected inside a meta tag.)
      const severity = (input.severity || '').toLowerCase();
      const hasRepro = Array.isArray(input.reproduction_steps)
        && input.reproduction_steps.filter(s => (s || '').trim().length > 0).length >= 1;
      if ((severity === 'high' || severity === 'critical') && !hasRepro) {
        logger.warn('Rejected high/critical bug with no reproduction steps', {
          sessionId: this.sessionId,
          title: input.title,
          severity,
        });
        return {
          error:
            `Not filed: a ${severity}-severity bug must include concrete reproduction_steps ` +
            `(the exact actions that trigger it, and what you observed). If you cannot give ` +
            `steps that reproduce it, you have not confirmed it — lower the severity to ` +
            `'medium' or below, or verify it first, then re-file.`,
        };
      }

      // Fix 4: deduplicate bugs by title + page_url within the same session.
      // Agents frequently re-report the same missing-header / CSRF / etc.
      // issue across iterations. Skip silently so the report stays clean.
      const existingBugs = await this.repository.getBugs(this.sessionId).catch(() => []);
      const normalize = (s: string | null | undefined) =>
        (s || '').trim().toLowerCase();
      const normalizedTitle = normalize(input.title);
      const normalizedPage = normalize(input.page_url);
      const isDuplicate = existingBugs.some(b =>
        normalize(b.title) === normalizedTitle &&
        normalize(b.page_url) === normalizedPage
      );
      if (isDuplicate) {
        logger.info('Duplicate bug — skipping', {
          sessionId: this.sessionId,
          title: input.title,
          page_url: input.page_url,
        });
        return {
          data: {
            success: true,
            deduplicated: true,
            message: `Bug "${input.title}" already reported for this session — skipped duplicate.`,
          },
        };
      }

      // Get current session for iteration number
      const session = await this.repository.getSession(this.sessionId);

      const bug = await this.repository.addBug(this.sessionId, {
        title: input.title,
        description: input.description,
        severity: input.severity,
        category: input.category,
        bugType: input.bug_type,
        pageUrl: input.page_url,
        reproductionSteps: input.reproduction_steps || [],
        rootCause: input.root_cause,
        suggestedFix: input.suggested_fix,
        iterationFound: session?.iteration_count,
        videoPath: input.video_path
      });

      // Emit event for UI update. See saveTestCase — `agent` is required for
      // the team board to attribute the finding to whoever found it.
      emitToSession(this.sessionId, {
        type: 'bug_found',
        data: {
          id: bug.id,
          title: bug.title,
          severity: bug.severity,
          category: input.category,
          agent: this.eventBusAgentType || undefined,
        }
      });

      // Update session progress — same non-fatal wrapping as saveTestCase.
      try {
        const allBugs = await this.repository.getBugs(this.sessionId);
        await this.repository.updateSessionProgress(this.sessionId, {
          bugsFound: allBugs.length
        });
      } catch (progressErr: any) {
        logger.warn('updateSessionProgress failed after bug save (non-fatal)', {
          sessionId: this.sessionId,
          bugId: bug.id,
          error: progressErr.message,
        });
      }

      logger.info('Bug saved', {
        sessionId: this.sessionId,
        bugId: bug.id,
        title: input.title,
        severity: input.severity
      });

      // v4 Phase 1: broadcast bug.confirmed on the session bus. Carries
      // the real DB-assigned bugId (BoardTools' mirror event uses the
      // title as a stand-in because it doesn't see the DB row id).
      if (this.eventBus && this.eventBusAgentType) {
        try {
          this.eventBus.publish({
            type: 'bug.confirmed',
            agent: this.eventBusAgentType,
            at: new Date().toISOString(),
            data: {
              bugId: bug.id,
              severity: input.severity,
              title: input.title,
              pageUrl: input.page_url,
            },
          });
        } catch {
          // Bus failure must never unwind a committed bug.
        }
      }

      // Send critical bug email notification
      if (input.severity === 'critical' || input.severity === 'high') {
        const sessionInfo = await this.repository.getSession(this.sessionId);
        if (sessionInfo?.workspace_id) {
          notifyGateway({
            type: 'critical_bug',
            workspaceId: sessionInfo.workspace_id,
            data: {
              sessionId: this.sessionId,
              targetUrl: sessionInfo.target_url,
              projectName: sessionInfo.target_url,
              bugTitle: input.title,
              severity: input.severity,
            },
          }).catch(() => {});
        }
      }

      return {
        data: {
          success: true,
          bugId: bug.id,
          message: `Bug "${input.title}" reported with severity ${input.severity}`
        },
        metrics: {
          bugFound: true
        }
      };
    } catch (error: any) {
      logger.error('Failed to save bug', {
        sessionId: this.sessionId,
        title: input.title,
        error: error.message
      });
      return { error: `Failed to save bug: ${error.message}` };
    }
  }

  async getTestCases(category?: string): Promise<ToolResult> {
    try {
      const testCases = await this.repository.getTestCases(this.sessionId, {
        category,
        active: true
      });

      return {
        data: {
          count: testCases.length,
          testCases: testCases.map(tc => ({
            id: tc.id,
            name: tc.name,
            description: tc.description,
            category: tc.category,
            priority: tc.priority,
            stepsCount: tc.steps?.length || 0,
            lastRunStatus: tc.last_run_status,
            createdAt: tc.created_at
          }))
        }
      };
    } catch (error: any) {
      logger.error('Failed to get test cases', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to get test cases: ${error.message}` };
    }
  }

  async getBugs(severity?: string): Promise<ToolResult> {
    try {
      const bugs = await this.repository.getBugs(this.sessionId, {
        severity,
        status: 'open'
      });

      return {
        data: {
          count: bugs.length,
          bugs: bugs.map(b => ({
            id: b.id,
            title: b.title,
            description: b.description,
            severity: b.severity,
            category: b.category,
            pageUrl: b.page_url,
            status: b.status,
            createdAt: b.created_at
          }))
        }
      };
    } catch (error: any) {
      logger.error('Failed to get bugs', {
        sessionId: this.sessionId,
        error: error.message
      });
      return { error: `Failed to get bugs: ${error.message}` };
    }
  }
}
