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
import { AgentEvent } from '../agent-event-bus';

import { ChromeDevToolsMCP, filterCdpToolsForAgent } from '../../chrome-devtools-mcp';

/**
 * In-memory record of a form discovered via the v4 event bus.
 * Phase 1 feeds these into the initial prompt. Phase 2 will consume them
 * from a live queue as they arrive during Security's run.
 */
interface QueuedForm {
  url: string;
  formId: string;
  fields: string[];
  method?: string;
  agent: string;
}

export class SecurityTesterAgent extends BaseAgent {
  /**
   * v4 Phase 1: forms observed via the AgentEventBus. Populated by
   * subscribeWithReplay in run() before the agent's AI loop starts.
   * Deduplicated by formId — the same form across multiple scan passes
   * collapses to one queue entry.
   */
  private formQueueFromBus: QueuedForm[] = [];

  constructor(
    config: AgentConfig,
    mcpBrowser: MCPBrowser,
    cdpMcp: ChromeDevToolsMCP | null = null,
  ) {
    super(config, mcpBrowser, cdpMcp);
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

    // Week 2: Chrome DevTools diagnostics — critical for header/CSP/CORS checks
    if (this.cdpMcp) {
      const cdpAllowed = filterCdpToolsForAgent('security', this.cdpMcp.getTools());
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
   * Override executeTool to auto-write security findings to board.
   */
  protected async executeTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    const result = await super.executeTool(toolName, args);

    // Auto-write security bugs to board (skip dedup'd)
    if (toolName === 'save_bug' && !result.error && !result.data?.deduplicated && args.title) {
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

  /**
   * v4 Phase 1: subscribe to the session bus's form.discovered stream
   * before the AI loop runs. In sequential scan mode (still the default
   * in Phase 1), Exploratory has already finished by the time Security
   * starts, so subscribeWithReplay delivers the full form history
   * synchronously — same effective data as the v3 read_board-on-start
   * path, but now plumbed through the event bus so Phase 2 can swap in
   * live delivery without touching the data contract.
   *
   * No-op (returns immediately) when the feature flag is off:
   * getEventBus() is null, and the queue stays empty so the existing
   * boardEntriesAtStart path in getInitialPrompt still drives prompt
   * content.
   */
  private hydrateFormQueueFromBus(): void {
    const bus = this.getEventBus();
    if (!bus) return;
    const seen = new Set<string>();
    bus.subscribeWithReplay('form.discovered', this.agentType, (e: AgentEvent) => {
      if (e.type !== 'form.discovered') return;
      if (seen.has(e.data.formId)) return;
      seen.add(e.data.formId);
      this.formQueueFromBus.push({
        url: e.data.url,
        formId: e.data.formId,
        fields: e.data.fields,
        method: e.data.method,
        agent: e.agent,
      });
    });
  }

  async run() {
    // Must hydrate BEFORE super.run() so getInitialPrompt sees the queue.
    this.hydrateFormQueueFromBus();
    return super.run();
  }

  protected getInitialPrompt(): string {
    // Task 4: board-derived context (forms + known issues) lives in the
    // user message, NOT the system prompt, so the system prompt stays
    // byte-stable across calls and Anthropic's ephemeral cache hits.
    let contextHeader = '';
    const contextMsg = this.contextBuilder.buildSecurityContextMessage(
      this.config.projectContext,
      this.boardEntriesAtStart,
    );
    if (contextMsg) {
      contextHeader = `CONTEXT FROM PRIOR AGENTS:\n\n${contextMsg}\n\n---\n\n`;
    }

    // v4 Phase 1: if the bus delivered any forms, append them to the
    // context header. Complements (does not replace) the board-derived
    // section so Scan B data is a superset of Scan A's — ensures we can
    // detect regressions from Scan A via the A/B comparison.
    if (this.formQueueFromBus.length > 0) {
      const lines = this.formQueueFromBus
        .slice(0, 20)
        .map(f =>
          `- ${f.method || 'POST'} ${f.url} [fields: ${f.fields.join(', ') || '(none listed)'}] ` +
          `(from ${f.agent})`,
        )
        .join('\n');
      const more = this.formQueueFromBus.length > 20
        ? `\n... and ${this.formQueueFromBus.length - 20} more (total ${this.formQueueFromBus.length}).`
        : '';
      contextHeader +=
        `LIVE FORM QUEUE (v4 event bus — form.discovered):\n${lines}${more}\n\n---\n\n`;
    }

    return `${contextHeader}Begin security testing for ${this.config.targetUrl}.

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
