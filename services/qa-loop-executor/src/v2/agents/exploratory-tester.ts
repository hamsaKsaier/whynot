/**
 * Exploratory Tester Agent — browses the app, discovers pages/forms/APIs.
 *
 * This is the first agent to run. Other agents (Security, API) depend on
 * its board discoveries. It refactors the existing scan logic into a
 * focused exploration agent.
 *
 * Responsibilities:
 * - Navigate to every page in the plan
 * - Take snapshots and discover interactive elements
 * - Write every form, link, and API endpoint to the board
 * - Save test cases for basic page functionality
 * - Report bugs for any issues found
 */
import { CoreTool } from 'ai';
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { AgentConfig } from '../types';
import { MCPBrowser } from '../../mcp-browser';
import { getToolSchemasForAgent } from '../tools/agent-tools';

export class ExploratoryTesterAgent extends BaseAgent {
  constructor(config: AgentConfig, mcpBrowser: MCPBrowser) {
    super(config, mcpBrowser);
  }

  protected buildTools(): Record<string, CoreTool> {
    const agentTools = getToolSchemasForAgent('exploratory');

    // Add MCP browser tools from the browser instance
    const mcpTools: Record<string, CoreTool> = {};
    if (this.mcpBrowser) {
      const browserTools = this.mcpBrowser.getTools();
      for (const tool of browserTools) {
        // Convert Anthropic tool format to AI SDK format
        // Only include tools useful for exploration
        const include = [
          'browser_navigate', 'browser_snapshot', 'browser_click',
          'browser_fill', 'browser_type', 'browser_press_key',
          'browser_select_option', 'browser_evaluate', 'browser_wait_for',
        ];
        if (!include.includes(tool.name)) continue;

        mcpTools[tool.name] = {
          description: tool.description || `Browser tool: ${tool.name}`,
          parameters: this.convertSchema(tool.input_schema),
          execute: undefined, // Handled by executeTool in base agent
        } as any;
      }
    }

    return { ...agentTools, ...mcpTools };
  }

  protected getInitialPrompt(): string {
    const targetUrl = this.config.targetUrl;
    const objectives = this.config.plan?.objectives
      ?.filter(o => o.agent === 'exploratory')
      ?.map(o => o.objective) || [];

    return `Begin exploring ${targetUrl}. ${objectives.length > 0 ? 'Your objectives: ' + objectives.join('; ') : ''}

Start by calling get_session_state(), then browser_navigate to ${targetUrl}, then browser_snapshot to see the page.
For every page: discover forms/links, write them to board with write_to_board(), save a test case, then move on.
Say "AGENT_DONE" when you have explored all reachable pages.`;
  }

  protected getMaxLoops(): number {
    return 25; // Exploratory gets the most loops
  }

  /**
   * Convert Anthropic tool schema to Zod schema for AI SDK.
   * Simplified conversion — handles the common cases.
   */
  private convertSchema(schema: any): z.ZodType {
    if (!schema || !schema.properties) {
      return z.object({});
    }

    const shape: Record<string, z.ZodType> = {};
    const required = new Set(schema.required || []);

    for (const [key, prop] of Object.entries(schema.properties)) {
      const p = prop as any;
      let zodType: z.ZodType;

      switch (p.type) {
        case 'string':
          zodType = z.string().describe(p.description || key);
          break;
        case 'number':
        case 'integer':
          zodType = z.number().describe(p.description || key);
          break;
        case 'boolean':
          zodType = z.boolean().describe(p.description || key);
          break;
        case 'array':
          zodType = z.array(z.any()).describe(p.description || key);
          break;
        case 'object':
          zodType = z.record(z.any()).describe(p.description || key);
          break;
        default:
          zodType = z.any().describe(p.description || key);
      }

      shape[key] = required.has(key) ? zodType : zodType.optional();
    }

    return z.object(shape);
  }
}
