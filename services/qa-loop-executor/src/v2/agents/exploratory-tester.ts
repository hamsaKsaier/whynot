/**
 * Exploratory Tester Agent — browses the app, discovers pages/forms/APIs.
 *
 * First agent to run. Other agents depend on its board discoveries.
 *
 * Key behaviors:
 * - Navigates to every page in the plan
 * - Takes snapshots, discovers interactive elements
 * - Writes EVERY form, link, API endpoint to the board
 * - Saves test cases and bugs with agent_source='exploratory'
 * - Saves pages with discovered_by='exploratory'
 */
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { AgentConfig } from '../types';
import { MCPBrowser } from '../../mcp-browser';
import { getToolSchemasForAgent, ToolSchema } from '../tools/agent-tools';
import { ToolResult } from '../../tool-executor';

import { ChromeDevToolsMCP, filterCdpToolsForAgent } from '../../chrome-devtools-mcp';

export class ExploratoryTesterAgent extends BaseAgent {
  constructor(
    config: AgentConfig,
    mcpBrowser: MCPBrowser,
    cdpMcp: ChromeDevToolsMCP | null = null,
  ) {
    super(config, mcpBrowser, cdpMcp);
  }

  protected buildToolSchemas(): Record<string, { description: string; parameters: z.ZodType }> {
    const agentTools = getToolSchemasForAgent('exploratory');

    // Add MCP browser tools from the browser instance
    if (this.mcpBrowser) {
      const browserTools = this.mcpBrowser.getTools();
      const include = [
        'browser_navigate', 'browser_snapshot', 'browser_click',
        'browser_fill', 'browser_type', 'browser_press_key',
        'browser_select_option', 'browser_evaluate', 'browser_wait_for',
        // Fix 4: network capture is mandatory for API Tester to have endpoints to test
        'browser_network_requests',
      ];

      for (const tool of browserTools) {
        if (!include.includes(tool.name)) continue;

        agentTools[tool.name] = {
          description: tool.description || `Browser tool: ${tool.name}`,
          parameters: this.convertSchema(tool.input_schema),
        };
      }
    }

    // Week 2: add Chrome DevTools diagnostics tools (cdp_*) if available
    if (this.cdpMcp) {
      const cdpAllowed = filterCdpToolsForAgent('exploratory', this.cdpMcp.getTools());
      for (const tool of cdpAllowed) {
        agentTools[tool.name] = {
          description: tool.description || `Chrome DevTools tool: ${tool.name}`,
          parameters: this.convertSchema(tool.input_schema),
        };
      }
    }

    return agentTools;
  }

  /**
   * Override executeTool to auto-write board discoveries when
   * add_discovered_page or save_bug are called.
   */
  protected async executeTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    const result = await super.executeTool(toolName, args);

    // Auto-write page discoveries to the board
    if (toolName === 'add_discovered_page' && !result.error && args.url) {
      await this.boardTools.writeToBoard({
        type: 'page',
        url: args.url,
        page: args.url,
        auth_required: !!this.config.loginCredentials,
      }).catch(() => {});
    }

    // Auto-write bugs to the board (skip when dedup'd — no new bug to share)
    if (toolName === 'save_bug' && !result.error && !result.data?.deduplicated && args.title) {
      await this.boardTools.writeToBoard({
        type: 'bug',
        title: args.title,
        severity: args.severity || 'medium',
        page: args.page_url,
        description: args.description,
      }).catch(() => {});
    }

    return result;
  }

  protected getInitialPrompt(): string {
    const targetUrl = this.config.targetUrl;
    const objectives = this.config.plan?.objectives
      ?.filter(o => o.agent === 'exploratory')
      ?.map(o => o.objective) || [];

    return `Begin exploring ${targetUrl}. ${objectives.length > 0 ? 'Objectives: ' + objectives.join('; ') : ''}

Start: call get_session_state(), then browser_navigate to ${targetUrl}, then browser_snapshot.
For each page: snapshot → write_to_board for forms/links/APIs → save_test_case → mark_page_explored → move to next.
Say "AGENT_DONE" when all reachable pages are explored.`;
  }

  protected getMaxLoops(): number {
    // Exploratory is the discovery bottleneck. Gets 8 outer loops
    // (vs 4 for other agents). With maxSteps=20, that's up to 160 tool
    // calls — same capacity as before but with only 8 generateText calls
    // instead of 20 (60% fewer system prompt retransmissions).
    return 8;
  }

  /**
   * Convert Anthropic tool schema to Zod schema.
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
          zodType = z.record(z.string(), z.any()).describe(p.description || key);
          break;
        default:
          zodType = z.any().describe(p.description || key);
      }

      shape[key] = required.has(key) ? zodType : zodType.optional();
    }

    return z.object(shape);
  }
}
