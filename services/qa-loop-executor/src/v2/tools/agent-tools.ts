/**
 * Agent-specific tool definitions.
 *
 * Each agent type gets ONLY the tools it needs. This keeps prompts small
 * and prevents agents from doing things outside their role.
 */
import { AgentType } from '../types';
import { tool } from 'ai';
import { z } from 'zod';

/**
 * Board tools available to all agents.
 */
export function getBoardToolSchemas() {
  return {
    write_to_board: tool({
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
    }),
    read_board: tool({
      description: 'Read discoveries from other agents. Poll this every few actions to see what others found.',
      parameters: z.object({
        type_filter: z.string().optional().describe('Filter by type: form, api_endpoint, bug, page, blocked, security_issue'),
      }),
    }),
    send_agent_message: tool({
      description: 'Send a message to another agent or broadcast to all.',
      parameters: z.object({
        to: z.enum(['exploratory', 'security', 'api_tester', 'auto_tester', 'qa_lead', 'all']).describe('Target agent'),
        message: z.string().describe('The message'),
      }),
    }),
  };
}

/**
 * State tools shared by agents that track exploration progress.
 */
export function getStateToolSchemas() {
  return {
    get_session_state: tool({
      description: 'Get current session state: pages explored, tests generated, bugs found.',
      parameters: z.object({}),
    }),
    add_discovered_page: tool({
      description: 'Record a discovered page URL for tracking.',
      parameters: z.object({
        url: z.string().describe('Page URL'),
        priority: z.number().optional().describe('Priority 1-100'),
      }),
    }),
    mark_page_explored: tool({
      description: 'Mark a page as fully explored.',
      parameters: z.object({
        url: z.string().describe('Page URL'),
        description: z.string().optional().describe('What was found'),
        page_type: z.string().optional().describe('Type: form, list, detail, dashboard, auth, settings'),
      }),
    }),
    get_unexplored_pages: tool({
      description: 'Get list of pages not yet explored.',
      parameters: z.object({}),
    }),
    add_note: tool({
      description: 'Save a note for future reference.',
      parameters: z.object({
        note: z.string().describe('The note content'),
        category: z.string().optional().describe('Category: general, bug_hint, todo, observation, blocked'),
        page_url: z.string().optional().describe('Related page URL'),
      }),
    }),
  };
}

/**
 * Report tools for saving test cases and bugs.
 */
export function getReportToolSchemas() {
  return {
    save_test_case: tool({
      description: `Save a test case. IMPORTANT: Set requires_auth=true for pages behind login. playwright_code MUST include login steps — verification browser has no session.
PLAYWRIGHT RULES: No imports, no test() wrapper, use page.* methods, throw new Error() for assertions.`,
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
        observed_result: z.enum(['pass', 'fail']).optional().describe('Did the test pass or fail during exploration?'),
        playwright_code: z.string().optional().describe('Playwright code'),
        requires_auth: z.boolean().optional().describe('True if page requires authentication'),
      }),
    }),
    save_bug: tool({
      description: 'Report a bug found during testing. Include severity and reproduction steps.',
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
    }),
  };
}

/**
 * Get the tool schemas for a specific agent type.
 * Each agent gets only what they need.
 */
export function getToolSchemasForAgent(agentType: AgentType): Record<string, any> {
  const board = getBoardToolSchemas();

  switch (agentType) {
    case 'exploratory':
      return {
        ...board,
        ...getStateToolSchemas(),
        ...getReportToolSchemas(),
        // Browser tools are added separately from MCP
      };

    case 'security':
      return {
        ...board,
        save_bug: getReportToolSchemas().save_bug,
        add_note: getStateToolSchemas().add_note,
        // Browser tools for injection testing
      };

    case 'api_tester':
      return {
        ...board,
        save_bug: getReportToolSchemas().save_bug,
        add_note: getStateToolSchemas().add_note,
        // Browser tools for API inspection
      };

    case 'auto_tester':
      return {
        ...board,
        save_test_case: getReportToolSchemas().save_test_case,
        get_session_state: getStateToolSchemas().get_session_state,
        // Browser tools for verification
      };

    case 'qa_lead':
      // QA Lead only plans and reviews — no browser tools
      return {};

    default:
      return { ...board };
  }
}
