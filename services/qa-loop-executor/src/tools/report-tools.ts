import { createLogger } from '../../../shared/logger/logger';
import { QALoopRepository } from '../repositories/qa-loop-repository';
import { ToolResult } from '../tool-executor';
import { emitToSession } from '../api/websocket';
import { notifyGateway } from '../notifications/email-notifier';
import { LoginCredentials } from '../loop-orchestrator';

const logger = createLogger('report-tools');

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

  constructor(sessionId: string, onTestCaseCreated?: (testCase: any, observedResult?: 'pass' | 'fail') => void, loginCredentials?: LoginCredentials) {
    this.sessionId = sessionId;
    this.repository = new QALoopRepository();
    this.onTestCaseCreated = onTestCaseCreated;
    this.loginCredentials = loginCredentials;
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

      // Emit event for UI update
      emitToSession(this.sessionId, {
        type: 'test_generated',
        data: {
          id: testCase.id,
          name: testCase.name,
          category: testCase.category,
          stepsCount: steps.length,
          observedResult: input.observed_result
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

      // Emit event for UI update
      emitToSession(this.sessionId, {
        type: 'bug_found',
        data: {
          id: bug.id,
          title: bug.title,
          severity: bug.severity,
          category: input.category
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
