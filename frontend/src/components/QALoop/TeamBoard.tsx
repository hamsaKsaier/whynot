/**
 * TeamBoard — the QA team board.
 *
 * Renders the five agents as an org chart: the QA Lead at the head with the
 * four specialists beneath it, connected by lines. Whoever is currently
 * working lights up, and their activity streams into a shared feed, so a scan
 * reads as a team working rather than a progress bar moving.
 *
 * Every datum comes from the existing websocket stream (`agentStreams` from
 * useQALoopStream), which already tags each thinking / tool_call / bug_found
 * event with the emitting `agent`. Nothing here is scripted or simulated —
 * if an agent is quiet on the board, it is quiet in the scan.
 *
 * Click an agent to drill into its full thinking and tool calls; "Back to
 * board" returns to watching the team.
 *
 * Styling follows the project's Uncodixify rules: no lift, scale, shadow
 * escalation, gradients or decorative pulsing. "Lighting up" is a border and
 * ring colour change over 150ms — the only motion is the Loader2 spinner.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Loader2, ArrowLeft, Compass, ShieldAlert, Plug, Hammer, Crown, CheckCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AgentStreamSlice, LeadDispatch } from '../../hooks/useQALoopStream';

const LEAD: AgentKey = 'qa_lead';
const SPECIALISTS = ['exploratory', 'security', 'api_tester', 'auto_tester', 'verifier'] as const;

type AgentKey = 'qa_lead' | typeof SPECIALISTS[number];

interface AgentProfile {
  title: string;
  persona: string;
  role: string;
  Icon: typeof Compass;
}

/** Personalities are fixed per the team-board spec — they give each bot a voice. */
const PROFILES: Record<AgentKey, AgentProfile> = {
  qa_lead: {
    title: 'QA Lead',
    persona: 'the strategist',
    role: 'Plans the scan, watches the team, reassigns and escalates.',
    Icon: Crown,
  },
  exploratory: {
    title: 'Exploratory',
    persona: 'the wanderer',
    role: 'Wanders the app, mapping pages, forms and flows.',
    Icon: Compass,
  },
  security: {
    title: 'Security',
    persona: 'the paranoid',
    role: 'Assumes the worst — probes inputs, auth and headers.',
    Icon: ShieldAlert,
  },
  api_tester: {
    title: 'API Tester',
    persona: 'the edge-caser',
    role: 'Pushes endpoints past what the happy path expects.',
    Icon: Plug,
  },
  auto_tester: {
    title: 'Auto Tester',
    persona: 'the builder',
    role: 'Turns confirmed findings into Playwright regression tests.',
    Icon: Hammer,
  },
  verifier: {
    title: 'Verifier',
    persona: 'the skeptic',
    role: 'Reproduces every reported bug and throws out the ones that do not hold up.',
    Icon: CheckCheck,
  },
};

/** An agent counts as "speaking" if it acted within this window. */
const ACTIVE_WINDOW_MS = 15_000;
/** Past this, an agent looks stuck rather than merely thinking. */
const STALE_WINDOW_MS = 120_000;

type AgentState = 'working' | 'idle' | 'stalled' | 'waiting' | 'done';

/**
 * Agent state, honestly.
 *
 * "Stalled" used to be derived from elapsed silence alone — but agents run in
 * turns. The Lead plans early then waits for synthesis; each specialist works
 * once then hands off. So a quiet agent is almost always *between turns or
 * finished*, not stuck — yet the old rule painted all of them amber "stalled"
 * (which reads as an error) the moment their turn ended. `anyWorking` fixes
 * this: while someone on the team is active, a quiet agent is simply calm.
 *
 * "Stalled" now means what it should — the whole board has gone silent while
 * the scan claims to be running, i.e. an actual hang. Nothing else is amber.
 */
function stateOf(
  slice: AgentStreamSlice | undefined,
  now: number,
  isRunning: boolean,
  anyWorking: boolean,
): AgentState {
  if (!slice?.lastActivityTs) return isRunning ? 'waiting' : 'idle';
  if (!isRunning) return 'done';

  const since = now - slice.lastActivityTs;
  if (since < ACTIVE_WINDOW_MS) return 'working';

  // Scan is running but this agent is quiet. If a teammate is active, this
  // agent has simply had (or not yet reached) its turn — calm, not stuck.
  if (anyWorking) return 'idle';

  // Nobody is working and the whole board has been silent a long time: a real
  // hang. Only here is "stalled" earned.
  if (since >= STALE_WINDOW_MS) return 'stalled';
  return 'idle';
}

/** True if any agent acted within the active window — the team is doing something. */
function anyAgentWorking(streams: Record<string, AgentStreamSlice>, now: number): boolean {
  return Object.values(streams).some(
    s => s?.lastActivityTs != null && now - s.lastActivityTs < ACTIVE_WINDOW_MS,
  );
}

/** Last non-empty line of an agent's thinking — what it is "saying" right now. */
function latestLine(slice: AgentStreamSlice | undefined): string | null {
  if (!slice?.thinkingText) return null;
  const lines = slice.thinkingText.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : null;
}

interface TeamBoardProps {
  agentStreams: Record<string, AgentStreamSlice>;
  leadDispatches: LeadDispatch[];
  isRunning: boolean;
}

export function TeamBoard({ agentStreams, leadDispatches, isRunning }: TeamBoardProps) {
  const [focused, setFocused] = useState<AgentKey | null>(null);

  // One timer for the whole board. Agent state is derived from "time since
  // last activity", so the board must re-render on a clock tick, not only
  // when a websocket event arrives — otherwise a bot that stops working
  // stays lit up forever. Stops ticking when the scan ends.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const anyWorking = anyAgentWorking(agentStreams, now);

  if (focused) {
    return (
      <AgentDetail
        agent={focused}
        slice={agentStreams[focused]}
        leadDispatches={leadDispatches}
        now={now}
        isRunning={isRunning}
        anyWorking={anyWorking}
        onBack={() => setFocused(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-semibold">QA Team</h3>
              <p className="text-sm text-muted-foreground">
                Five agents working your app. Select one to see what it is doing.
              </p>
            </div>
            {isRunning && (
              <Badge variant="outline" className="gap-1.5 flex-shrink-0">
                <Loader2 className="h-3 w-3 animate-spin" />
                Scan running
              </Badge>
            )}
          </div>

          {/* ── Org chart ──────────────────────────────────────────────── */}
          <div className="flex flex-col items-center">
            <div className="w-full max-w-sm">
              <AgentNode
                agent={LEAD}
                slice={agentStreams[LEAD]}
                now={now}
                isRunning={isRunning}
                anyWorking={anyWorking}
                onSelect={() => setFocused(LEAD)}
              />
            </div>

            {/* Connectors: a stem from the lead, a spine across the team, and
                a stub down to each specialist. Hidden on narrow screens where
                the cards stack and the lines would be meaningless. */}
            <div className="h-4 w-px bg-border" aria-hidden="true" />
            <div className="hidden md:block h-px w-3/4 bg-border" aria-hidden="true" />
            <div className="hidden md:flex w-3/4 justify-around" aria-hidden="true">
              {SPECIALISTS.map(a => <div key={a} className="h-4 w-px bg-border" />)}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full mt-3 md:mt-0">
              {SPECIALISTS.map(agent => (
                <AgentNode
                  key={agent}
                  agent={agent}
                  slice={agentStreams[agent]}
                  now={now}
                  isRunning={isRunning}
                  anyWorking={anyWorking}
                  onSelect={() => setFocused(agent)}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <TeamFeed agentStreams={agentStreams} leadDispatches={leadDispatches} />
    </div>
  );
}

// ─── One bot on the board ────────────────────────────────────────────────

interface AgentNodeProps {
  agent: AgentKey;
  slice: AgentStreamSlice | undefined;
  now: number;
  isRunning: boolean;
  anyWorking: boolean;
  onSelect: () => void;
}

function AgentNode({ agent, slice, now, isRunning, anyWorking, onSelect }: AgentNodeProps) {
  const profile = PROFILES[agent];
  const state = stateOf(slice, now, isRunning, anyWorking);
  const line = latestLine(slice);
  const { Icon } = profile;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${profile.title} — ${state}`}
      className={cn(
        'w-full text-start rounded-lg border bg-card p-3 shadow-sm',
        'transition-colors duration-150 hover:bg-muted/50',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        // "Lights up" while speaking: colour only, no motion or depth change.
        state === 'working' && 'border-primary ring-1 ring-primary',
        state === 'stalled' && 'border-amber-500/60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn('h-4 w-4 flex-shrink-0', state === 'working' ? 'text-primary' : 'text-muted-foreground')} />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{profile.title}</div>
            <div className="text-xs text-muted-foreground truncate">{profile.persona}</div>
          </div>
        </div>
        <StateBadge state={state} />
      </div>

      <p className="mt-2 text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
        {line || profile.role}
      </p>

      {/* The Lead plans and writes the report — it never calls browser tools,
          and bugs/tests are credited to the specialist that saved them. A
          permanent "0 calls · 0 tests · 0 bugs" would read as "did nothing",
          so the Lead is represented by its narration instead. */}
      {agent !== LEAD && (
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{slice?.toolCalls?.length ?? 0} calls</span>
          <span>{slice?.testsGenerated?.length ?? 0} tests</span>
          <span>{slice?.bugsFound?.length ?? 0} bugs</span>
        </div>
      )}
    </button>
  );
}

function StateBadge({ state }: { state: AgentState }) {
  if (state === 'working') {
    return (
      <Badge variant="outline" className="gap-1 flex-shrink-0 border-primary text-primary">
        <Loader2 className="h-3 w-3 animate-spin" />
        working
      </Badge>
    );
  }
  if (state === 'stalled') {
    return (
      <Badge variant="outline" className="flex-shrink-0 text-amber-700 border-amber-500 dark:text-amber-400">
        stalled
      </Badge>
    );
  }
  if (state === 'done') {
    return (
      <Badge variant="outline" className="flex-shrink-0 text-green-700 border-green-600 dark:text-green-400">
        done
      </Badge>
    );
  }
  if (state === 'idle') {
    return <Badge variant="outline" className="flex-shrink-0">idle</Badge>;
  }
  return <Badge variant="outline" className="flex-shrink-0 text-muted-foreground">waiting</Badge>;
}

// ─── Shared activity feed ────────────────────────────────────────────────

interface FeedEntry {
  key: string;
  agent: AgentKey;
  text: string;
  at: number;
}

/**
 * The team "chatting". Built from tool calls, which are the only stream
 * events carrying a real timestamp, so entries can be ordered honestly
 * across agents rather than guessed at.
 */
function TeamFeed({
  agentStreams,
  leadDispatches,
}: {
  agentStreams: Record<string, AgentStreamSlice>;
  leadDispatches: LeadDispatch[];
}) {
  const entries = useMemo<FeedEntry[]>(() => {
    const out: FeedEntry[] = [];

    for (const agent of [LEAD, ...SPECIALISTS] as AgentKey[]) {
      const slice = agentStreams[agent];
      if (!slice?.toolCalls) continue;
      slice.toolCalls.slice(-30).forEach((call, i) => {
        const at = Date.parse(call.timestamp);
        let detail = '';
        try {
          const s = JSON.stringify(call.input ?? {});
          detail = s.length > 90 ? `${s.slice(0, 90)}…` : s;
        } catch {
          detail = '';
        }
        out.push({
          key: `${agent}-${i}-${call.timestamp}`,
          agent,
          text: detail ? `${call.tool} ${detail}` : call.tool,
          at: Number.isNaN(at) ? 0 : at,
        });
      });
    }

    for (const d of leadDispatches) {
      const at = Date.parse(d.at);
      out.push({
        key: `dispatch-${d.id}`,
        agent: LEAD,
        text: `${d.kind}${d.target ? ` → ${PROFILES[d.target as AgentKey]?.title ?? d.target}` : ''}: ${d.message}`,
        at: Number.isNaN(at) ? 0 : at,
      });
    }

    return out.sort((a, b) => b.at - a.at).slice(0, 40);
  }, [agentStreams, leadDispatches]);

  return (
    <Card>
      <CardContent className="p-4">
        <h4 className="text-sm font-semibold mb-3">Team activity</h4>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Activity appears here as the team works.
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-72 overflow-auto">
            {entries.map(e => (
              <li key={e.key} className="flex items-start gap-2 text-xs">
                <Badge variant="outline" className="flex-shrink-0 text-[10px]">
                  {PROFILES[e.agent]?.title ?? e.agent}
                </Badge>
                <span className="text-muted-foreground break-all">{e.text}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Drill-down ──────────────────────────────────────────────────────────

function AgentDetail({
  agent,
  slice,
  leadDispatches,
  now,
  isRunning,
  anyWorking,
  onBack,
}: {
  agent: AgentKey;
  slice: AgentStreamSlice | undefined;
  leadDispatches: LeadDispatch[];
  now: number;
  isRunning: boolean;
  anyWorking: boolean;
  onBack: () => void;
}) {
  const profile = PROFILES[agent];
  const state = stateOf(slice, now, isRunning, anyWorking);
  const { Icon } = profile;
  const dispatches = leadDispatches.filter(d => d.target === agent);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold truncate">
                {profile.title}
                <span className="ms-2 text-sm font-normal text-muted-foreground">{profile.persona}</span>
              </h3>
              <p className="text-xs text-muted-foreground truncate">{profile.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StateBadge state={state} />
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 me-1 rtl:scale-x-[-1]" />
              Back to board
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <Stat label="Tool calls" value={slice?.toolCalls?.length ?? 0} />
          <Stat label="Tests" value={slice?.testsGenerated?.length ?? 0} />
          <Stat label="Bugs" value={slice?.bugsFound?.length ?? 0} />
        </div>

        {dispatches.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2">Lead dispatches</h4>
            <ul className="space-y-1">
              {dispatches.slice().reverse().map(d => (
                <li key={d.id} className="text-xs flex items-start gap-2">
                  <Badge variant="outline" className="text-[10px] flex-shrink-0">{d.kind}</Badge>
                  <span className="text-muted-foreground">{d.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Thinking</h4>
          <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-md max-h-64 overflow-auto">
            {slice?.thinkingText?.slice(-4000) || (
              <span className="text-muted-foreground">Nothing yet.</span>
            )}
          </pre>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Tool calls</h4>
          {slice?.toolCalls?.length ? (
            <ul className="space-y-1 max-h-64 overflow-auto">
              {slice.toolCalls.slice().reverse().map((call, i) => (
                <li key={`${call.timestamp}-${i}`} className="text-xs flex items-start gap-2">
                  <Badge variant="outline" className="text-[10px] flex-shrink-0">{call.tool}</Badge>
                  <span className="text-muted-foreground break-all">
                    {(() => {
                      try { return JSON.stringify(call.input ?? {}).slice(0, 160); } catch { return ''; }
                    })()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No tool calls yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
