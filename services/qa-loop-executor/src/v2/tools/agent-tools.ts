/**
 * Agent-specific tool definitions.
 *
 * Returns plain { description, parameters } objects. The execute callback
 * is added by BaseAgent.buildToolsWithExecute() to route to the correct handler.
 *
 * Each agent type gets ONLY the tools it needs.
 */
import { AgentType } from '../types';
import { z } from 'zod';

export interface ToolSchema {
  description: string;
  parameters: z.ZodType;
}

/**
 * Board tools available to all agents.
 */
export function getBoardToolSchemas(): Record<string, ToolSchema> {
  return {
    write_to_board: {
      description: 'Write a discovery to the shared board so other agents can see it. Use for: forms found, API endpoints, bugs, blocked pages, observations.',
      parameters: z.object({
        type: z.enum(['form', 'api_endpoint', 'bug', 'page', 'blocked', 'security_issue', 'observation']).describe('Type of discovery'),
        title: z.string().optional().describe('Short title'),
        page: z.string().optional().describe('URL of the page'),
        url: z.string().optional().describe('URL or API path'),
        fields: z.array(z.string()).optional().describe('Form field names'),
        method: z.string().optional().describe('HTTP method for API endpoints'),
        path: z.string().optional().describe('API path'),
        severity: z.string().optional().describe('Bug severity: critical, high, medium, low'),
        description: z.string().optional().describe('Details'),
        auth_required: z.boolean().optional().describe('Requires authentication'),
        reason: z.string().optional().describe('Reason for blocked page'),
      }),
    },
    read_board: {
      description: 'Read discoveries from other agents. Poll this every few actions to see what others found.',
      parameters: z.object({
        type_filter: z.string().optional().describe('Filter by type: form, api_endpoint, bug, page, blocked, security_issue'),
      }),
    },
    send_agent_message: {
      description: 'Send a message to another agent or broadcast to all.',
      parameters: z.object({
        to: z.enum(['exploratory', 'security', 'api_tester', 'auto_tester', 'qa_lead', 'all']).describe('Target agent'),
        message: z.string().describe('The message'),
      }),
    },
  };
}

/**
 * State tools for exploration tracking.
 */
export function getStateToolSchemas(): Record<string, ToolSchema> {
  return {
    get_session_state: {
      description: 'Get current session state: pages explored, tests generated, bugs found.',
      parameters: z.object({}),
    },
    add_discovered_page: {
      description: 'Record a discovered page URL for tracking. Also writes to the shared board automatically.',
      parameters: z.object({
        url: z.string().describe('Page URL'),
        priority: z.number().optional().describe('Priority 1-100'),
      }),
    },
    mark_page_explored: {
      description: 'Mark a page as fully explored.',
      parameters: z.object({
        url: z.string().describe('Page URL'),
        description: z.string().optional().describe('What was found'),
        page_type: z.string().optional().describe('Type: form, list, detail, dashboard, auth, settings'),
      }),
    },
    get_unexplored_pages: {
      description: 'Get list of pages not yet explored.',
      parameters: z.object({}),
    },
    add_note: {
      description: 'Save a note for future reference.',
      parameters: z.object({
        note: z.string().describe('The note content'),
        category: z.string().optional().describe('Category: general, bug_hint, todo, observation, blocked'),
        page_url: z.string().optional().describe('Related page URL'),
      }),
    },
  };
}

/**
 * Report tools for saving test cases and bugs.
 */
export function getReportToolSchemas(): Record<string, ToolSchema> {
  return {
    save_test_case: {
      description: `Save a test case. Set requires_auth=true for pages behind login. playwright_code MUST include login steps.
PLAYWRIGHT: No imports, no test() wrapper, use page.* methods, throw new Error() for assertions.`,
      parameters: z.object({
        name: z.string().describe('Test case name'),
        description: z.string().optional().describe('What this test validates'),
        steps: z.array(z.object({
          action: z.string().describe('Step action'),
          target: z.string().optional().describe('CSS selector or URL'),
          value: z.string().optional().describe('Input value or expected text'),
          description: z.string().describe('Step description'),
        })).describe('Test steps'),
        category: z.string().optional().describe('functional, security, visual, accessibility, edge_case'),
        priority: z.number().optional().describe('1-100'),
        risk_level: z.string().optional().describe('low, medium, high, critical'),
        source_page_url: z.string().optional().describe('Page URL'),
        observed_result: z.enum(['pass', 'fail']).optional().describe('Did the test pass or fail?'),
        playwright_code: z.string().optional().describe('Playwright code'),
        requires_auth: z.boolean().optional().describe('True if page requires authentication'),
      }),
    },
    save_bug: {
      description: 'Report a bug found during testing. Include severity and reproduction steps. Also writes to the shared board automatically.',
      parameters: z.object({
        title: z.string().describe('Bug title'),
        description: z.string().optional().describe('Details'),
        severity: z.enum(['critical', 'high', 'medium', 'low']).describe('Bug severity'),
        category: z.string().optional().describe('Bug category'),
        bug_type: z.string().optional().describe('xss, sqli, csrf, ui, functional, performance'),
        page_url: z.string().optional().describe('Page where bug was found'),
        reproduction_steps: z.array(z.string()).optional().describe('Steps to reproduce'),
        root_cause: z.string().optional().describe('Suspected root cause'),
        suggested_fix: z.string().optional().describe('Suggested fix'),
      }),
    },
  };
}

/**
 * Get tool schemas for a specific agent type.
 */
export function getToolSchemasForAgent(agentType: AgentType): Record<string, ToolSchema> {
  const board = getBoardToolSchemas();

  switch (agentType) {
    case 'exploratory':
      return {
        ...board,
        ...getStateToolSchemas(),
        ...getReportToolSchemas(),
      };
    case 'security':
      return {
        ...board,
        save_bug: getReportToolSchemas().save_bug,
        add_note: getStateToolSchemas().add_note,
      };
    case 'api_tester':
      return {
        ...board,
        save_bug: getReportToolSchemas().save_bug,
        add_note: getStateToolSchemas().add_note,
      };
    case 'auto_tester':
      return {
        ...board,
        save_test_case: getReportToolSchemas().save_test_case,
        get_session_state: getStateToolSchemas().get_session_state,
      };
    case 'qa_lead':
      return {};
    default:
      return { ...board };
  }
}
