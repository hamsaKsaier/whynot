/**
 * CommandCenter — v4 Phase 3 UI.
 *
 * Four quadrants, one per agent (Exploratory, Security, API Tester, QA
 * Lead), plus a bottom strip with:
 *   - Unified lead-dispatch activity feed
 *   - Text-based Gantt timeline showing each agent's active window
 *
 * Wiring: consumes `agentStreams` + `leadDispatches` from useQALoopStream
 * via useSessionManager. No new websocket connection — every datum comes
 * from the existing stream, filtered by the `agent` field that the v4
 * Phase 1 event bus already attaches to every thinking / tool_call /
 * bug_found event.
 *
 * Feature-flag: enabled via a parent prop (QALoopPage toggles based on
 * `?view=command-center` URL param OR a runtime toggle). When off, the
 * existing LiveMonitor component renders instead — this component is
 * strictly additive.
 *
 * Styling: shadcn primitives + Tailwind logical properties for RTL.
 * No animate-pulse on content per the project's Uncodixify rules; the
 * `pulse` highlight uses a border/ring transition on the target panel.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type { AgentStreamSlice, LeadDispatch } from '../../hooks/useQALoopStream';

const AGENT_ORDER = ['exploratory', 'security', 'api_tester', 'qa_lead'] as const;
type AgentKey = typeof AGENT_ORDER[number];

const AGENT_TITLES: Record<AgentKey, string> = {
  exploratory: 'Exploratory',
  security: 'Security',
  api_tester: 'API Tester',
  qa_lead: 'QA Lead',
};

const AGENT_ROLES: Record<AgentKey, string> = {
  exploratory: 'Crawls pages, records forms + endpoints.',
  security: 'Tests forms for XSS / SQLi / CSRF / auth bypass.',
  api_tester: 'Probes endpoints for edge-case validation.',
  qa_lead: 'Watches the team. Reassigns. Escalates.',
};

interface CommandCenterProps {
  agentStreams: Record<string, AgentStreamSlice>;
  leadDispatches: LeadDispatch[];
  sessionStartTime: number | null;
  isRunning: boolean;
}

export function CommandCenter({
  agentStreams,
  leadDispatches,
  sessionStartTime,
  isRunning,
}: CommandCenterProps) {
  // Force a re-render every second so the Gantt / idle counters stay
  // live without every child managing its own timer.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  return (
    <div className="flex flex-col gap-4">
      {/* 2 x 2 quadrant grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AGENT_ORDER.map((agent) => (
          <AgentQuadrant
            key={agent}
            agent={agent}
            slice={agentStreams[agent]}
            leadDispatches={leadDispatches}
            now={now}
          />
        ))}
      </div>

      {/* Lead dispatch feed */}
      <LeadDispatchFeed dispatches={leadDispatches} />

      {/* Text-based Gantt timeline */}
      <GanttTimeline
        agentStreams={agentStreams}
        sessionStartTime={sessionStartTime}
        now={now}
      />
    </div>
  );
}

// ─── Per-agent quadrant ─────────────────────────────────────────────────

interface AgentQuadrantProps {
  agent: AgentKey;
  slice: AgentStreamSlice | undefined;
  leadDispatches: LeadDispatch[];
  now: number;
}

function AgentQuadrant({ agent, slice, leadDispatches, now }: AgentQuadrantProps) {
  const idleSecs = slice?.lastActivityTs ? Math.round((now - slice.lastActivityTs) / 1000) : null;
  const isActive = idleSecs !== null && idleSecs < 30;
  const isStale  = idleSecs !== null && idleSecs >= 120;

  const lastDispatchForAgent = leadDispatches.slice().reverse().find(d => d.target === agent);
  const pulseClass =
    slice?.pulse === 'reassign' ? 'ring-1 ring-primary'     :
    slice?.pulse === 'pause'    ? 'ring-1 ring-amber-500'   :
    slice?.pulse === 'resume'   ? 'ring-1 ring-green-500'   :
    slice?.pulse === 'escalate' ? 'ring-1 ring-destructive' :
    '';

  return (
    <Card className={cn('overflow-hidden transition-colors duration-150', pulseClass)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 border-b">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{AGENT_TITLES[agent]}</h3>
          <StatusBadge active={isActive} stale={isStale} idleSecs={idleSecs} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>pages {slice ? (slice as any).pagesExplored ?? 0 : 0}</span>
          <span>·</span>
          <span>tests {slice?.testsGenerated?.length ?? 0}</span>
          <span>·</span>
          <span>bugs {slice?.bugsFound?.length ?? 0}</span>
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <p className="text-xs text-muted-foreground">{AGENT_ROLES[agent]}</p>

        {lastDispatchForAgent && (
          <div className="text-xs p-2 rounded-md bg-muted border-s-2 border-primary">
            <span className="font-medium">Lead dispatch:</span> {lastDispatchForAgent.message}
          </div>
        )}

        <div>
          <div className="text-xs font-medium mb-1 text-muted-foreground">Thinking</div>
          <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-2 rounded-md h-32 overflow-auto">
            {slice?.thinkingText?.slice(-800) || <span className="text-muted-foreground">(idle)</span>}
          </pre>
        </div>

        <div>
          <div className="text-xs font-medium mb-1 text-muted-foreground">Recent tool calls</div>
          <div className="space-y-1 max-h-24 overflow-auto">
            {(slice?.toolCalls ?? []).slice(-5).reverse().map((t, i) => (
              <div key={i} className="text-xs flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t.tool}</Badge>
                <span className="text-muted-foreground truncate">
                  {(() => {
                    try { return JSON.stringify(t.input).slice(0, 80); } catch { return ''; }
                  })()}
                </span>
              </div>
            ))}
            {(!slice?.toolCalls || slice.toolCalls.length === 0) && (
              <div className="text-xs text-muted-foreground">(no calls yet)</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Status badge ───────────────────────────────────────────────────────

function StatusBadge({ active, stale, idleSecs }: { active: boolean; stale: boolean; idleSecs: number | null }) {
  if (idleSecs === null) {
    return <Badge variant="outline" className="text-[10px]">idle</Badge>;
  }
  if (active) {
    return <Badge className="text-[10px] bg-green-600 text-white">active</Badge>;
  }
  if (stale) {
    return <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-500">stalled {idleSecs}s</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">idle {idleSecs}s</Badge>;
}

// ─── Lead dispatch feed ────────────────────────────────────────────────

function LeadDispatchFeed({ dispatches }: { dispatches: LeadDispatch[] }) {
  if (dispatches.length === 0) {
    return (
      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground">
          QA Lead has issued no dispatches yet. When agents idle for &gt; 3 min,
          the watcher considers a reassignment.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="p-3 border-b text-sm font-semibold">Lead Dispatches</CardHeader>
      <CardContent className="p-3 space-y-1 max-h-48 overflow-auto">
        {dispatches.slice().reverse().map(d => (
          <div key={d.id} className="text-xs flex items-start gap-2">
            <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{d.kind}</Badge>
            <span className="text-muted-foreground shrink-0 mt-0.5">
              {new Date(d.at).toLocaleTimeString()}
            </span>
            <span>{d.message}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Gantt timeline ────────────────────────────────────────────────────

interface GanttProps {
  agentStreams: Record<string, AgentStreamSlice>;
  sessionStartTime: number | null;
  now: number;
}

function GanttTimeline({ agentStreams, sessionStartTime, now }: GanttProps) {
  const start = sessionStartTime ?? now;
  const spanMs = Math.max(1_000, now - start);
  // Compose rows in canonical agent order; fall back to entries present.
  const rows = useMemo(() => {
    return AGENT_ORDER.map(agent => ({
      agent,
      slice: agentStreams[agent],
    })).filter(r => r.slice);
  }, [agentStreams]);

  if (rows.length === 0) return null;

  const TRACK_WIDTH = 40; // chars — stays readable in a monospace Gantt

  const formatClock = (ms: number) => {
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <Card>
      <CardHeader className="p-3 border-b text-sm font-semibold">
        Timeline (elapsed {formatClock(now - start)})
      </CardHeader>
      <CardContent className="p-3">
        <pre className="text-xs font-mono leading-relaxed overflow-x-auto">
          {rows.map(({ agent, slice }) => {
            const s = slice!;
            const firstRel = (s.firstSeenTs ?? start) - start;
            const lastRel = (s.lastSeenTs ?? now) - start;
            const leftChars = Math.floor((firstRel / spanMs) * TRACK_WIDTH);
            const barChars = Math.max(1, Math.floor(((lastRel - firstRel) / spanMs) * TRACK_WIDTH));
            const tailChars = Math.max(0, TRACK_WIDTH - leftChars - barChars);
            const bar = ' '.repeat(leftChars) + '█'.repeat(barChars) + '░'.repeat(tailChars);
            return (
              <div key={agent} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-muted-foreground">{AGENT_TITLES[agent]}</span>
                <span className="flex-1">{bar}</span>
                <span className="text-muted-foreground w-16 text-end">{formatClock(lastRel)}</span>
              </div>
            );
          })}
        </pre>
        <div className="mt-2 text-[10px] text-muted-foreground">
          █ = active window · ░ = since-last-seen tail
        </div>
      </CardContent>
    </Card>
  );
}
