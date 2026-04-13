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

Your first step: read_board() for forms discovered by Exploratory.

IF the board has fewer than 5 forms:
1. Navigate DIRECTLY to these key pages (they have known vulnerable forms):
   - /web/index.php/admin/viewSystemUsers
   - /web/index.php/admin/saveSystemUser
   - /web/index.php/pim/addEmployee
   - /web/index.php/admin/viewSystemRole
2. Call browser_snapshot() on each page
3. Discover forms directly and test them

IF the board has 5+ forms: proceed normally with board-driven testing.

FOR EACH FORM, run these tests via browser_fill / browser_evaluate:
- XSS: <script>alert(1)</script>, <img onerror=alert(1)>, javascript:alert(1)
- SQLi: ' OR 1=1--, '; DROP TABLE--, UNION SELECT
- CSRF: check for hidden token field in the form
- Auth bypass: try accessing admin pages without login

Also run browser_evaluate with fetch() to check HTTP response headers:
- Missing Content-Security-Policy
- Missing X-Frame-Options
- Missing X-Content-Type-Options
- Missing Strict-Transport-Security (HSTS)

OrangeHRM has known security issues worth checking:
- Missing X-Frame-Options (allows clickjacking)
- Weak CSP (allows inline scripts)
- Missing CSRF tokens on password reset
- Exposed credentials in demo environment
- Potential IDOR in admin user management (/admin/saveSystemUser?userId=...)

Call save_bug() for every vulnerability with title, description, severity.
Target: find 5+ security bugs per scan.
Say "AGENT_DONE" when all forms are tested and all headers checked.`;
  }

  protected getMaxLoops(): number {
    return 4; // 4 × 20 maxSteps = 80 tool calls, 4 API calls (was 8 × 8 = 64 tool calls, 8 API calls)
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
