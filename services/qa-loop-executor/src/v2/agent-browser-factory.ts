/**
 * AgentBrowserFactory — v4 Phase 2.
 *
 * v3 / Phase 1 ran one MCPBrowser + one ChromeDevToolsMCP per session,
 * shared sequentially across agents. Cookies / auth state persisted
 * naturally because there was only ever one live browser context.
 *
 * Phase 2 introduces parallel execution. Three agents (Exploratory,
 * Security, API Tester) now run simultaneously, so each needs its own
 * isolated browser pair — otherwise they'd race on the same page,
 * corrupt each other's cookies, and collide on CDP ports.
 *
 * This factory stands up a Playwright MCP + Chrome DevTools MCP pair
 * per agent. The pair is tagged with `${sessionId}-${agentType}` so
 * log lines / file paths / CDP ports stay distinguishable.
 *
 * Per-agent auth: each agent's browser performs the login flow
 * independently when credentials are provided. Cookies are private to
 * that Chromium instance — no shared cookie jar between agents. Agents
 * that need to correlate server state do so through the event bus or
 * the DB board, not the browser session.
 *
 * Resource envelope (documented for DevOps capacity planning):
 *   ~400–600 MB RAM per Chromium (MCPBrowser)
 *   ~150–300 MB RAM per chrome-devtools-mcp Chromium
 *   ~10–20% of one CPU core per active browser
 * For 3 parallel agents the worst-case footprint is roughly:
 *   3 × (600 + 300) ≈ 2.7 GB RAM
 *   ~60% of one core sustained, 100% peaks during snapshot/eval
 * Railway qa-loop-executor service must be provisioned ≥ 4 GB RAM to
 * stay below OOM thresholds with headroom for Node's own heap + the
 * orchestrator's per-agent logging.
 *
 * Feature flag: `ENABLE_V4_PARALLEL` (plus `ENABLE_V4_EVENT_BUS`).
 * When either is off, the orchestrator takes the v3 path and does NOT
 * call this factory — one shared MCPBrowser + one shared CDP instance.
 */
import { createLogger } from '../../../shared/logger/logger';
import { MCPBrowser } from '../mcp-browser';
import { ChromeDevToolsMCP } from '../chrome-devtools-mcp';
import { AgentType } from './types';

const logger = createLogger('agent-browser-factory');

export interface AgentBrowserPair {
  agentType: AgentType;
  playwright: MCPBrowser;
  cdp: ChromeDevToolsMCP | null;
  /** Monotonically-ish clock of when the pair actually finished start(). */
  readyAt: number;
  /** Browser pair id — useful for logs / file paths. */
  pairId: string;
}

export class AgentBrowserFactory {
  private sessionId: string;
  private spawned: AgentBrowserPair[] = [];

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Spawn a Playwright MCP + Chrome DevTools MCP pair for `agentType`.
   *
   * CDP startup is non-fatal — if chrome-devtools-mcp fails to boot
   * (npx cache cold, port clash, etc.) we return `cdp: null` so the
   * agent still runs on the Playwright MCP alone. Matches the
   * orchestrator's Phase 1 behavior on CDP failure.
   *
   * Port allocation: both MCPBrowser and ChromeDevToolsMCP currently
   * pick ephemeral OS-assigned ports internally. No action needed per
   * agent — the OS handles uniqueness. If we ever switch to fixed
   * ports, this factory is where the allocation lookup should live.
   */
  async spawnForAgent(agentType: AgentType): Promise<AgentBrowserPair> {
    const pairId = `${this.sessionId}-${agentType}`;

    logger.info('Spawning agent browser pair', {
      sessionId: this.sessionId,
      agentType,
      pairId,
    });

    // Playwright MCP instances identify themselves by session id only
    // today — passing a per-agent suffix keeps WebSocket + video frame
    // paths distinguishable without touching MCPBrowser internals.
    const playwright = new MCPBrowser(pairId);
    let cdp: ChromeDevToolsMCP | null = null;

    await playwright.start();

    try {
      cdp = new ChromeDevToolsMCP(pairId);
      await cdp.start();
    } catch (err: any) {
      logger.warn('Chrome DevTools MCP failed to start for agent — continuing without CDP', {
        sessionId: this.sessionId,
        agentType,
        error: err.message,
      });
      cdp = null;
    }

    const pair: AgentBrowserPair = {
      agentType,
      playwright,
      cdp,
      readyAt: Date.now(),
      pairId,
    };
    this.spawned.push(pair);

    logger.info('Agent browser pair ready', {
      sessionId: this.sessionId,
      agentType,
      pairId,
      cdpReady: cdp !== null,
    });

    return pair;
  }

  /**
   * Shut down every pair spawned by this factory. Called by the
   * orchestrator's `finally` block after parallel agents complete (or
   * throw). Each stop is best-effort — a single hung browser must not
   * prevent peer browsers from shutting down.
   */
  async disposeAll(): Promise<void> {
    const pending = this.spawned.map(async (pair) => {
      try { await pair.playwright.stop(); } catch (err: any) {
        logger.warn('Playwright MCP stop failed', {
          sessionId: this.sessionId,
          pairId: pair.pairId,
          error: err.message,
        });
      }
      if (pair.cdp) {
        try { await pair.cdp.forceStop(); } catch (err: any) {
          logger.warn('Chrome DevTools MCP stop failed', {
            sessionId: this.sessionId,
            pairId: pair.pairId,
            error: err.message,
          });
        }
      }
    });
    await Promise.allSettled(pending);
    this.spawned = [];
  }

  /** All pairs spawned so far — used by the v4Parallel telemetry block. */
  getSpawnedCount(): number {
    return this.spawned.length;
  }
}
