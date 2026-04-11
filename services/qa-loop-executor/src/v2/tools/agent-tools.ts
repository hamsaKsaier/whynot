/**
 * Agent-specific tool definitions with strict Zod validation.
 *
 * Every tool has explicit REQUIRED fields enforced at the schema level.
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

// ─── Board tools (shared by all agents) ────────────────────────────────

export function getBoardToolSchemas(): Record<string, ToolSchema> {
  return {
    write_to_board: {
      description: `Write a discovery to the shared agent board so other agents can see it.
Example: write_to_board({
  type: "form",
  page: "/login",
  fields: ["username", "password"],
  description: "Login form with 2 fields"
})`,
      parameters: z.object({
        type: z.enum(['form', 'api_endpoint', 'bug', 'page', 'blocked', 'security_issue', 'observation'])
          .describe('REQUIRED. Type of discovery.'),
        title: z.string().optional().describe('Short title for the discovery'),
        page: z.string().optional().describe('URL of the page'),
        url: z.string().optional().describe('URL or API path'),
        fields: z.array(z.string()).optional().describe('Form field names'),
        method: z.string().optional().describe('HTTP method for API endpoints'),
        path: z.string().optional().describe('API path'),
        severity: z.string().optional().describe('Bug severity: critical, high, medium, low'),
        description: z.string().optional().describe('Details about the discovery'),
        auth_required: z.boolean().optional().describe('Whether this requires authentication'),
        reason: z.string().optional().describe('Reason (e.g. why a page is blocked)'),
      }),
    },
    read_board: {
      description: `Read discoveries from other agents. Poll this every few actions to see what others found.
Example: read_board({ type_filter: "form" })`,
      parameters: z.object({
        type_filter: z.string().optional().describe('Filter by type: form, api_endpoint, bug, page, blocked, security_issue'),
      }),
    },
    send_agent_message: {
      description: `Send a message to another agent or broadcast to all.
Example: send_agent_message({ to: "security", message: "Found login form at /login" })`,
      parameters: z.object({
        to: z.enum(['exploratory', 'security', 'api_tester', 'auto_tester', 'qa_lead', 'all'])
          .describe('REQUIRED. Target agent.'),
        message: z.string().min(3).describe('REQUIRED. The message content.'),
      }),
    },
  };
}

// ─── State tools (exploration tracking) ────────────────────────────────

export function getStateToolSchemas(): Record<string, ToolSchema> {
  return {
    get_session_state: {
      description: 'Get the current session progress, explored pages, and existing test cases. Takes no arguments.',
      parameters: z.object({}),
    },
    add_discovered_page: {
      description: `Add a newly discovered page to the exploration queue.
Example: add_discovered_page({ url: "https://app.com/settings", priority: 5 })`,
      parameters: z.object({
        url: z.string().min(1).describe('REQUIRED. Full URL of the discovered page.'),
        priority: z.number().optional().describe('Priority 1-10 (higher = explore first)'),
      }),
    },
    mark_page_explored: {
      description: `Mark a page as fully explored. MANDATORY after you finish testing each page.
Example: mark_page_explored({
  url: "https://app.com/dashboard",
  description: "Dashboard with 6 widgets, time tracker, quick actions",
  page_type: "dashboard"
})`,
      parameters: z.object({
        url: z.string().min(1).describe('REQUIRED. Full URL of the page you explored.'),
        description: z.string().optional().describe('What you found on this page'),
        page_type: z.string().optional().describe('Type: form, list, detail, dashboard, login, error, other'),
      }),
    },
    get_unexplored_pages: {
      description: 'Get the list of pages not yet explored. Takes no arguments.',
      parameters: z.object({}),
    },
    add_note: {
      description: `Save an observation or finding for future reference.
Example: add_note({
  note: "The /dashboard page takes 8 seconds to load — possible performance issue",
  category: "observation",
  page_url: "https://app.com/dashboard"
})`,
      parameters: z.object({
        note: z.string().min(5).describe('REQUIRED. The observation text (5+ chars). What did you notice?'),
        category: z.enum(['general', 'bug_hint', 'todo', 'observation', 'blocked']).optional()
          .describe('Note category'),
        page_url: z.string().optional().describe('Related page URL'),
      }),
    },
  };
}

// ─── Report tools (bugs and test cases) ────────────────────────────────

export function getReportToolSchemas(): Record<string, ToolSchema> {
  return {
    save_test_case: {
      description: `Save a test case. Required: name, description, feature_category, observed_result, playwright_code. playwright_code must be self-contained (no imports, no test() wrapper, use page.* methods, throw new Error() for assertions). If requires_auth=true, include login steps at the top.`,
      parameters: z.object({
        name: z.string().min(5).describe('REQUIRED. Test case name (5+ chars).'),
        description: z.string().min(10).describe('REQUIRED. What this test validates (10+ chars).'),
        feature_category: z.string().min(3).describe('REQUIRED. Feature area: Authentication, Dashboard, Navigation, Forms, Search, etc.'),
        observed_result: z.enum(['pass', 'fail']).describe('REQUIRED. Did you observe this passing or failing during exploration?'),
        playwright_code: z.string().min(20).describe('REQUIRED. Self-contained Playwright code (20+ chars). Must include login steps if requires_auth=true.'),
        steps: z.array(z.object({
          action: z.string().describe('Step action: navigate, click, fill, assert, etc.'),
          target: z.string().optional().describe('CSS selector or URL'),
          value: z.string().optional().describe('Input value or expected text'),
          description: z.string().optional().describe('Step description'),
        })).optional().describe('OPTIONAL. Structured steps (auto-derived from playwright_code if omitted).'),
        category: z.string().optional().describe('Deprecated: use feature_category instead'),
        priority: z.number().optional().describe('Priority 1-100'),
        risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Risk level'),
        source_page_url: z.string().optional().describe('Page URL where test applies'),
        requires_auth: z.boolean().optional().describe('True if page requires authentication (then playwright_code MUST include login steps)'),
      }),
    },
    save_bug: {
      description: `Save a bug found during testing. ALL fields marked REQUIRED must be provided.
Example: save_bug({
  title: "Login form accepts empty password",
  description: "The login form submits successfully when password field is empty, allowing unauthorized access",
  severity: "high",
  page_url: "https://app.com/login",
  reproduction_steps: ["Navigate to /login", "Leave password empty", "Click submit"]
})`,
      parameters: z.object({
        title: z.string().min(5).describe('REQUIRED. Short, descriptive bug title (5+ chars).'),
        description: z.string().min(10).describe('REQUIRED. Detailed description of what is wrong and why it matters (10+ chars).'),
        severity: z.enum(['critical', 'high', 'medium', 'low']).describe('REQUIRED. Bug severity level.'),
        category: z.string().optional().describe('Bug category'),
        bug_type: z.string().optional().describe('Type: xss, sqli, csrf, ui, functional, performance, accessibility'),
        page_url: z.string().optional().describe('URL of the page where the bug was found'),
        reproduction_steps: z.array(z.string()).optional().describe('Step-by-step reproduction instructions'),
        root_cause: z.string().optional().describe('Suspected root cause'),
        suggested_fix: z.string().optional().describe('Suggested fix'),
      }),
    },
  };
}

// ─── Agent → Tools mapping ─────────────────────────────────────────────

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
      // Auto Tester generates Playwright tests — save_test_case is PRIMARY output.
      // It needs:
      //   - read_board    → see bugs/findings from all other agents
      //   - get_session_state → see existing tests (avoid duplicates)
      //   - get_unexplored_pages → understand coverage gaps
      //   - save_test_case → primary output (required)
      //   - add_note → log rationale for test choices
      //   - write_to_board + send_agent_message (via ...board) → coordinate
      // NO browser tools — Auto Tester generates code, doesn't interact with app.
      return {
        ...board,
        save_test_case: getReportToolSchemas().save_test_case,
        get_session_state: getStateToolSchemas().get_session_state,
        get_unexplored_pages: getStateToolSchemas().get_unexplored_pages,
        add_note: getStateToolSchemas().add_note,
      };
    case 'qa_lead':
      return {};
    default:
      return { ...board };
  }
}
