/**
 * API Tester Agent — tests discovered API endpoints with edge cases.
 *
 * Reads api_endpoint discoveries from the agent board, then uses
 * browser_evaluate() to make fetch() calls from the page context
 * (the browser is logged in, so auth cookies are attached).
 *
 * Tests: empty body, wrong types, missing auth, large payloads,
 * schema consistency.
 */
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { AgentConfig } from '../types';
import { MCPBrowser } from '../../mcp-browser';
import { getToolSchemasForAgent, ToolSchema } from '../tools/agent-tools';
import { ToolResult } from '../../tool-executor';

export class APITesterAgent extends BaseAgent {
  constructor(config: AgentConfig, mcpBrowser: MCPBrowser) {
    super(config, mcpBrowser);
  }

  protected buildToolSchemas(): Record<string, { description: string; parameters: z.ZodType }> {
    const agentTools = getToolSchemasForAgent('api_tester');

    // API tester mainly uses browser_evaluate for fetch() and browser_navigate
    if (this.mcpBrowser) {
      const browserTools = this.mcpBrowser.getTools();
      const include = ['browser_navigate', 'browser_evaluate', 'browser_snapshot'];

      for (const tool of browserTools) {
        if (!include.includes(tool.name)) continue;
        agentTools[tool.name] = {
          description: tool.description || `Browser tool: ${tool.name}`,
          parameters: this.convertSchema(tool.input_schema),
        };
      }
    }

    return agentTools;
  }

  /**
   * Override executeTool to auto-write API findings to board.
   */
  protected async executeTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    const result = await super.executeTool(toolName, args);

    if (toolName === 'save_bug' && !result.error && args.title) {
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
    return `Begin API testing for ${this.config.targetUrl}.

Start by calling read_board() to see what API endpoints Exploratory discovered.
For each endpoint, use browser_evaluate to run fetch() calls with edge cases:
- Empty body: fetch(url, { method, body: JSON.stringify({}) })
- Wrong types: send strings where numbers expected
- Check if 500 errors occur (should be 400 for bad input)

The browser is already logged in — cookies are attached to fetch() calls automatically.
Call save_bug() for every issue found. Say "AGENT_DONE" when all endpoints are tested.`;
  }

  protected getMaxLoops(): number {
    return 6;
  }

  private convertSchema(schema: any): z.ZodType {
    if (!schema || !schema.properties) return z.object({});
    const shape: Record<string, z.ZodType> = {};
    const required = new Set(schema.required || []);
    for (const [key, prop] of Object.entries(schema.properties)) {
      const p = prop as any;
      let t: z.ZodType;
      switch (p.type) {
        case 'string': t = z.string().describe(p.description || key); break;
        case 'number': case 'integer': t = z.number().describe(p.description || key); break;
        case 'boolean': t = z.boolean().describe(p.description || key); break;
        case 'array': t = z.array(z.any()).describe(p.description || key); break;
        default: t = z.any().describe(p.description || key);
      }
      shape[key] = required.has(key) ? t : t.optional();
    }
    return z.object(shape);
  }
}
