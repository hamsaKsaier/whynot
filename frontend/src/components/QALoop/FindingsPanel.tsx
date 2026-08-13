/**
 * FindingsPanel — the bugs, appearing as the team finds them.
 *
 * The board shows what the agents are *doing*; this shows what they are
 * *catching*. Each finding lands as a card the moment it is saved, credited to
 * the agent (and persona) that found it — "SQL Injection in Login Form, found
 * by Security (the paranoid)". The header count climbing 0 → 1 → 2 while a bot
 * is lit is the point.
 *
 * Data comes straight from the websocket stream (useQALoopStream.bugsFound);
 * nothing here is synthesized. Ordered newest-first so the latest catch is on
 * top.
 *
 * Uncodixify: no motion. A newly-arrived card is cued by colour only — a brief
 * primary ring that fades via transition-colors — never a slide or a scale.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type { Finding } from '../../hooks/useQALoopStream';

/** Agent id → display name + persona, for crediting a finding to a character. */
const AGENT_LABEL: Record<string, { title: string; persona: string }> = {
  qa_lead: { title: 'QA Lead', persona: 'the strategist' },
  exploratory: { title: 'Exploratory', persona: 'the wanderer' },
  security: { title: 'Security', persona: 'the paranoid' },
  api_tester: { title: 'API Tester', persona: 'the edge-caser' },
  auto_tester: { title: 'Auto Tester', persona: 'the builder' },
  verifier: { title: 'Verifier', persona: 'the skeptic' },
};

type Sev = 'critical' | 'high' | 'medium' | 'low';

function normSev(s: string | undefined): Sev {
  const v = (s || '').toLowerCase();
  if (v === 'critical' || v === 'high' || v === 'low') return v;
  return 'medium';
}

const SEV_ORDER: Record<Sev, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Palette per severity — project tokens / Tailwind scale with dark variants only. */
const SEV_STYLES: Record<Sev, { accent: string; badge: string; dot: string; label: string }> = {
  critical: {
    accent: 'border-s-red-600',
    badge: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40',
    dot: 'bg-red-600',
    label: 'critical',
  },
  high: {
    accent: 'border-s-orange-500',
    badge: 'bg-orange-50 text-orange-900 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-900/40',
    dot: 'bg-orange-500',
    label: 'high',
  },
  medium: {
    accent: 'border-s-yellow-500',
    badge: 'bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-900/40',
    dot: 'bg-yellow-500',
    label: 'medium',
  },
  low: {
    accent: 'border-s-sky-500',
    badge: 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-900/40',
    dot: 'bg-sky-500',
    label: 'low',
  },
};

interface FindingsPanelProps {
  findings: Finding[];
  isRunning: boolean;
}

export function FindingsPanel({ findings, isRunning }: FindingsPanelProps) {
  // Newest first. Stable key per finding so the "just arrived" highlight can
  // target only the new one.
  const ordered = useMemo(() => {
    return findings
      .map((f, i) => ({ f, key: `${f.title}::${f.agent ?? ''}::${i}` }))
      .slice()
      .reverse();
  }, [findings]);

  const counts = useMemo(() => {
    const c: Record<Sev, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) c[normSev(f.severity)]++;
    return c;
  }, [findings]);

  // Track which keys are new since last render, to flash a ring on them.
  const seen = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const added: string[] = [];
    for (const { key } of ordered) if (!seen.current.has(key)) { seen.current.add(key); added.push(key); }
    if (added.length) {
      setFresh(prev => new Set([...prev, ...added]));
      const t = setTimeout(() => {
        setFresh(prev => { const n = new Set(prev); added.forEach(k => n.delete(k)); return n; });
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [ordered]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="text-lg font-semibold">
            Findings
            <span className="ms-2 text-sm font-normal text-muted-foreground">
              {findings.length}
            </span>
          </h3>
          {findings.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              {(['critical', 'high', 'medium', 'low'] as Sev[])
                .filter(s => counts[s] > 0)
                .map(s => (
                  <span key={s} className="flex items-center gap-1.5 text-muted-foreground">
                    <span className={cn('h-2 w-2 rounded-full', SEV_STYLES[s].dot)} />
                    {counts[s]} {SEV_STYLES[s].label}
                  </span>
                ))}
            </div>
          )}
        </div>

        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isRunning
              ? 'No findings yet — the team is still looking.'
              : 'No findings. Nothing broke.'}
          </p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {ordered.map(({ f, key }) => {
              const sev = normSev(f.severity);
              const st = SEV_STYLES[sev];
              const who = f.agent ? AGENT_LABEL[f.agent] : undefined;
              return (
                <li
                  key={key}
                  className={cn(
                    'rounded-md border border-s-2 bg-card p-3 transition-colors duration-150',
                    st.accent,
                    // "Just arrived" cue: colour only, no motion.
                    fresh.has(key) && 'ring-1 ring-primary',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug break-words">{f.title}</p>
                    <Badge variant="outline" className={cn('flex-shrink-0 text-[10px]', st.badge)}>
                      {st.label}
                    </Badge>
                  </div>
                  {who && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      found by <span className="font-medium text-foreground">{who.title}</span>{' '}
                      <span className="italic">({who.persona})</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
