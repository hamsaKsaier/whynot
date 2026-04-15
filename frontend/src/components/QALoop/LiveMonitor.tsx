/**
 * LiveMonitor — Cinema-grade QA session monitoring experience.
 *
 * Design philosophy: watching AI test your app should feel like a
 * command-centre war-room — immersive, dramatic, informative.
 *
 *  ┌──────────────────────────────────────────────────────┐
 *  │  PHASE BANNER   [Auth] [Exploring] [Testing] [Done]  │
 *  │                                                      │
 *  │  ┌─────────────────────┐  ┌────────────────────────┐│
 *  │  │  LIVE BROWSER       │  │  AI THINKING           ││
 *  │  │  (big screenshot)   │  │  (streaming typewriter)││
 *  │  └─────────────────────┘  └────────────────────────┘│
 *  │                                                      │
 *  │  ┌────────────────── ACTION FEED ─────────────────┐ │
 *  │  │  navigate  /dashboard          08:40:12        │ │
 *  │  │  click     [data-nav="courses"] 08:40:14       │ │
 *  │  │  save_test  "Nav test"           08:40:16      │ │
 *  │  └────────────────────────────────────────────────┘ │
 *  │                                                      │
 *  │  [Pages] [Tests] [Bugs] [Cost]  (animated counters)  │
 *  └──────────────────────────────────────────────────────┘
 */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TestRunActivity } from '../../hooks/useSessionManager';
import { CostInfo } from '../../hooks/useQALoopStream';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// ── Icons (inline SVG so no import overhead) ─────────────────────────────────
const Icons = {
  navigate: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/>
    </svg>
  ),
  click: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/>
    </svg>
  ),
  type: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 12h8M12 9v6"/>
    </svg>
  ),
  test: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M9 11l3 3 8-8"/><path d="M21 12A9 9 0 113 12a9 9 0 0118 0z"/>
    </svg>
  ),
  bug: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M8 2h8l2 4H6L8 2z"/><rect x="6" y="6" width="12" height="14" rx="2"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="10" y1="12" x2="14" y2="12"/>
    </svg>
  ),
  explore: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  ),
  state: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  note: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  ),
  brain: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-2.5-2.5M14.5 2A2.5 2.5 0 0012 4.5"/>
      <path d="M5 8a4 4 0 014 4 4 4 0 01-4 4 4 4 0 010-8z"/>
      <path d="M19 8a4 4 0 00-4 4 4 4 0 004 4 4 4 0 000-8z"/>
      <path d="M5 12H3M19 12h2M8 5.5l-2-2M16 5.5l2-2M8 18.5l-2 2M16 18.5l2 2"/>
    </svg>
  ),
  monitor: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  expand: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
    </svg>
  ),
  compress: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 14h6v6M14 4h6v6M4 14l7-7M21 3l-7 7"/>
    </svg>
  ),
  clock: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  ),
  dollar: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  ),
  spark: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
};

// ── Tool → display config ─────────────────────────────────────────────────────
const TOOL_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Icons }> = {
  navigate:          { label: 'Navigate',    color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  icon: 'navigate' },
  click:             { label: 'Click',       color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: 'click' },
  type_text:         { label: 'Type',        color: '#34d399', bg: 'rgba(52,211,153,0.12)',  icon: 'type' },
  save_test_case:    { label: 'Test Case',   color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  icon: 'test' },
  add_bug:           { label: 'Bug Found!',  color: '#f87171', bg: 'rgba(248,113,113,0.15)', icon: 'bug' },
  get_page_elements: { label: 'Scan Page',   color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  icon: 'explore' },
  get_session_state: { label: 'Check State', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', icon: 'state' },
  mark_page_explored:{ label: 'Marked',      color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  icon: 'explore' },
  add_page:          { label: 'Page Added',  color: '#818cf8', bg: 'rgba(129,140,248,0.12)', icon: 'navigate' },
  add_note:          { label: 'Note',        color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  icon: 'note' },
};

const getToolConfig = (tool: string) =>
  TOOL_CONFIG[tool] ?? { label: tool, color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', icon: 'explore' as const };

// ── Phase config ──────────────────────────────────────────────────────────────
const PHASE_CONFIG: Record<string, { label: string; color: string; pulse: boolean }> = {
  auth_exploration:         { label: 'Auth Testing',       color: '#f59e0b', pulse: true },
  auth_exploration_complete:{ label: 'Auth Done',          color: '#22c55e', pulse: false },
  login:                    { label: 'Logging In',         color: '#60a5fa', pulse: true },
  login_complete:           { label: 'Logged In',          color: '#22c55e', pulse: false },
  resume_login:             { label: 'Resuming Login',     color: '#a78bfa', pulse: true },
  exploring:                { label: 'Exploring',          color: '#34d399', pulse: true },
  test_execution:           { label: 'Running Tests',      color: '#818cf8', pulse: true },
  running_tests:            { label: 'Running Tests',      color: '#818cf8', pulse: true },
  cost_update:              { label: 'Calculating',        color: '#fbbf24', pulse: false },
  resume_no_credentials:    { label: 'No Credentials',     color: '#f87171', pulse: false },
  correction:               { label: 'Correcting Tests',   color: '#fbbf24', pulse: true },
  correction_retest:        { label: 'Re-testing',         color: '#a78bfa', pulse: true },
  correction_complete:      { label: 'Correction Done',    color: '#22c55e', pulse: false },
  correction_error:         { label: 'Correction Error',   color: '#f87171', pulse: false },
};

const getPhaseConfig = (phase: string | null) =>
  phase ? (PHASE_CONFIG[phase] ?? { label: phase, color: '#94a3b8', pulse: false }) : null;

// ── AI Thinking line parser ───────────────────────────────────────────────────
interface ThinkingLine {
  type: 'navigate' | 'screenshot' | 'form' | 'click' | 'bug' | 'test' | 'page' | 'error' | 'text';
  text: string;
  timestamp: string;
}

const NOISE_PATTERNS = [
  /^browser_snapshot$/i,
  /^browser_evaluate$/i,
  /^browser_wait_for$/i,
  /^browser_console_messages$/i,
  /^browser_tabs$/i,
  /^get_session_state$/i,
  /^get_page_elements$/i,
  /^mark_page_explored$/i,
  /^\s*$/,
];

function parseThinkingLines(raw: string): ThinkingLine[] {
  if (!raw) return [];
  const now = new Date();
  const lines = raw.split('\n').filter(l => l.trim());
  const result: ThinkingLine[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Filter noise
    if (NOISE_PATTERNS.some(p => p.test(trimmed))) continue;

    const ts = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Navigation
    if (/navigat(e|ing|ion)\b/i.test(trimmed) || /browser_navigate/i.test(trimmed) || /going to|visit(ing)?|open(ing)?\s+(the\s+)?page/i.test(trimmed)) {
      const urlMatch = trimmed.match(/(https?:\/\/[^\s"')]+)/);
      const url = urlMatch ? urlMatch[1] : trimmed.replace(/.*navigat(e|ing)\s*(to)?\s*/i, '').slice(0, 80);
      result.push({ type: 'navigate', text: `Navigating to ${url}`, timestamp: ts });
      continue;
    }
    // Screenshot
    if (/screenshot|browser_take_screenshot|capturing/i.test(trimmed)) {
      result.push({ type: 'screenshot', text: 'Capturing screenshot', timestamp: ts });
      continue;
    }
    // Form interactions
    if (/fill(ing)?|type|typing|enter(ing)?.*input|form|browser_fill/i.test(trimmed)) {
      const fieldMatch = trimmed.match(/(?:fill(?:ing)?|type|typing|enter(?:ing)?)\s+(?:in(?:to)?|the)?\s*["']?([^"'\n]+)/i);
      const field = fieldMatch ? fieldMatch[1].slice(0, 60) : trimmed.slice(0, 60);
      result.push({ type: 'form', text: `Filling ${field}`, timestamp: ts });
      continue;
    }
    // Click
    if (/click(ing|ed)?|browser_click|press(ing|ed)?.*button/i.test(trimmed)) {
      const elMatch = trimmed.match(/click(?:ing|ed)?\s+(?:on\s+)?(?:the\s+)?["']?([^"'\n]{3,60})/i);
      const el = elMatch ? elMatch[1] : trimmed.slice(0, 60);
      result.push({ type: 'click', text: `Clicking ${el}`, timestamp: ts });
      continue;
    }
    // Bug
    if (/bug\s*(found|report|detected|discovered)|save_bug|found\s+a?\s*bug|issue\s*(found|detected)/i.test(trimmed)) {
      const titleMatch = trimmed.match(/["']([^"']+)["']/);
      const title = titleMatch ? titleMatch[1] : trimmed.slice(0, 80);
      result.push({ type: 'bug', text: `Bug found: ${title}`, timestamp: ts });
      continue;
    }
    // Test case
    if (/test\s*case|save_test_case|generat(e|ing)\s+test|creat(e|ing)\s+test/i.test(trimmed)) {
      const nameMatch = trimmed.match(/["']([^"']+)["']/);
      const name = nameMatch ? nameMatch[1] : trimmed.slice(0, 80);
      result.push({ type: 'test', text: `Test case: ${name}`, timestamp: ts });
      continue;
    }
    // Page discovery
    if (/discover(ed|ing)?\s*(a\s+)?(new\s+)?page|add_discovered_page|found\s+(a\s+)?(new\s+)?page|add_page/i.test(trimmed)) {
      const urlMatch = trimmed.match(/(https?:\/\/[^\s"')]+)/);
      const url = urlMatch ? urlMatch[1] : trimmed.slice(0, 80);
      result.push({ type: 'page', text: `Discovered page: ${url}`, timestamp: ts });
      continue;
    }
    // Error/warning
    if (/error|warning|fail(ed)?|exception|broken|crash/i.test(trimmed)) {
      result.push({ type: 'error', text: trimmed.slice(0, 120), timestamp: ts });
      continue;
    }
    // Default text
    if (trimmed.length > 3) {
      result.push({ type: 'text', text: trimmed.slice(0, 120), timestamp: ts });
    }
  }

  return result;
}

const THINKING_LINE_STYLES: Record<ThinkingLine['type'], { color: string; borderColor?: string; icon: string }> = {
  navigate:   { color: 'text-sky-500 dark:text-sky-400',       icon: '\u25CF' },
  screenshot: { color: 'text-muted-foreground',                icon: '\uD83D\uDCF8' },
  form:       { color: 'text-sky-500 dark:text-sky-400',       icon: '\u25CF' },
  click:      { color: 'text-sky-500 dark:text-sky-400',       icon: '\u25CF' },
  bug:        { color: 'text-red-500 dark:text-red-400',       borderColor: 'border-s-4 border-red-500', icon: '\uD83D\uDC1B' },
  test:       { color: 'text-emerald-500 dark:text-emerald-400', borderColor: 'border-s-4 border-emerald-500', icon: '\uD83E\uDDEA' },
  page:       { color: 'text-blue-500 dark:text-blue-400',     icon: '\uD83D\uDD0D' },
  error:      { color: 'text-amber-500 dark:text-amber-400',   icon: '\u26A0\uFE0F' },
  text:       { color: 'text-foreground',                      icon: '\u25CF' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

function safePathname(url: string | null): string {
  if (!url) return '';
  try { return new URL(url).pathname || url; } catch { return url; }
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Animated "live" dot */
const LiveDot: React.FC<{ active?: boolean }> = ({ active = true }) => (
  <span className="relative flex h-2.5 w-2.5">
    {active && <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
    <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", active ? 'bg-green-400' : 'bg-muted-foreground')} />
  </span>
);

/** Big animated stat tile */
const StatTile: React.FC<{
  value: number | string;
  label: string;
  color: string;
  icon: React.ReactNode;
}> = ({ value, label, color, icon }) => (
  <Card className="shadow-none flex-1 min-w-[72px]">
    <CardContent className="flex flex-col items-center justify-center px-2 sm:px-4 py-2 sm:py-3 gap-0.5 sm:gap-1">
      <div className="flex items-center gap-1 sm:gap-1.5" style={{ color }}>
        {icon}
        <span className="text-lg sm:text-2xl font-bold tabular-nums">{value}</span>
      </div>
      <span className="text-[10px] sm:text-xs text-muted-foreground font-medium tracking-wide uppercase">{label}</span>
    </CardContent>
  </Card>
);

/** Single action feed row */
const ActionRow: React.FC<{
  call: { tool: string; input: any; result?: any; timestamp: string };
}> = ({ call }) => {
  const cfg = getToolConfig(call.tool);
  const IconComp = Icons[cfg.icon] || Icons.explore;
  const hint = call.input?.url
    ? safePathname(call.input.url) || call.input.url
    : call.input?.selector
    ? String(call.input.selector).slice(0, 50)
    : call.input?.name
    ? `"${String(call.input.name).slice(0, 40)}"`
    : call.input?.text
    ? `"${String(call.input.text).slice(0, 40)}"`
    : '';

  return (
    <div
      className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border text-xs"
      style={{ background: cfg.bg, borderColor: cfg.color + '30' }}
    >
      <span style={{ color: cfg.color }} className="shrink-0 flex items-center">
        <IconComp />
      </span>
      <span className="font-semibold shrink-0 hidden sm:inline" style={{ color: cfg.color, minWidth: '88px' }}>
        {cfg.label}
      </span>
      {hint && (
        <span className="text-muted-foreground truncate sm:break-all flex-1 font-mono text-[10px] sm:text-[11px] min-w-0" title={hint}>
          {hint}
        </span>
      )}
      <span className="text-muted-foreground shrink-0 ms-auto flex items-center gap-1">
        {call.result !== undefined
          ? <span className="text-green-500">&#10003;</span>
          : <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        }
        <span className="hidden sm:inline">{formatTimestamp(call.timestamp)}</span>
      </span>
    </div>
  );
};

/** SVG status icons for test results */
const StatusIcons = {
  running: () => (
    <span className="inline-flex w-5 h-5 items-center justify-center">
      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
    </span>
  ),
  passed: () => (
    <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7"/>
      </svg>
    </span>
  ),
  failed: () => (
    <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </span>
  ),
  needsReview: () => (
    <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/20">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4M12 17h.01"/>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      </svg>
    </span>
  ),
};

/**
 * Map raw backend status to user-facing display status.
 */
type DisplayStatus = 'running' | 'passed' | 'failed' | 'needsReview';

function getDisplayStatus(activity: TestRunActivity): DisplayStatus {
  const s = activity.status;
  if (s === 'running') return 'running';
  if (s === 'mismatch' as string || activity.isMismatch) return 'needsReview';
  if (s === 'confirmed' as string) {
    return activity.observedResult === 'fail' ? 'failed' : 'passed';
  }
  if (s === 'passed') return 'passed';
  return 'failed';
}

const DISPLAY_STATUS_CONFIG: Record<DisplayStatus, {
  label: string; bg: string; border: string; text: string; badgeClasses: string;
}> = {
  running:     { label: 'Running',      bg: 'rgba(96,165,250,0.15)',  border: '#60a5fa40', text: '#60a5fa', badgeClasses: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' },
  passed:      { label: 'Passed',       bg: 'rgba(74,222,128,0.15)',  border: '#4ade8040', text: '#4ade80', badgeClasses: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' },
  failed:      { label: 'Failed',       bg: 'rgba(248,113,113,0.15)', border: '#f8717140', text: '#f87171', badgeClasses: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' },
  needsReview: { label: 'Needs Review', bg: 'rgba(245,158,11,0.15)',  border: '#f59e0b40', text: '#f59e0b', badgeClasses: 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
};

/** Test result notification */
const TestResultBadge: React.FC<{ activity: TestRunActivity }> = ({ activity }) => {
  const displayStatus = getDisplayStatus(activity);
  const cfg = DISPLAY_STATUS_CONFIG[displayStatus];
  const IconComp = StatusIcons[displayStatus] || StatusIcons.failed;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <IconComp />
      <span className="font-medium text-foreground truncate flex-1" title={activity.testCaseName}>
        {activity.testCaseName}
      </span>
      <Badge variant="outline" className={cn("shrink-0 text-[11px]", cfg.badgeClasses)}>
        {cfg.label}
      </Badge>
      {activity.durationMs && (
        <span className="shrink-0 text-muted-foreground text-[11px]">
          {(activity.durationMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export interface LiveMonitorProps {
  currentScreenshot: string | null;
  currentUrl: string | null;
  thinkingText: string;
  toolCalls: Array<{ tool: string; input: any; result?: any; timestamp: string }>;
  testRunActivity: TestRunActivity[];
  isRunning: boolean;
  showThinking: boolean;
  setShowThinking: (v: boolean) => void;
  showToolCalls: boolean;
  setShowToolCalls: (v: boolean) => void;
  expandedPreview: boolean;
  setExpandedPreview: (v: boolean) => void;
  // New cinema props
  currentPhase?: string | null;
  currentMessage?: string | null;
  costInfo?: CostInfo;
  sessionStartTime?: number | null;
  iteration?: number;
  pagesExplored?: number;
  testsGenerated?: number;
  bugsFound?: number;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  currentScreenshot,
  currentUrl,
  thinkingText,
  toolCalls,
  testRunActivity,
  isRunning,
  showThinking,
  setShowThinking,
  showToolCalls,
  setShowToolCalls,
  expandedPreview,
  setExpandedPreview,
  currentPhase,
  currentMessage,
  costInfo,
  sessionStartTime,
  iteration = 0,
  pagesExplored = 0,
  testsGenerated = 0,
  bugsFound = 0,
}) => {
  const { t } = useTranslation('runner');
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const thinkingContainerRef = useRef<HTMLDivElement>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const prevToolCallsLen = useRef(toolCalls.length);

  // ── Elapsed timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionStartTime || !isRunning) return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - sessionStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime, isRunning]);

  // ── Auto-scroll feed (scoped to container -- never scrolls the page) ────────
  useEffect(() => {
    const el = feedContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [toolCalls.length]);

  useEffect(() => {
    const el = thinkingContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thinkingText]);

  // ── Track which rows are newest for entrance animation ────────────────────
  useEffect(() => {
    prevToolCallsLen.current = toolCalls.length;
  });

  const phaseConfig = getPhaseConfig(currentPhase ?? null);
  const costDollars = costInfo ? (costInfo.totalCostCents / 100).toFixed(3) : null;

  // Parse thinking text into structured lines
  const thinkingLines = useMemo(() => parseThinkingLines(thinkingText.slice(-5000)), [thinkingText]);

  // Last 40 tool calls
  const displayCalls = useMemo(() => toolCalls.slice(-40), [toolCalls]);

  return (
    <div className="space-y-4">

      {/* ── Phase Banner ─────────────────────────────────────────────────────── */}
      {(isRunning || phaseConfig) && (
        <Card className="shadow-none">
          <CardContent className="flex items-center gap-3 px-4 py-2.5"
            style={{
              background: phaseConfig ? phaseConfig.color + '15' : undefined,
              borderColor: phaseConfig ? phaseConfig.color + '40' : undefined,
            }}
          >
            <LiveDot active={isRunning} />
            {phaseConfig && (
              <span
                className="font-semibold text-sm"
                style={{ color: phaseConfig.color }}
              >
                {phaseConfig.label}
              </span>
            )}
            {currentMessage && (
              <span className="text-sm text-muted-foreground truncate flex-1">{currentMessage}</span>
            )}
            {!currentMessage && !phaseConfig && isRunning && (
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> {t('runner.qaLoop.liveMonitor.aiWorking')}
              </span>
            )}
            {elapsedMs > 0 && (
              <span className="ms-auto flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Icons.clock /> {formatTime(elapsedMs)}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Collapsed AI Preview Status Bar ──────────────────────────────────── */}
      {!showPreview && isRunning && (
        <Card className="shadow-none">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LiveDot active />
              <span className="text-foreground text-sm">
                {t('runner.qaLoop.liveMonitor.scanningStatus', { pages: pagesExplored, tests: testsGenerated })}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(true)}
              className="text-sky-500 hover:text-sky-400"
            >
              {t('runner.qaLoop.liveMonitor.showAiPreview')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Main Grid: Browser + Thinking ────────────────────────────────────── */}
      {showPreview && (<div className={cn("grid gap-4", expandedPreview ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[3fr_2fr]')}>

        {/* Browser Preview */}
        <Card className="overflow-hidden shadow-sm">
          {/* Browser chrome bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <div className="w-3 h-3 rounded-full bg-green-400/70" />
            </div>
            <div className="flex-1 flex items-center gap-2 mx-2 bg-muted rounded-md px-3 py-1">
              <Icons.monitor />
              <span className="text-xs text-muted-foreground truncate font-mono">
                {currentUrl || '\u2014'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpandedPreview(!expandedPreview)}
              title={expandedPreview ? 'Minimize' : 'Expand'}
            >
              {expandedPreview ? <Icons.compress /> : <Icons.expand />}
            </Button>
          </div>
          {/* Screenshot area with loading states */}
          <div className={cn("relative bg-background flex items-center justify-center", expandedPreview ? 'h-[50vh] lg:h-[600px]' : 'h-[50vh] lg:h-[600px]')}>
            {currentScreenshot ? (
              <img
                src={currentScreenshot}
                alt={t('runner.qaLoop.liveMonitor.liveBrowserView')}
                className="w-full h-full object-contain"
                onError={(e) => {
                  console.warn('Screenshot image failed to load, clearing');
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                onLoad={(e) => {
                  (e.target as HTMLImageElement).style.display = 'block';
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                {isRunning ? (
                  thinkingText ? (
                    /* Phase 2: AI is working but no screenshot yet */
                    <>
                      <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
                      <span className="text-sm text-sky-500">{t('runner.qaLoop.liveMonitor.aiExploring')}</span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(i => (
                          <Skeleton key={i} className="w-8 h-1 rounded-full" />
                        ))}
                      </div>
                    </>
                  ) : (
                    /* Phase 1: Just started, connecting */
                    <>
                      <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                      <span className="text-sm text-muted-foreground">{t('runner.qaLoop.liveMonitor.connecting')}</span>
                      {/* Loading skeleton */}
                      <div className="w-48 space-y-2 mt-2">
                        <Skeleton className="h-2 w-full" />
                        <Skeleton className="h-2 w-3/4" />
                        <Skeleton className="h-2 w-1/2" />
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <Icons.monitor />
                    <span className="text-sm">{t('runner.qaLoop.liveMonitor.noPreview')}</span>
                  </>
                )}
              </div>
            )}
            {/* Live indicator overlay */}
            {isRunning && currentScreenshot && (
              <div className="absolute top-2 end-2 flex items-center gap-1.5 bg-background/80 rounded-full px-2 py-1 border border-border">
                <LiveDot />
                <span className="text-xs text-green-500 font-semibold">LIVE</span>
              </div>
            )}
          </div>
        </Card>

        {/* AI Thinking Panel -- Structured Action View */}
        {!expandedPreview && (
          <Card className="overflow-hidden flex flex-col shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 border-b border-border">
              <span className="text-green-500"><Icons.brain /></span>
              <span className="text-sm font-semibold text-foreground">{t('runner.qaLoop.liveMonitor.aiThinking')}</span>
              {thinkingText && isRunning && (
                <Loader2 className="h-3 w-3 animate-spin text-green-500 ms-1" />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowThinking(!showThinking)}
                className="ms-auto text-xs text-muted-foreground"
              >
                {showThinking ? t('runner.qaLoop.liveMonitor.hide') : t('runner.qaLoop.liveMonitor.show')}
              </Button>
            </div>
            {/* Structured Content */}
            {showThinking ? (
              <div ref={thinkingContainerRef} className="flex-1 overflow-y-auto font-mono text-xs sm:text-sm h-[40vh] md:h-[50vh] lg:h-[500px]"
                aria-live="polite">
                {thinkingLines.length === 0 ? (
                  <div className="p-4">
                    {isRunning ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="text-[13px] italic">{t('runner.qaLoop.liveMonitor.waitingForAi')}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-[13px]">{t('runner.qaLoop.liveMonitor.sessionPaused')}</span>
                    )}
                  </div>
                ) : (
                  thinkingLines.slice(-60).map((line, idx) => {
                    const style = THINKING_LINE_STYLES[line.type];
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-start gap-2 py-2 px-4 text-[13px]",
                          style.color,
                          style.borderColor || '',
                          idx < thinkingLines.length - 1 ? 'border-b border-border' : ''
                        )}
                      >
                        <span className="shrink-0 w-5 text-center">{style.icon}</span>
                        <span className="flex-1 break-words">{line.text}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground ms-auto tabular-nums">{line.timestamp}</span>
                      </div>
                    );
                  })
                )}
                {/* Blinking cursor while streaming */}
                {isRunning && thinkingText && (
                  <div className="px-4 py-1">
                    <span className="inline-block w-2 h-3 bg-green-500" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-4">
                {t('runner.qaLoop.liveMonitor.clickShowReasoning')}
              </div>
            )}
          </Card>
        )}

        {/* Hide Preview button */}
        <div className="col-span-full flex justify-end mt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(false)}
            className="text-muted-foreground text-xs"
          >
            {t('runner.qaLoop.liveMonitor.hidePreview')}
          </Button>
        </div>
      </div>)}

      {/* ── Stats Bar ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-wrap gap-2 sm:gap-3 justify-start">
        <StatTile value={iteration || 0} label={t('runner.qaLoop.liveMonitor.iteration')} color="#818cf8"
          icon={<Icons.spark />} />
        <StatTile value={pagesExplored} label={t('runner.qaLoop.liveMonitor.pages')} color="#60a5fa"
          icon={<Icons.navigate />} />
        <StatTile value={testsGenerated} label={t('runner.qaLoop.liveMonitor.tests')} color="#4ade80"
          icon={<Icons.test />} />
        <StatTile value={bugsFound} label={t('runner.qaLoop.liveMonitor.bugs')} color="#f87171"
          icon={<Icons.bug />} />
        {testRunActivity.length > 0 && (() => {
          const passedCount = testRunActivity.filter(a => getDisplayStatus(a) === 'passed').length;
          const failedCount = testRunActivity.filter(a => getDisplayStatus(a) === 'failed').length;
          const reviewCount = testRunActivity.filter(a => getDisplayStatus(a) === 'needsReview').length;
          return (
            <>
              {passedCount > 0 && (
                <StatTile value={passedCount} label={t('runner.qaLoop.liveMonitor.passed')} color="#4ade80" icon={<Icons.test />} />
              )}
              {failedCount > 0 && (
                <StatTile value={failedCount} label={t('runner.qaLoop.liveMonitor.failed')} color="#f87171" icon={<Icons.bug />} />
              )}
              {reviewCount > 0 && (
                <StatTile value={reviewCount} label={t('runner.qaLoop.liveMonitor.review')} color="#f59e0b" icon={<Icons.explore />} />
              )}
            </>
          );
        })()}
        {/* Credits/cost removed from QA Loop -- shown only on Billing page */}
      </div>

      {/* ── Test Execution Feed ───────────────────────────────────────────────── */}
      {testRunActivity.length > 0 && (
        <Card className="overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border flex-wrap">
            <span className="text-indigo-500"><Icons.test /></span>
            <span className="text-sm font-semibold text-foreground">{t('runner.qaLoop.liveMonitor.testExecution')}</span>
            {(() => {
              const p = testRunActivity.filter(a => getDisplayStatus(a) === 'passed').length;
              const f = testRunActivity.filter(a => getDisplayStatus(a) === 'failed').length;
              const r = testRunActivity.filter(a => getDisplayStatus(a) === 'needsReview').length;
              return (
                <>
                  {p > 0 && <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800">{t('runner.qaLoop.results.passedCount', { count: p })}</Badge>}
                  {f > 0 && <Badge variant="outline" className="text-xs bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800">{t('runner.qaLoop.results.failedCount', { count: f })}</Badge>}
                  {r > 0 && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-800">{t('runner.qaLoop.liveMonitor.needsReviewCount', { count: r })}</Badge>}
                </>
              );
            })()}
          </div>
          <div className="p-2 sm:p-3 space-y-1.5 max-h-36 sm:max-h-48 overflow-y-auto" aria-live="polite">
            {[...testRunActivity].reverse().map(activity => (
              <TestResultBadge key={activity.testCaseId} activity={activity} />
            ))}
          </div>
          {testRunActivity.some(a => a.failureReason) && (
            <div className="px-4 pb-3 text-xs text-red-500 truncate border-t border-border pt-2">
              {testRunActivity.find(a => a.failureReason)?.failureReason}
            </div>
          )}
        </Card>
      )}

      {/* ── Action Feed ──────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
          <span className="text-sky-500"><Icons.spark /></span>
          <span className="text-sm font-semibold text-foreground">{t('runner.qaLoop.liveMonitor.actionFeed')}</span>
          {toolCalls.length > 0 && (
            <Badge variant="outline" className="ms-1 text-xs bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300 border-sky-200 dark:border-sky-800">
              {toolCalls.length}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowToolCalls(!showToolCalls)}
            className="ms-auto text-xs text-muted-foreground"
          >
            {showToolCalls ? t('runner.qaLoop.liveMonitor.hide') : t('runner.qaLoop.liveMonitor.show')}
          </Button>
        </div>
        {showToolCalls && (
          <div ref={feedContainerRef} className="p-2 sm:p-3 space-y-1 sm:space-y-1.5 max-h-[40vh] sm:max-h-72 lg:max-h-96 overflow-y-auto" aria-live="polite">
            {displayCalls.length === 0 ? (
              <div className="text-muted-foreground text-sm py-3 text-center italic">
                {isRunning ? t('runner.qaLoop.liveMonitor.waitingForAction') : t('runner.qaLoop.liveMonitor.noActions')}
              </div>
            ) : (
              displayCalls.map((call, idx) => (
                <ActionRow
                  key={idx}
                  call={call}
                />
              ))
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
