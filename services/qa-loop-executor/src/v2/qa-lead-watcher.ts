/**
 * QALeadWatcher — v4 Phase 3.
 *
 * Phases 1 and 2 proved event-driven parallel agents. Phase 3 puts a
 * live QA Lead on top of that: a short-lived AI call every 90s that
 * watches the event stream + per-agent idle clocks and can dispatch
 * reassign / pause / resume / escalate / terminate events into the bus.
 *
 * Why a watcher (not a static planner):
 *   - Real QA leads don't just plan — they react. If Security is idle
 *     because Exploratory is churning on one giant page, the watcher
 *     can tell Security to help split the exploration.
 *   - Cost-bounded: 90s cadence × ~20 min scan = 13 invocations. Using
 *     Sonnet 4.6 at ~$0.005 per terse decide call = ~$0.065 per scan.
 *     Cheap compared to the ~$0.21 a Phase 2 scan costs overall.
 *   - Model choice: Sonnet, never Opus. Opus is reserved for the
 *     upfront plan + final synthesis pair where quality matters most.
 *
 * Feature flag: ENABLE_V4_DYNAMIC_LEAD (plus ENABLE_V4_PARALLEL, which
 * in turn plus ENABLE_V4_EVENT_BUS). Falls closed via isV4DynamicLeadEnabled
 * unless all three are on — in sequential mode there's nothing for the
 * watcher to reassign against.
 *
 * Scope boundary (explicit, per Phase 3 brief):
 *   - Does NOT change the DB schema
 *   - Does NOT add new specialist agents
 *   - Does NOT change the cost circuit breaker
 *   - DOES emit lead.* events on the bus so UI + agents can react
 *   - DOES log its own cost + invocation count into v4DynamicLead
 */
import { generateText, ModelMessage } from 'ai';
import { z } from 'zod';
import { createLogger } from '../../../shared/logger/logger';
import { AgentEventBus } from './agent-event-bus';
import { AgentType } from './types';
import { emitToSession } from '../api/websocket';
import { selectModel, computeCostCents } from './agents/base-agent';

const logger = createLogger('qa-lead-watcher');

/**
 * How often to invoke the watcher. 90s per brief — short enough to
 * catch idle agents before they waste budget, long enough to stay
 * under a buck per scan even on a 1h run.
 */
const WATCHER_POLL_MS = 90_000;

/**
 * An agent is considered "idle" if its last activity timestamp is
 * older than this threshold. Agents hit markActivity() on every
 * tool-call step and LLM-call completion, so a legitimate 3-min
 * generateText in flight should still look active to the watcher.
 */
const IDLE_THRESHOLD_MS = 180_000; // 3 minutes

/**
 * Information the orchestrator shares with the watcher about each
 * currently-running agent. Populated on demand — the watcher does NOT
 * hold references to the agent objects (that would make cleanup messy
 * on error paths). Instead the orchestrator implements this interface.
 */
export interface AgentRuntimeProbe {
  agentType: AgentType;
  lastActivityAt: number;
  pagesExplored: number;
  bugsFound: number;
  testsGenerated: number;
  /** True once the agent's run() has resolved (any status). */
  completed: boolean;
  /** If the watcher previously told this agent to pause, block dispatch. */
  pausedByLead: boolean;
}

export interface LeadDispatchSummary {
  watcherInvocations: number;
  reassignments: number;
  pauses: number;
  resumes: number;
  escalations: number;
  terminations: number;
  watcherCostCents: number;
  watcherTokensInput: number;
  watcherTokensOutput: number;
  notes: Array<{ at: string; note: string }>;
}

/**
 * Decision shape the model returns on each tick. Strictly JSON-schemable
 * so we can parse cheaply. `action: 'noop'` is explicitly allowed — the
 * watcher should NOT act unless there's a real reason.
 */
const DecisionSchema = z.object({
  action: z.enum(['noop', 'reassign', 'pause', 'resume', 'escalate', 'terminate']),
  target: z.enum(['exploratory', 'security', 'api_tester', 'auto_tester']).optional(),
  reason: z.string().max(500),
  // For reassign: the new objective to inject into target's next loop.
  newObjective: z.string().max(500).optional(),
  // For escalate: a known bug id + the peers to loop in.
  bugId: z.string().optional(),
  notifyAgents: z.array(z.enum(['exploratory', 'security', 'api_tester', 'auto_tester'])).optional(),
});

export class QALeadWatcher {
  private sessionId: string;
  private bus: AgentEventBus;
  private probe: () => AgentRuntimeProbe[];
  private summary: LeadDispatchSummary = {
    watcherInvocations: 0,
    reassignments: 0,
    pauses: 0,
    resumes: 0,
    escalations: 0,
    terminations: 0,
    watcherCostCents: 0,
    watcherTokensInput: 0,
    watcherTokensOutput: 0,
    notes: [],
  };
  private stopFlag = false;
  private lastTickAt = 0;
  private backgroundPromise: Promise<void> | null = null;

  constructor(
    sessionId: string,
    bus: AgentEventBus,
    probe: () => AgentRuntimeProbe[],
  ) {
    this.sessionId = sessionId;
    this.bus = bus;
    this.probe = probe;
  }

  /** Start the watcher loop in the background. Safe to call once. */
  start(): void {
    if (this.backgroundPromise) return;
    this.backgroundPromise = this.loop();
    logger.info('QA Lead watcher started', {
      sessionId: this.sessionId,
      pollMs: WATCHER_POLL_MS,
      idleThresholdMs: IDLE_THRESHOLD_MS,
    });
  }

  /** Stop the loop. Safe to call multiple times. */
  stop(): void {
    this.stopFlag = true;
  }

  /** Wait for the background loop to fully exit. */
  async join(): Promise<void> {
    this.stopFlag = true;
    if (this.backgroundPromise) await this.backgroundPromise.catch(() => {});
  }

  /** Final telemetry rollup for the v4DynamicLead breakdown log. */
  getSummary(): LeadDispatchSummary {
    return { ...this.summary, notes: [...this.summary.notes] };
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private async loop(): Promise<void> {
    while (!this.stopFlag) {
      try {
        await this.sleep(WATCHER_POLL_MS);
        if (this.stopFlag) break;
        await this.tick();
      } catch (err: any) {
        // A tick failure must not kill the watcher — log and continue.
        logger.warn('QA Lead watcher tick threw', {
          sessionId: this.sessionId,
          error: err?.message,
        });
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      if (typeof (t as any).unref === 'function') (t as any).unref();
    });
  }

  private async tick(): Promise<void> {
    // Bail if the scan has been halted (cost cap, user stop, etc).
    if (this.bus.isScanHalted()) return;

    const agents = this.probe();
    // Nothing to coordinate if every agent is done already.
    if (agents.every(a => a.completed)) {
      this.stop();
      return;
    }

    const now = Date.now();
    const idleAgents = agents.filter(a =>
      !a.completed && !a.pausedByLead && (now - a.lastActivityAt) >= IDLE_THRESHOLD_MS,
    );

    // Fast path: if nobody is idle, skip the AI call entirely. Keeps
    // cost near zero on healthy scans — the watcher only spends money
    // when there's real coordination value on the table.
    if (idleAgents.length === 0) {
      this.summary.notes.push({
        at: new Date().toISOString(),
        note: 'tick: all agents busy — no action',
      });
      return;
    }

    this.summary.watcherInvocations++;
    this.lastTickAt = now;
    const decision = await this.askModelForDecision(agents, idleAgents);
    if (!decision) return;

    await this.executeDecision(decision);
  }

  private buildPrompt(agents: AgentRuntimeProbe[], idle: AgentRuntimeProbe[]): string {
    const lines: string[] = [];
    lines.push('You are the live QA Lead watcher for an in-progress parallel QA scan.');
    lines.push('Your role: observe the agent team and, ONLY when necessary, issue one dispatch.');
    lines.push('');
    lines.push(`Agents (idle = no tool activity for >= ${Math.round(IDLE_THRESHOLD_MS / 1000)}s):`);
    for (const a of agents) {
      const idleSecs = Math.round((Date.now() - a.lastActivityAt) / 1000);
      lines.push(
        `  - ${a.agentType}: ${a.completed ? 'COMPLETE' : 'RUNNING'}, ` +
        `idle=${idleSecs}s, pages=${a.pagesExplored}, bugs=${a.bugsFound}, tests=${a.testsGenerated}` +
        `${a.pausedByLead ? ', PAUSED_BY_LEAD' : ''}`,
      );
    }
    lines.push('');
    lines.push(`Idle agents this tick: ${idle.map(a => a.agentType).join(', ') || 'none'}`);
    lines.push('');
    lines.push('Choose one action:');
    lines.push('  - "noop": do nothing. Pick this unless reassignment clearly helps.');
    lines.push('  - "reassign": redirect an idle agent to help a busy one. Provide target + newObjective (1 sentence).');
    lines.push('  - "pause": pause a misbehaving agent (e.g. stuck in a loop). Provide target + reason.');
    lines.push('  - "resume": un-pause a previously paused agent.');
    lines.push('  - "escalate": mark a critical bug for peers to verify. Provide bugId + notifyAgents.');
    lines.push('  - "terminate": end the scan early (only if completion criteria met).');
    lines.push('');
    lines.push('Rules:');
    lines.push('  1. Prefer "noop" unless there is a concrete, specific improvement.');
    lines.push('  2. Never reassign an agent that is actively producing tool calls.');
    lines.push('  3. Never terminate before every live agent has emitted at least one bug OR test.');
    lines.push('  4. Keep reason and newObjective short (< 200 chars each).');
    lines.push('');
    lines.push('Respond ONLY with strict JSON matching:');
    lines.push('{ "action": "...", "target"?: "...", "reason": "...", "newObjective"?: "...", "bugId"?: "...", "notifyAgents"?: [...] }');
    return lines.join('\n');
  }

  private async askModelForDecision(
    agents: AgentRuntimeProbe[],
    idle: AgentRuntimeProbe[],
  ): Promise<z.infer<typeof DecisionSchema> | null> {
    // Force Sonnet for cost. Opus is reserved for plan + synthesis.
    const { model, modelId } = selectModel('security');
    const prompt = this.buildPrompt(agents, idle);
    const messages: ModelMessage[] = [{ role: 'user', content: prompt }];

    try {
      const result = await generateText({
        model,
        system: 'You are a terse coordinator. Output strict JSON only — no prose.',
        messages,
        maxOutputTokens: 300,
        ...(modelId.startsWith('claude') ? {
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral' as const, ttl: '5m' as const },
            },
          },
        } : {}),
      });

      const inputTokens = (result.usage as any)?.inputTokens ?? 0;
      const outputTokens = (result.usage as any)?.outputTokens ?? 0;
      const cachedInput = (result.usage as any)?.cachedInputTokens ?? 0;
      const costCents = computeCostCents(modelId, inputTokens, outputTokens, cachedInput);
      this.summary.watcherCostCents += costCents;
      this.summary.watcherTokensInput += inputTokens;
      this.summary.watcherTokensOutput += outputTokens;

      const text = (result.text || '').trim();
      // Strip optional markdown fences the model sometimes adds.
      const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      const parsed = DecisionSchema.safeParse(JSON.parse(cleaned));
      if (!parsed.success) {
        logger.warn('Watcher decision JSON invalid — treating as noop', {
          sessionId: this.sessionId,
          raw: cleaned.slice(0, 200),
          issues: parsed.error.issues.slice(0, 3),
        });
        return null;
      }
      if (parsed.data.action === 'noop') {
        this.summary.notes.push({
          at: new Date().toISOString(),
          note: `noop: ${parsed.data.reason.slice(0, 120)}`,
        });
        return null;
      }
      return parsed.data;
    } catch (err: any) {
      logger.warn('Watcher decide call failed — treating as noop', {
        sessionId: this.sessionId,
        error: err?.message,
      });
      return null;
    }
  }

  private async executeDecision(d: z.infer<typeof DecisionSchema>): Promise<void> {
    const at = new Date().toISOString();
    switch (d.action) {
      case 'reassign':
        if (!d.target || !d.newObjective) return;
        this.bus.publish({
          type: 'lead.reassign',
          agent: 'qa_lead',
          at,
          data: { target: d.target as AgentType, reason: d.reason, newObjective: d.newObjective },
        });
        this.summary.reassignments++;
        this.summary.notes.push({ at, note: `reassign -> ${d.target}: ${d.reason.slice(0, 80)}` });
        this.emitUiStatus(`Lead reassigned ${d.target}: ${d.reason}`);
        break;
      case 'pause':
        if (!d.target) return;
        this.bus.publish({
          type: 'lead.pause',
          agent: 'qa_lead',
          at,
          data: { target: d.target as AgentType, reason: d.reason },
        });
        this.summary.pauses++;
        this.summary.notes.push({ at, note: `pause -> ${d.target}: ${d.reason.slice(0, 80)}` });
        this.emitUiStatus(`Lead paused ${d.target}: ${d.reason}`);
        break;
      case 'resume':
        if (!d.target) return;
        this.bus.publish({
          type: 'lead.resume',
          agent: 'qa_lead',
          at,
          data: { target: d.target as AgentType, reason: d.reason },
        });
        this.summary.resumes++;
        this.summary.notes.push({ at, note: `resume -> ${d.target}: ${d.reason.slice(0, 80)}` });
        break;
      case 'escalate':
        if (!d.bugId) return;
        this.bus.publish({
          type: 'lead.escalate',
          agent: 'qa_lead',
          at,
          data: {
            bugId: d.bugId,
            reason: d.reason,
            notifyAgents: (d.notifyAgents || []) as AgentType[],
          },
        });
        this.summary.escalations++;
        this.summary.notes.push({ at, note: `escalate bug ${d.bugId}: ${d.reason.slice(0, 80)}` });
        break;
      case 'terminate':
        this.bus.publish({
          type: 'lead.terminate',
          agent: 'qa_lead',
          at,
          data: { reason: d.reason },
        });
        this.summary.terminations++;
        this.summary.notes.push({ at, note: `terminate: ${d.reason.slice(0, 80)}` });
        this.stop();
        break;
    }
  }

  private emitUiStatus(message: string): void {
    try {
      emitToSession(this.sessionId, {
        type: 'lead_dispatch',
        data: { agent: 'qa_lead', message },
      });
    } catch { /* non-fatal */ }
  }
}
