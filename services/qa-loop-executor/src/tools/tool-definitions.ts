import Anthropic from '@anthropic-ai/sdk';
import { CHAOS_TOOL_DEFINITIONS } from './chaos-tools';
import { DETECTIVE_TOOL_DEFINITIONS } from './detective-tools';
import { GUARDIAN_TOOL_DEFINITIONS } from './guardian-tools';



/**
 * Get non-browser tool definitions (state + report tools).
 * Browser tools come from Playwright MCP and are merged dynamically.
 */
export function getToolDefinitions(): Anthropic.Tool[] {
  return [
    // Browser tools are provided by Playwright MCP — merged via getToolsForFocusArea()

    // State Tools
    {
      name: 'get_session_state',
      description: 'Get the current state of the QA session including explored pages, tests generated, and progress.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'get_explored_pages',
      description: 'Get list of pages that have already been explored.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'get_unexplored_pages',
      description: 'Get list of discovered pages that have not yet been explored.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'get_notes',
      description: 'Get notes saved from previous iterations.',
      input_schema: {
        type: 'object' as const,
        properties: {
          category: {
            type: 'string',
            description: 'Optional category to filter notes (general, bug_hint, todo, observation)'
          }
        },
        required: []
      }
    },
    {
      name: 'add_note',
      description: 'Add a note for future iterations. Use this to remember important observations.',
      input_schema: {
        type: 'object' as const,
        properties: {
          note: {
            type: 'string',
            description: 'The note content'
          },
          category: {
            type: 'string',
            enum: ['general', 'bug_hint', 'todo', 'observation'],
            description: 'Category of the note (general, bug_hint, todo, observation)'
          },
          page_url: {
            type: 'string',
            description: 'URL of the page this note relates to'
          }
        },
        required: ['note']
      }
    },
    {
      name: 'add_discovered_page',
      description: 'IMPORTANT: Call this for EVERY link/URL you discover in browser_snapshot(). Add each page URL to the exploration queue so future iterations can test it. Call this IMMEDIATELY after observing links — before interacting with the page.',
      input_schema: {
        type: 'object' as const,
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the discovered page'
          },
          priority: {
            type: 'number',
            description: 'Priority for exploration (1-100, higher = explore first)'
          }
        },
        required: ['url']
      }
    },
    {
      name: 'mark_page_explored',
      description: 'Mark a page as explored and save analysis.',
      input_schema: {
        type: 'object' as const,
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the explored page'
          },
          description: {
            type: 'string',
            description: 'Description of what this page does'
          },
          page_type: {
            type: 'string',
            enum: ['form', 'list', 'detail', 'dashboard', 'login', 'error', 'other'],
            description: 'Type of page'
          }
        },
        required: ['url']
      }
    },

    // Report Tools
    {
      name: 'save_test_case',
      description: `Save a generated test case. Every test case MUST include at least one meaningful assertion (assert_text_visible, assert_element_exists, assert_element_visible, or assert_attribute_contains) that verifies actual UI outcome.

PLAYWRIGHT CODE RULES for playwright_code field:
- No imports, no test() wrapper. Assume "page" is available.
- Use page.* methods only (page.goto, page.fill, page.click, page.locator, page.getByRole, etc.)
- IMPORTANT: Set requires_auth=true for ANY page behind login. playwright_code MUST include login steps at the top — the verification browser has no session.
- Prefer selectors: data-testid > aria-label > id > name > role > CSS class.
- After every page.goto(), add: await page.waitForLoadState('networkidle');
- Use throw new Error() for assertions, NOT expect().
- Use process.env.TEST_USERNAME / process.env.TEST_PASSWORD for credentials — never hardcode.
- If a selector might match multiple elements, append .first() or use getByRole with exact name.
- Each test must be SELF-CONTAINED (login steps included if behind auth).`,
      input_schema: {
        type: 'object' as const,
        properties: {
          name: {
            type: 'string',
            description: 'Name of the test case'
          },
          description: {
            type: 'string',
            description: 'Description of what the test validates'
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: [
                    'navigate', 'click', 'type', 'wait', 'scroll',
                    'assert_url_contains', 'assert_url_equals',
                    'assert_text_visible', 'assert_element_exists',
                    'assert_element_not_exists', 'assert_no_console_errors',
                    'assert_input_value',
                    'assert_element_visible', 'assert_element_count',
                    'assert_attribute_contains'
                  ]
                },
                target: {
                  type: 'string',
                  description: 'For navigate: the URL. For click/type: a CSS selector like "#email", ".btn-submit", "button[type=submit]". For assert_element_exists/assert_element_not_exists/assert_element_visible: a CSS selector. For assert_input_value: CSS selector. For assert_element_count: a CSS selector. For assert_attribute_contains: a CSS selector.'
                },
                value: {
                  type: 'string',
                  description: 'For type: the text to enter. For assert_url_contains: URL substring like "/dashboard". For assert_url_equals: full expected URL. For assert_text_visible: the exact visible text to search for on the page (MUST be text you actually observed). For assert_input_value: the expected input value. For assert_element_count: the expected number as string (e.g. "3"). For assert_attribute_contains: format is "attrName:expectedSubstring" (e.g. "class:error", "href:/dashboard", "aria-label:Submit").'
                },
                description: {
                  type: 'string',
                  description: 'Human-readable description of the step'
                }
              },
              required: ['action', 'description']
            },
            description: 'List of test steps. Each test MUST end with at least one meaningful assertion that verifies UI feedback (text, elements, attributes), not just URL or console checks.'
          },
          category: {
            type: 'string',
            enum: ['functional', 'security', 'visual', 'accessibility', 'edge_case'],
            description: 'Category of test'
          },
          priority: {
            type: 'number',
            description: 'Priority (1-100, higher = more important)'
          },
          risk_level: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Risk level if this test fails'
          },
          observed_result: {
            type: 'string',
            enum: ['pass', 'fail'],
            description: 'Your observed outcome when you performed these steps during exploration. "pass" if the steps completed successfully and assertions matched what you saw. "fail" if you observed a bug, error, or unexpected behavior. ALWAYS provide this field.'
          },
          source_page_url: {
            type: 'string',
            description: 'The URL of the page this test was generated from'
          },
          playwright_code: {
            type: 'string',
            description: 'Raw Playwright page commands for this test case. Do NOT include import statements. Do NOT wrap in test() or describe(). Do NOT use expect() from @playwright/test. Assume "page" is already available as a variable. Use exact CSS selectors discovered during exploration. Include await page.screenshot() at key verification points. Use process.env.TEST_USERNAME / process.env.TEST_PASSWORD for credentials — never hardcode them. For assertions, use plain JavaScript with throw: if (!(await el.isVisible())) throw new Error("not visible").'
          },
          feature_category: {
            type: 'string',
            description: 'The feature area this test belongs to. Common categories: Authentication, Dashboard, Navigation, Profile, Settings, Forms, Search, Checkout, Admin. Use the page context to determine the appropriate category.'
          },
          requires_auth: {
            type: 'boolean',
            description: 'Whether this test requires authentication (login) to run. Set to true if the test involves logged-in functionality.'
          }
        },
        required: ['name', 'steps', 'observed_result']
      }
    },
    {
      name: 'save_bug',
      description: 'Report a bug or issue found during exploration.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: {
            type: 'string',
            description: 'Brief title describing the bug'
          },
          description: {
            type: 'string',
            description: 'Detailed description of the bug'
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Severity of the bug'
          },
          category: {
            type: 'string',
            enum: ['validation', 'security', 'ui', 'functionality', 'performance', 'accessibility'],
            description: 'Category of bug'
          },
          bug_type: {
            type: 'string',
            description: 'Specific bug type (e.g., missing_validation, xss, broken_link)'
          },
          page_url: {
            type: 'string',
            description: 'URL where the bug was found'
          },
          reproduction_steps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Steps to reproduce the bug'
          },
          root_cause: {
            type: 'string',
            description: 'Suspected root cause of the bug'
          },
          suggested_fix: {
            type: 'string',
            description: 'Suggested fix for the bug'
          }
        },
        required: ['title', 'severity']
      }
    },
    {
      name: 'get_test_cases',
      description: 'Get list of test cases that have been generated.',
      input_schema: {
        type: 'object' as const,
        properties: {
          category: {
            type: 'string',
            description: 'Optional category to filter'
          }
        },
        required: []
      }
    },
    {
      name: 'get_bugs',
      description: 'Get list of bugs that have been found.',
      input_schema: {
        type: 'object' as const,
        properties: {
          severity: {
            type: 'string',
            description: 'Optional severity to filter'
          }
        },
        required: []
      }
    }
  ];
}

/**
 * Get chaos agent tool definitions
 */
export function getChaosToolDefinitions(): Anthropic.Tool[] {
  return CHAOS_TOOL_DEFINITIONS as Anthropic.Tool[];
}

/**
 * Get detective agent tool definitions
 */
export function getDetectiveToolDefinitions(): Anthropic.Tool[] {
  return DETECTIVE_TOOL_DEFINITIONS as Anthropic.Tool[];
}

/**
 * Get guardian agent tool definitions
 */
export function getGuardianToolDefinitions(): Anthropic.Tool[] {
  return GUARDIAN_TOOL_DEFINITIONS as Anthropic.Tool[];
}

/**
 * Get all tool definitions including agent tools
 */
export function getAllToolDefinitions(): Anthropic.Tool[] {
  return [
    ...getToolDefinitions(),
    ...getChaosToolDefinitions(),
    ...getDetectiveToolDefinitions(),
    ...getGuardianToolDefinitions()
  ];
}

/**
 * MCP browser tools that are never useful for QA — strip to save token budget.
 */
const EXCLUDED_MCP_BROWSER_TOOLS = new Set([
  'browser_tabs',
  'browser_hover',
  'browser_network_requests',
]);

/**
 * Non-browser tool names to EXCLUDE during retest (lightweight replay).
 * Retest only needs MCP browser tools + get_session_state.
 */
const RETEST_KEEP_TOOLS = new Set([
  'get_session_state'
]);

/**
 * Custom tools allowed during the explore phase.
 * State + report tools needed for the navigate-snapshot-save loop.
 */
const EXPLORE_TOOLS = new Set([
  'get_session_state',
  'get_unexplored_pages',
  'add_discovered_page',
  'mark_page_explored',
  'add_note',
  'get_notes',
  'save_test_case',
  'save_bug',
  'get_test_cases',
  'get_explored_pages',
]);


/**
 * Filter MCP browser tools to remove unused ones (saves ~300 tokens per tool).
 */
function filterMcpTools(mcpTools: Anthropic.Tool[]): Anthropic.Tool[] {
  return mcpTools.filter(t => !EXCLUDED_MCP_BROWSER_TOOLS.has(t.name));
}

/**
 * Return the appropriate tool subset for the given focus area.
 * MCP browser tools are passed in and merged with our custom tools.
 *
 * - 'explore'    -> filtered MCP browser tools + explore custom tools (~10 tools)
 * - 'report'     -> browser_navigate + browser_snapshot + report custom tools (~5 tools)
 * - 'retest'     -> MCP browser tools + get_session_state only
 * - other phases -> filtered MCP browser tools + all custom tools
 */
export function getToolsForFocusArea(
  focusArea: 'explore' | 'chaos' | 'retest' | 'investigate',
  mcpTools: Anthropic.Tool[] = []
): Anthropic.Tool[] {
  const filteredMcp = filterMcpTools(mcpTools);

  if (focusArea === 'retest') {
    const customTools = getToolDefinitions().filter(t => RETEST_KEEP_TOOLS.has(t.name));
    return [...filteredMcp, ...customTools];
  }

  // 'explore', 'chaos', 'investigate' all get filtered MCP browser tools + explore tool set
  const customTools = getToolDefinitions().filter(t => EXPLORE_TOOLS.has(t.name));
  return [...filteredMcp, ...customTools];
}

