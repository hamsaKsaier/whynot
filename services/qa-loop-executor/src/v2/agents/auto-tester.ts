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
- save_test_case — save a test case with playwright_code (your PRIMARY output)
- write_to_board — share observations with other agents
- add_note — log your reasoning for future reference

Start by calling read_board() to see ALL bugs found by other agents (Exploratory, Security, API).
Then call get_session_state() to see what tests already exist.

For EVERY bug found: write a Playwright test via save_test_case() that reproduces it.
For critical flows (login, main features): write happy-path smoke tests.

Each test's playwright_code must be SELF-CONTAINED:
- Include login steps if the page requires auth
- Use process.env.TEST_USERNAME / TEST_PASSWORD for credentials
- Use throw new Error() for assertions
- No imports, no test() wrapper, assume "page" is available

Set requires_auth=true for pages behind login. Say "AGENT_DONE" when all bugs have tests.`;
  }

  protected getMaxLoops(): number {
    return 8;
  }
}
