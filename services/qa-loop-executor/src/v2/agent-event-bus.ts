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
  | { type: 'test.saved';          agent: AgentType; at: string; data: { testCaseId: string; name: string; category?: string } };

export type AgentEventType = AgentEvent['type'];

/**
 * Check the feature flag in one place. Orchestrator reads this at scan
 * start; if false, it passes `null` to every agent and the emit/subscribe
 * paths all no-op (see the `if (!bus) return` guards at each call site).
 */
export function isV4EventBusEnabled(): boolean {
  return process.env.ENABLE_V4_EVENT_BUS === 'true';
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

  constructor(sessionId: string) {
    super();
    this.setMaxListeners(20);
    this.sessionId = sessionId;
  }

  /**
   * Publish an event. Appends to the persistent log so late
   * subscribers can replay, then fires the typed listener and a
   * wildcard `*` listener for generic logging / telemetry.
   */
  publish(event: AgentEvent): void {
    this.events.push(event);
    logger.debug('event bus publish', {
      sessionId: this.sessionId,
      type: event.type,
      agent: event.agent,
      at: event.at,
    });
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

  /** Event counts grouped by type — fed into the breakdown log. */
  eventCountsByType(): Record<AgentEventType, number> {
    const counts: Record<string, number> = {
      'page.discovered': 0,
      'form.discovered': 0,
      'endpoint.discovered': 0,
      'bug.confirmed': 0,
      'test.saved': 0,
    };
    for (const ev of this.events) counts[ev.type]++;
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
