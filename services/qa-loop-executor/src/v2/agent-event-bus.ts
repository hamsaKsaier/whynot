/**
 * Agent Event Bus — Phase 1 of v4 "Real QA Team" architecture.
 *
 * v3 architecture was waterfall: each agent runs alone, writes to the
 * DB-backed AgentBoard on exit, then the next agent reads the board
 * once on start. Between agents there's no live communication.
 *
 * Phase 1 adds an in-memory event emitter that sits alongside the
 * existing AgentBoard. When an agent writes a discovery, bug, or test
 * case, we ALSO publish a typed event so any peer that is currently
 * running (or starts later) can react to it. The DB board stays the
 * persistent record — the event bus is the live stream.
 *
 * Phase 1 scope: emit events, let Security subscribe. No parallelism
 * yet — agents still run sequentially. The bus buffers every event in
 * `this.events` so late subscribers (the current sequential callers)
 * receive the full history via `subscribeWithReplay`. Phase 2 will use
 * the same bus to coordinate concurrent agents.
 *
 * Feature-flag gated: `ENABLE_V4_EVENT_BUS=true` activates publishing
 * + subscribing. Default off — agents fall back to the v3 board-on-start
 * read path.
 *
 * One bus instance per session. Garbage-collected with the orchestrator
 * when the scan completes.
 */
import { EventEmitter } from 'events';
import { AgentType } from './types';
import { createLogger } from '../../../shared/logger/logger';

const logger = createLogger('agent-event-bus');

export type AgentEvent =
  | { type: 'page.discovered';     agent: AgentType; at: string; data: { url: string; pageId: string; authRequired?: boolean } }
  | { type: 'form.discovered';     agent: AgentType; at: string; data: { url: string; formId: string; fields: string[]; method?: string } }
  | { type: 'endpoint.discovered'; agent: AgentType; at: string; data: { url: string; method: string; path?: string } }
  | { type: 'bug.confirmed';       agent: AgentType; at: string; data: { bugId: string; severity: string; title: string; pageUrl?: string } }
  | { type: 'test.saved';          agent: AgentType; at: string; data: { testCaseId: string; name: string; category?: string } }
  // v4 Phase 2: lifecycle events used by parallel agents to coordinate
  // without polling the DB. agent.complete tells subscribers (e.g.
  // Security waiting on Exploratory's forms) to stop idling. The string
  // 'orchestrator' carrier is accepted for scan-scoped events.
  | { type: 'agent.complete';      agent: AgentType; at: string; data: { status: 'done' | 'error' | 'killed_idle'; pagesExplored?: number; bugsFound?: number } }
  | { type: 'scan.cost_cap_hit';   agent: 'orchestrator' | AgentType; at: string; data: { trackedCostCents: number; estimatedRealCostCents: number; capCents: number } }
  // v4 Phase 3: dynamic QA Lead dispatches. The watcher (a background
  // AI call loop) observes agent activity every 90s and can redirect,
  // pause, resume, escalate, or terminate agents mid-scan. Each agent
  // subscribes to the subset of events addressed to it (via data.target
  // or data.targets) and surfaces the dispatch text into its next
  // generateText invocation as a "LEAD DISPATCH" context block.
  | { type: 'lead.reassign';       agent: 'qa_lead'; at: string; data: { target: AgentType; reason: string; newObjective: string } }
  | { type: 'lead.pause';          agent: 'qa_lead'; at: string; data: { target: AgentType; reason: string } }
  | { type: 'lead.resume';         agent: 'qa_lead'; at: string; data: { target: AgentType; reason: string } }
  | { type: 'lead.escalate';       agent: 'qa_lead'; at: string; data: { bugId: string; reason: string; notifyAgents: AgentType[] } }
  | { type: 'lead.terminate';      agent: 'qa_lead'; at: string; data: { reason: string } };

export type AgentEventType = AgentEvent['type'];

/**
 * v4 Phase 2 backpressure: cap per-type event retention so a runaway
 * publisher (e.g. Exploratory emitting 100 pages/sec) does not grow the
 * replay buffer unboundedly. Sized generously — 1000 events × 5 types =
 * 5000 retained, still O(tens of KB) in memory. Overflows log once.
 */
const MAX_EVENTS_PER_TYPE = 1000;

/**
 * Check the feature flag in one place. Orchestrator reads this at scan
 * start; if false, it passes `null` to every agent and the emit/subscribe
 * paths all no-op (see the `if (!bus) return` guards at each call site).
 */
export function isV4EventBusEnabled(): boolean {
  return process.env.ENABLE_V4_EVENT_BUS === 'true';
}

/**
 * v4 Phase 2: parallel execution flag. Requires the event bus to also
 * be on — parallel agents coordinate entirely through the bus.
 */
export function isV4ParallelEnabled(): boolean {
  return process.env.ENABLE_V4_PARALLEL === 'true' && isV4EventBusEnabled();
}

/**
 * v4 Phase 3: dynamic QA Lead watcher. Requires parallel mode — the
 * watcher's only value-add is reassigning idle parallel agents; in
 * sequential mode there's nothing to reassign against. Fails closed.
 */
export function isV4DynamicLeadEnabled(): boolean {
  return process.env.ENABLE_V4_DYNAMIC_LEAD === 'true' && isV4ParallelEnabled();
}

/**
 * In-memory pub/sub for a single scan's agent events.
 *
 * Listener limit: 4 agents × 5 event types = 20, matches brief. Extra
 * listeners log a warning so a runaway subscribe loop is visible.
 */
export class AgentEventBus extends EventEmitter {
  public readonly sessionId: string;

  /** Full event log in arrival order. Used by subscribeWithReplay. */
  private events: AgentEvent[] = [];

  /** Per-agent subscription record for the instrumentation block. */
  private subscribersByAgent: Record<string, Set<AgentEventType>> = {};

  /** Per-type count used for backpressure enforcement (Phase 2). */
  private countsByType: Record<string, number> = {};

  /** One-shot log tag so overflow is reported exactly once per type. */
  private overflowLogged: Set<string> = new Set();

  /** Phase 2: agents observe this via `on('scan.cost_cap_hit', ...)` to exit early. */
  private scanHaltedFlag = false;

  constructor(sessionId: string) {
    super();
    // Phase 2: 20 listeners was sized for Phase 1 (sequential). Parallel
    // agents plus lifecycle listeners push us higher — 50 gives headroom
    // without masking a genuine subscribe-leak bug if one ever appears.
    this.setMaxListeners(50);
    this.sessionId = sessionId;
  }

  /** True once a scan.cost_cap_hit event has been published. */
  isScanHalted(): boolean {
    return this.scanHaltedFlag;
  }

  /**
   * Publish an event. Appends to the persistent log so late
   * subscribers can replay, then fires the typed listener and a
   * wildcard `*` listener for generic logging / telemetry.
   */
  publish(event: AgentEvent): void {
    // Phase 2 backpressure: stop appending once a type hits the cap. We
    // still fire the listener so live subscribers keep receiving events,
    // but the replay buffer stops growing. Logged once per type so the
    // signal is visible in Railway logs without flooding.
    const typeCount = this.countsByType[event.type] || 0;
    if (typeCount < MAX_EVENTS_PER_TYPE) {
      this.events.push(event);
      this.countsByType[event.type] = typeCount + 1;
    } else if (!this.overflowLogged.has(event.type)) {
      this.overflowLogged.add(event.type);
      logger.warn('event bus replay cap reached — live delivery only from here', {
        sessionId: this.sessionId,
        type: event.type,
        cap: MAX_EVENTS_PER_TYPE,
      });
    }
    logger.debug('event bus publish', {
      sessionId: this.sessionId,
      type: event.type,
      agent: event.agent,
      at: event.at,
    });
    if (event.type === 'scan.cost_cap_hit') this.scanHaltedFlag = true;
    this.emit(event.type, event);
    this.emit('*', event);
  }

  /**
   * Subscribe + replay. The handler is called synchronously for every
   * matching event already in the log, then registered for future events.
   *
   * Records the subscription for the `subscribersByAgent` telemetry block
   * so the scan breakdown log shows which agents consumed which streams.
   */
  subscribeWithReplay(
    type: AgentEventType,
    subscriber: AgentType,
    handler: (e: AgentEvent) => void,
  ): void {
    const slot = this.subscribersByAgent[subscriber] ?? (this.subscribersByAgent[subscriber] = new Set());
    slot.add(type);

    // Replay history first — the handler sees events in original arrival
    // order. In sequential-scan mode this is how Security actually gets
    // its form queue today (all replayed because Exploratory finished
    // before Security subscribes). In Phase 2 parallel mode the same
    // code also receives live events after the replay completes.
    for (const ev of this.events) {
      if (ev.type === type) {
        try { handler(ev); } catch (err: any) {
          logger.warn('subscribeWithReplay replay handler threw', {
            sessionId: this.sessionId,
            subscriber,
            type,
            error: err.message,
          });
        }
      }
    }
    this.on(type, handler);
  }

  // ─── Telemetry accessors ──────────────────────────────────────────────

  /** Number of events published on this bus so far. */
  totalEvents(): number {
    return this.events.length;
  }

  /**
   * Event counts grouped by type — fed into the breakdown log.
   * Uses the per-type counter so overflowed events still count, even
   * after they drop out of the replay buffer.
   */
  eventCountsByType(): Record<AgentEventType, number> {
    const counts: Record<string, number> = {
      'page.discovered': 0,
      'form.discovered': 0,
      'endpoint.discovered': 0,
      'bug.confirmed': 0,
      'test.saved': 0,
      'agent.complete': 0,
      'scan.cost_cap_hit': 0,
      'lead.reassign': 0,
      'lead.pause': 0,
      'lead.resume': 0,
      'lead.escalate': 0,
      'lead.terminate': 0,
    };
    for (const [k, v] of Object.entries(this.countsByType)) counts[k] = v;
    return counts as Record<AgentEventType, number>;
  }

  /** Which agent subscribed to which event types. */
  subscriberMap(): Record<string, AgentEventType[]> {
    const out: Record<string, AgentEventType[]> = {};
    for (const [agent, types] of Object.entries(this.subscribersByAgent)) {
      out[agent] = Array.from(types);
    }
    return out;
  }

  /** Snapshot of the full event log (cheap — we own the array). */
  snapshot(): ReadonlyArray<AgentEvent> {
    return this.events;
  }
}

/**
 * Deterministic form ID used to dedupe events across multiple
 * Exploratory passes. Phase 1's board does not persist forms as rows
 * with their own UUIDs, so we hash (url, fields) into a stable string.
 * Collisions between genuinely different forms on the same URL are
 * acceptable — Security only cares about the (url, fields) tuple.
 */
export function deriveFormId(url: string, fields: string[]): string {
  const fieldKey = [...(fields || [])].sort().join(',');
  // Short, human-readable — easier to eyeball in the event log than a hash.
  return `${url}#${fieldKey}`;
}
