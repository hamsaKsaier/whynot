import Anthropic from '@anthropic-ai/sdk';
import { CHAOS_TOOL_DEFINITIONS } from './chaos-tools';
import { DETECTIVE_TOOL_DEFINITIONS } from './detective-tools';
import { GUARDIAN_TOOL_DEFINITIONS } from './guardian-tools';

/**
 * Get all tool definitions for Claude
 * These define what tools Claude can call during exploration
 */
export function getToolDefinitions(): Anthropic.Tool[] {
  return [
    // Browser Tools
    {
      name: 'navigate',
      description: 'Navigate the browser to a URL. Returns a screenshot and HTML of the page.',
      input_schema: {
        type: 'object' as const,
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to'
          }
        },
        required: ['url']
      }
    },
    {
      name: 'click',
      description: 'Click on an element on the page. Use a CSS selector or descriptive text.',
      input_schema: {
        type: 'object' as const,
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector or text content to identify the element'
          }
        },
        required: ['selector']
      }
    },
    {
      name: 'type_text',
      description: 'Type text into an input field.',
      input_schema: {
        type: 'object' as const,
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector or text content to identify the input field'
          },
          text: {
            type: 'string',
            description: 'The text to type'
          },
          clear_first: {
            type: 'boolean',
            description: 'Whether to clear the field before typing (default: true)'
          }
        },
        required: ['selector', 'text']
      }
    },
    {
      name: 'screenshot',
      description: 'Take a screenshot of the current page.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'get_page_elements',
      description: 'Get all interactive elements on the current page (links, buttons, forms, inputs).',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'scroll',
      description: 'Scroll the page in a direction.',
      input_schema: {
        type: 'object' as const,
        properties: {
          direction: {
            type: 'string',
            enum: ['up', 'down', 'top', 'bottom'],
            description: 'Direction to scroll'
          },
          amount: {
            type: 'number',
            description: 'Amount to scroll in pixels (default: 500)'
          }
        },
        required: ['direction']
      }
    },
    {
      name: 'go_back',
      description: 'Go back to the previous page in browser history.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    },
    {
      name: 'wait',
      description: 'Wait for a specified amount of time.',
      input_schema: {
        type: 'object' as const,
        properties: {
          milliseconds: {
            type: 'number',
            description: 'Time to wait in milliseconds (max: 10000)'
          }
        },
        required: ['milliseconds']
      }
    },

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
            enum: ['general', 'bug_hint', 'todo', 'observation', 'blocked'],
            description: 'Category of the note'
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
      description: 'Add a newly discovered page URL to the exploration queue.',
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
      description: 'Save a generated test case.',
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
                  enum: ['navigate', 'click', 'type', 'assert', 'wait', 'scroll']
                },
                target: {
                  type: 'string',
                  description: 'URL, selector, or assertion target'
                },
                value: {
                  type: 'string',
                  description: 'Value for type action or expected value for assert'
                },
                description: {
                  type: 'string',
                  description: 'Human-readable description of the step'
                }
              },
              required: ['action', 'description']
            },
            description: 'List of test steps'
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
          }
        },
        required: ['name', 'steps']
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
 * Browser-only tool names used for retest / lightweight phases.
 * These are a subset of the 19 core tools — just enough to replay steps
 * and observe results without needing note-taking or test-saving tools.
 */
const RETEST_TOOL_NAMES = new Set([
  'navigate',
  'click',
  'type_text',
  'screenshot',
  'get_page_elements',
  'scroll',
  'go_back',
  'wait',
  'get_session_state'
]);

/**
 * Return the appropriate tool subset for the given focus area.
 *
 * - 'explore'    → all 19 core tools (default)
 * - 'retest'     → 9 browser tools only (no note-taking / test-saving overhead)
 * - other phases → the specific agents use their own tool sets; fall back to core
 */
export function getToolsForFocusArea(focusArea: 'explore' | 'chaos' | 'retest' | 'investigate'): Anthropic.Tool[] {
  if (focusArea === 'retest') {
    return getToolDefinitions().filter(t => RETEST_TOOL_NAMES.has(t.name));
  }
  // 'explore', 'chaos', 'investigate' all use the full core tool set when going through ClaudeSession
  return getToolDefinitions();
}
