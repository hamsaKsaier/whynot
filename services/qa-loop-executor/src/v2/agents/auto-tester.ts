/**
 * Auto Tester Agent — generates Playwright regression tests.
 *
 * Runs LAST after all other agents finish. Reads ALL findings from
 * the board (bugs from Exploratory, Security, API) and generates
 * Playwright test code for each one plus happy-path smoke tests.
 *
 * Does NOT use the browser — only generates code via save_test_case().
 */
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { AgentConfig } from '../types';
import { getToolSchemasForAgent, ToolSchema } from '../tools/agent-tools';

export class AutoTesterAgent extends BaseAgent {
  // No browser needed — Auto Tester only generates code
  constructor(config: AgentConfig) {
    super(config);
  }

  protected buildToolSchemas(): Record<string, { description: string; parameters: z.ZodType }> {
    return getToolSchemasForAgent('auto_tester');
  }

  protected getInitialPrompt(): string {
    const targetUrl = this.config.targetUrl;

    return `Generate Playwright regression tests for ${targetUrl}.

Available tools:
- read_board — see ALL bugs/findings from other agents (call this FIRST)
- get_session_state — see existing test cases (avoid duplicates)
- get_unexplored_pages — see which pages still need coverage
- save_test_case — save a test case with playwright_code (your PRIMARY output)
- write_to_board — share observations with other agents
- add_note — log your reasoning for future reference

WORKFLOW:
1. read_board() → see ALL bugs found by Exploratory, Security, API
2. get_session_state() → see existing tests (avoid duplicates) + explored pages
3. Generate BOTH types of tests:

TYPE 1 — REGRESSION tests for every bug found:
  For each bug on the board, write a Playwright test that reproduces the issue.
  observed_result: 'fail' (tests a broken behaviour)

TYPE 2 — HAPPY-PATH tests for every explored page:
  For each page Exploratory explored successfully, write at least 1 test that
  validates the normal user flow (navigation, form submission with valid data,
  content loads). observed_result: 'pass'

EXAMPLE happy-path tests for OrangeHRM:
  - 'Login with valid credentials'
  - 'Navigate to Employee List'
  - 'View Dashboard widgets'
  - 'Access My Info page'
  - 'Submit Leave Request with valid data'
  - 'Search employee by name'
  - 'View employee details'
  - 'Logout from dashboard'

TARGET: 10+ test cases per scan (mix of regression + happy-path).

Each test's playwright_code MUST be self-contained:
- Include login steps at the top if requires_auth=true (browser starts cold)
- Use process.env.TEST_USERNAME / TEST_PASSWORD for credentials
- Use real selectors from discovered pages (check read_board for forms), NOT placeholder text
- Use throw new Error() for assertions
- No imports, no test() wrapper, assume "page" is available
- After every page.goto(): await page.waitForLoadState('networkidle')

Set requires_auth=true for pages behind login.
Say "AGENT_DONE" when you have saved 10+ tests AND every bug has a regression test.`;
  }

  protected getMaxLoops(): number {
    return 8;
  }
}
