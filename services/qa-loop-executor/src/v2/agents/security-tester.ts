/**
 * Security Tester Agent — penetration testing for OWASP Top 10.
 *
 * Reads forms and pages discovered by Exploratory from the agent board,
 * then injects XSS/SQLi payloads, checks CSRF tokens, verifies HTTP
 * security headers, and tests auth bypass.
 *
 * Uses the SAME MCP browser instance as Exploratory (shared cookies).
 */
import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { AgentConfig } from '../types';
import { MCPBrowser } from '../../mcp-browser';
import { getToolSchemasForAgent, ToolSchema } from '../tools/agent-tools';
import { ToolResult } from '../../tool-executor';

export class SecurityTesterAgent extends BaseAgent {
  constructor(config: AgentConfig, mcpBrowser: MCPBrowser) {
    super(config, mcpBrowser);
  }

  protected buildToolSchemas(): Record<string, { description: string; parameters: z.ZodType }> {
    const agentTools = getToolSchemasForAgent('security');

    // Add browser tools needed for injection testing
    if (this.mcpBrowser) {
      const browserTools = this.mcpBrowser.getTools();
      const include = [
        'browser_navigate', 'browser_snapshot', 'browser_click',
        'browser_fill', 'browser_type', 'browser_evaluate',
        'browser_press_key',
      ];

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
   * Override executeTool to auto-write security findings to board.
   */
  protected async executeTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    const result = await super.executeTool(toolName, args);

    // Auto-write security bugs to board
    if (toolName === 'save_bug' && !result.error && args.title) {
      await this.boardTools.writeToBoard({
        type: 'security_issue',
        title: args.title,
        severity: args.severity || 'medium',
        page: args.page_url,
        description: args.description,
      }).catch(() => {});
    }

    return result;
  }

  protected getInitialPrompt(): string {
    return `Begin security testing for ${this.config.targetUrl}.

Start by calling read_board() to see what forms and pages Exploratory discovered.
For each form: navigate to the page, browser_snapshot, then test XSS and SQLi payloads via browser_fill.
Also check HTTP headers by running browser_evaluate with fetch() and inspecting response headers.
Call save_bug() for every vulnerability found. Say "AGENT_DONE" when all forms are tested.`;
  }

  protected getMaxLoops(): number {
    return 8;
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
