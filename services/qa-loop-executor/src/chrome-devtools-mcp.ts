/**
 * Chrome DevTools MCP client — a second MCP spawned alongside @playwright/mcp.
 *
 * Adds diagnostics tools the Playwright MCP doesn't have:
 *   - list_console_messages / get_console_message
 *   - list_network_requests / get_network_request
 *   - take_snapshot (accessibility tree)
 *   - performance_start_trace / performance_stop_trace
 *   - lighthouse_audit
 *   - take_memory_snapshot
 *
 * Lifecycle mirrors MCPBrowser exactly:
 *   - Per-session isolation (activeCdpMcps registry keyed by sessionId)
 *   - forceCleanup(sessionId?) for this session's instance + expired instances
 *   - SIGTERM-then-SIGKILL cleanup, matching MCPBrowser.forceStop()
 *
 * IMPORTANT (dual-browser note): Chrome DevTools MCP runs its OWN Chromium
 * instance. Playwright MCP runs a SEPARATE Chromium. They do NOT share
 * cookies/DOM state. For self-healing tests, the agent must re-drive the
 * page in the CDP browser before capturing console/network output.
 *
 * This is the pragmatic "Option B" from the Week 2 brief — the "Option A"
 * same-browser-attach via --browser-url was time-boxed because Playwright
 * MCP 0.0.68 does not expose the underlying Chromium's CDP endpoint, and
 * standing up our own chromium instance shared between both MCPs would
 * require adding `playwright` as a runtime dep to qa-loop-executor (it
 * currently only talks to Playwright via the MCP subprocess).
 *
 * Revisit once we've shipped Week 2 and measured whether the dual-browser
 * UX is good enough for the demo — if not, Week 3 upgrades to shared CDP.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import Anthropic from '@anthropic-ai/sdk';
import { ChildProcess } from 'child_process';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('chrome-devtools-mcp');

/** Prefix every exposed Chrome DevTools tool with cdp_ for disambiguation. */
export const CDP_TOOL_PREFIX = 'cdp_';

/**
 * Some chrome-devtools-mcp tools we intentionally never expose — input tools
 * (click, fill, etc.) overlap with Playwright MCP's and confuse the agent.
 * Keep this list conservative; add more if a scan logs "ambiguous tool" errors.
 */
const EXCLUDED_CDP_TOOLS = new Set<string>([
  'click',
  'fill',
  'type',
  'press_key',
  'navigate',
  'navigate_page',
  'close',
  'new_page',
  'select_page',
  // Additional overlaps revealed during staging — prune carefully
]);

export class ChromeDevToolsMCP {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private mcpProcess: ChildProcess | null = null;
  private tools: Anthropic.Tool[] = [];
  private sessionId: string;
  private isConnected = false;
  private isExecuting = false;
  private startedAt = 0;

  private static readonly MAX_MCP_DURATION_MS = 45 * 60 * 1000;
  private static activeCdpMcps = new Map<string, ChromeDevToolsMCP>();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /** Public read-only connection status (matches MCPBrowser.connected). */
  get connected(): boolean {
    return this.isConnected && this.client !== null;
  }

  /** Has this MCP exceeded the max duration? */
  isExpired(): boolean {
    if (this.startedAt === 0) return false;
    return Date.now() - this.startedAt > ChromeDevToolsMCP.MAX_MCP_DURATION_MS;
  }

  /**
   * Force-cleanup. Same semantics as MCPBrowser.forceCleanup:
   *   - with sessionId: kill only that session's CDP MCP
   *   - without: kill expired ones, skip actively-executing ones
   */
  static async forceCleanup(sessionId?: string): Promise<void> {
    if (sessionId) {
      const existing = ChromeDevToolsMCP.activeCdpMcps.get(sessionId);
      if (existing) {
        logger.warn('Force-cleaning up existing Chrome DevTools MCP', { sessionId });
        try {
          await existing.forceStop();
        } catch (err: any) {
          logger.warn('CDP forceCleanup: forceStop threw, ignoring', {
            sessionId, error: err.message,
          });
        }
        ChromeDevToolsMCP.activeCdpMcps.delete(sessionId);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      return;
    }

    const entries = Array.from(ChromeDevToolsMCP.activeCdpMcps.entries());
    let cleaned = 0;
    for (const [sid, mcp] of entries) {
      if (mcp.isExecuting) continue;
      if (mcp.isExpired()) {
        logger.warn('Force-cleaning up expired Chrome DevTools MCP', { sessionId: sid });
        try { await mcp.forceStop(); } catch { /* ignore */ }
        ChromeDevToolsMCP.activeCdpMcps.delete(sid);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  private killMcpProcess(): void {
    if (this.mcpProcess) {
      try {
        const pid = this.mcpProcess.pid;
        this.mcpProcess.kill('SIGKILL');
        logger.info('Killed Chrome DevTools MCP child process', { sessionId: this.sessionId, pid });
      } catch (err: any) {
        logger.warn('Failed to kill Chrome DevTools MCP child process', {
          sessionId: this.sessionId, error: err.message,
        });
      }
      this.mcpProcess = null;
    }
    try {
      if (this.transport) {
        (this.transport as any)?.close?.();
      }
    } catch { /* ignore */ }
  }

  async forceStop(): Promise<void> {
    logger.warn('Force-stopping Chrome DevTools MCP', { sessionId: this.sessionId });
    try {
      if (this.client && this.isConnected) {
        const closePromise = this.client.close();
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('CDP close timed out')), 5000),
        );
        await Promise.race([closePromise, timeoutPromise]);
      }
    } catch (error: any) {
      logger.warn('Graceful CDP close failed during force-stop, killing process', {
        sessionId: this.sessionId, error: error.message,
      });
    }
    this.killMcpProcess();
    this.client = null;
    this.transport = null;
    this.mcpProcess = null;
    this.isConnected = false;
    this.tools = [];
    this.startedAt = 0;
    ChromeDevToolsMCP.activeCdpMcps.delete(this.sessionId);
    logger.info('Chrome DevTools MCP force-stopped', { sessionId: this.sessionId });
  }

  /**
   * Start the chrome-devtools-mcp subprocess and connect.
   * Mirrors MCPBrowser.start() lifecycle exactly.
   */
  async start(): Promise<void> {
    await ChromeDevToolsMCP.forceCleanup(this.sessionId);
    await ChromeDevToolsMCP.forceCleanup();

    logger.info('Starting Chrome DevTools MCP server', { sessionId: this.sessionId });
    ChromeDevToolsMCP.activeCdpMcps.set(this.sessionId, this);

    // --headless: run without a visible window (required on Railway).
    // --isolated: fresh temp user-data dir per session, matches MCPBrowser's isolation.
    // We do NOT pass --browser-url — we're running standalone (Option B).
    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'chrome-devtools-mcp@latest', '--headless', '--isolated'],
    });

    this.client = new Client(
      { name: 'whynot-qa-cdp', version: '1.0.0' },
      { capabilities: {} },
    );

    await this.client.connect(this.transport);
    this.isConnected = true;
    this.startedAt = Date.now();

    const transportAny = this.transport as any;
    this.mcpProcess = (transportAny._process || transportAny.process || transportAny._subprocess || null) as ChildProcess | null;
    if (this.mcpProcess) {
      logger.info('Captured Chrome DevTools MCP child process', {
        sessionId: this.sessionId, pid: this.mcpProcess.pid,
      });
    }

    const { tools } = await this.client.listTools();
    // Prefix tool names with cdp_ (Week 2 brief Task 3) — disambiguates from
    // Playwright MCP's browser_* tools, makes log analysis trivial.
    this.tools = tools
      .filter(t => !EXCLUDED_CDP_TOOLS.has(t.name))
      .map(t => ({
        name: `${CDP_TOOL_PREFIX}${t.name}`,
        description: t.description || '',
        input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
      }));

    logger.info('Chrome DevTools MCP server started', {
      sessionId: this.sessionId,
      toolCount: this.tools.length,
      tools: this.tools.map(t => t.name),
    });
  }

  /** Anthropic-format tool list with cdp_ prefix applied. */
  getTools(): Anthropic.Tool[] {
    return this.tools;
  }

  /** True if the tool name belongs to this MCP (starts with cdp_). */
  isCdpTool(toolName: string): boolean {
    return toolName.startsWith(CDP_TOOL_PREFIX);
  }

  /**
   * Call a cdp_*-prefixed tool. Strips the prefix before forwarding to the
   * underlying MCP server. Output truncation for bulky responses is applied
   * at a higher layer (see cdp-tool-truncator.ts).
   */
  async callTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<{ data?: any; error?: string }> {
    if (!this.client || !this.isConnected) {
      return { error: 'Chrome DevTools MCP not connected' };
    }
    if (!this.isCdpTool(toolName)) {
      return { error: `Not a CDP tool: ${toolName}` };
    }

    const rawToolName = toolName.slice(CDP_TOOL_PREFIX.length);
    this.isExecuting = true;
    try {
      logger.info('CDP tool call', {
        sessionId: this.sessionId, tool: rawToolName, args: Object.keys(args),
      });

      const result = await this.client.callTool({
        name: rawToolName,
        arguments: args,
      });

      // Pass through raw content — truncation is the caller's job. chrome-devtools-mcp
      // returns content[] with type:'text' items just like Playwright MCP.
      const content = result.content as Array<{ type: string; text?: string }>;
      const textParts = content
        ?.filter(c => c.type === 'text')
        ?.map(c => c.text)
        ?.join('\n') || '';

      return { data: textParts || { success: true } };
    } catch (error: any) {
      logger.error('CDP tool call failed', {
        sessionId: this.sessionId, tool: rawToolName, error: error.message,
      });
      return { error: `CDP tool ${rawToolName} failed: ${error.message}` };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Graceful stop. Same semantics as MCPBrowser.stop — try close, then kill.
   */
  async stop(): Promise<void> {
    logger.info('Stopping Chrome DevTools MCP', { sessionId: this.sessionId });
    try {
      if (this.client && this.isConnected) {
        const closePromise = this.client.close();
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('CDP close timed out')), 5000),
        );
        await Promise.race([closePromise, timeoutPromise]);
      }
    } catch (err: any) {
      logger.warn('Error closing Chrome DevTools MCP, forcing cleanup', {
        sessionId: this.sessionId, error: err.message,
      });
    } finally {
      this.killMcpProcess();
      this.client = null;
      this.transport = null;
      this.mcpProcess = null;
      this.isConnected = false;
      this.tools = [];
      this.startedAt = 0;
      ChromeDevToolsMCP.activeCdpMcps.delete(this.sessionId);
      logger.info('Chrome DevTools MCP stopped', { sessionId: this.sessionId });
    }
  }
}

// ─── Per-agent tool whitelist (Task 3) ──────────────────────────────────
//
// Do NOT dump all 29 CDP tools into every agent — that would balloon the
// token budget. These whitelists are tight, cover the Week 2 demo
// moments (self-healing, network/console awareness), and match the
// Week 2 brief's table exactly.
//
// Names are the RAW CDP tool names (without the cdp_ prefix). Apply the
// prefix when checking against tool names returned by getTools().
const CDP_TOOLS_PER_AGENT: Record<string, Set<string>> = {
  exploratory: new Set([
    'list_console_messages',
    'list_network_requests',
    'take_snapshot',          // a11y tree — cheaper than full DOM
  ]),
  security: new Set([
    'list_network_requests',
    'get_network_request',    // full headers/body for a single request
    'list_console_messages',  // CSP violations, mixed-content warnings
  ]),
  api_tester: new Set([
    'list_network_requests',
    'get_network_request',
    'list_console_messages',
  ]),
  // Auto Tester does not touch a browser (dedicated Playwright-code gen).
  // Lighthouse intentionally OFF by default — gate behind ENABLE_LIGHTHOUSE
  // in a future task, it's expensive and not always demo-worthy.
};

/**
 * Filter a full CDP tool list down to what the given agent should see.
 * Returns the cdp_-prefixed tool subset, preserving description + schema.
 *
 * Pass the result of ChromeDevToolsMCP.getTools() here.
 */
export function filterCdpToolsForAgent(
  agentType: string,
  allCdpTools: Anthropic.Tool[],
): Anthropic.Tool[] {
  const allow = CDP_TOOLS_PER_AGENT[agentType];
  if (!allow) return [];
  return allCdpTools.filter(t => allow.has(t.name.replace(CDP_TOOL_PREFIX, '')));
}

// ─── Output truncation (Task 7) ──────────────────────────────────────────

const TRUNCATION_MARKER = '\n[... {N} chars truncated — call with specific filters for more]';

/**
 * Hard cap the string representation of a CDP tool result before it
 * enters the agent's conversation history. Keeps tokenDefsAvg in check
 * (we're also running compression on feat/prompt-compression).
 *
 * - cdp_list_network_requests: cap at 50 most recent
 * - cdp_list_console_messages: cap at 30 most recent
 * - cdp_lighthouse_audit: summary only unless fullReport=true
 * - Any other: cap at 5000 chars
 */
export function truncateCdpToolResult(
  toolName: string,
  rawResult: any,
  args: Record<string, any> = {},
): { truncated: any; charsDropped: number } {
  if (typeof rawResult !== 'string') {
    return { truncated: rawResult, charsDropped: 0 };
  }

  const name = toolName.replace(CDP_TOOL_PREFIX, '');
  const originalLen = rawResult.length;

  // list_network_requests / list_console_messages: line-based cap
  if (name === 'list_network_requests' || name === 'list_console_messages') {
    const limit = name === 'list_network_requests' ? 50 : 30;
    const lines = rawResult.split('\n');
    if (lines.length > limit) {
      const kept = lines.slice(-limit); // most recent = last
      const joined = kept.join('\n');
      const dropped = originalLen - joined.length;
      return {
        truncated:
          joined +
          TRUNCATION_MARKER.replace('{N}', String(dropped)),
        charsDropped: dropped,
      };
    }
  }

  // lighthouse_audit: enormous JSON — only summary unless fullReport
  if (name === 'lighthouse_audit' && !args.fullReport) {
    if (originalLen > 3000) {
      const truncated = rawResult.slice(0, 3000)
        + TRUNCATION_MARKER.replace('{N}', String(originalLen - 3000))
        + '\n[Pass fullReport=true for complete audit data]';
      return { truncated, charsDropped: originalLen - 3000 };
    }
  }

  // Generic 5000-char guard
  if (originalLen > 5000) {
    const truncated = rawResult.slice(0, 5000)
      + TRUNCATION_MARKER.replace('{N}', String(originalLen - 5000));
    return { truncated, charsDropped: originalLen - 5000 };
  }

  return { truncated: rawResult, charsDropped: 0 };
}
