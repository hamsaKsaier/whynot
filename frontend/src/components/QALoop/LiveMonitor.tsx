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
 *  │  │  LIVE BROWSER       │  │  🧠 AI THINKING        ││
 *  │  │  (big screenshot)   │  │  (streaming typewriter)││
 *  │  └─────────────────────┘  └────────────────────────┘│
 *  │                                                      │
 *  │  ┌────────────────── ACTION FEED ─────────────────┐ │
 *  │  │  🌐 navigate  /dashboard          08:40:12     │ │
 *  │  │  🖱️  click     [data-nav="courses"] 08:40:14   │ │
 *  │  │  ✅ save_test  "Nav test"           08:40:16   │ │
 *  │  └────────────────────────────────────────────────┘ │
 *  │                                                      │
 *  │  [Pages] [Tests] [Bugs] [Cost]  (animated counters)  │
 *  └──────────────────────────────────────────────────────┘
 */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { TestRunActivity } from '../../hooks/useSessionManager';
import { CostInfo } from '../../hooks/useQALoopStream';

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
      <path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-2.5-2.5M14.5 2A2.5 2.5 0 0112 4.5"/>
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
  save_test_case:    { label: 'Test Case ✓', color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  icon: 'test' },
  add_bug:           { label: 'Bug Found!',  color: '#f87171', bg: 'rgba(248,113,113,0.15)', icon: 'bug' },
  get_page_elements: { label: 'Scan Page',   color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  icon: 'explore' },
  get_session_state: { label: 'Check State', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', icon: 'state' },
  mark_page_explored:{ label: 'Marked ✓',   color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  icon: 'explore' },
  add_page:          { label: 'Page Added',  color: '#818cf8', bg: 'rgba(129,140,248,0.12)', icon: 'navigate' },
  add_note:          { label: 'Note',        color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  icon: 'note' },
};

const getToolConfig = (tool: string) =>
  TOOL_CONFIG[tool] ?? { label: tool, color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', icon: 'explore' as const };

// ── Phase config ──────────────────────────────────────────────────────────────
const PHASE_CONFIG: Record<string, { label: string; color: string; pulse: boolean }> = {
  auth_exploration:         { label: '🔐 Auth Testing',    color: '#f59e0b', pulse: true },
  auth_exploration_complete:{ label: '🔐 Auth Done',       color: '#22c55e', pulse: false },
  login:                    { label: '🔑 Logging In',      color: '#60a5fa', pulse: true },
  login_complete:           { label: '🔑 Logged In',       color: '#22c55e', pulse: false },
  resume_login:             { label: '🔁 Resuming Login',  color: '#a78bfa', pulse: true },
  exploring:                { label: '🌐 Exploring',       color: '#34d399', pulse: true },
  test_execution:           { label: '🧪 Running Tests',   color: '#818cf8', pulse: true },
  running_tests:            { label: '🧪 Running Tests',   color: '#818cf8', pulse: true },
  cost_update:              { label: '💡 Calculating',     color: '#fbbf24', pulse: false },
  resume_no_credentials:    { label: '⚠️ No Credentials',  color: '#f87171', pulse: false },
};

const getPhaseConfig = (phase: string | null) =>
  phase ? (PHASE_CONFIG[phase] ?? { label: `⚡ ${phase}`, color: '#94a3b8', pulse: false }) : null;

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
    {active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? 'bg-green-400' : 'bg-gray-500'}`} />
  </span>
);

/** Big animated stat tile */
const StatTile: React.FC<{
  value: number | string;
  label: string;
  color: string;
  icon: React.ReactNode;
  pulse?: boolean;
}> = ({ value, label, color, icon, pulse }) => (
  <div className="flex flex-col items-center justify-center bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3 min-w-[90px] gap-1">
    <div className="flex items-center gap-1.5" style={{ color }}>
      {icon}
      <span className={`text-2xl font-bold tabular-nums ${pulse ? 'animate-pulse' : ''}`}>{value}</span>
    </div>
    <span className="text-xs text-gray-400 font-medium tracking-wide uppercase">{label}</span>
  </div>
);

/** Single action feed row */
const ActionRow: React.FC<{
  call: { tool: string; input: any; result?: any; timestamp: string };
  isNew?: boolean;
}> = ({ call, isNew }) => {
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
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs transition-all duration-300 ${isNew ? 'scale-[1.01]' : ''}`}
      style={{ background: cfg.bg, borderColor: cfg.color + '30' }}
    >
      <span style={{ color: cfg.color }} className="shrink-0 flex items-center">
        <IconComp />
      </span>
      <span className="font-semibold shrink-0" style={{ color: cfg.color, minWidth: '88px' }}>
        {cfg.label}
      </span>
      {hint && (
        <span className="text-gray-300 truncate flex-1 font-mono text-[11px]" title={hint}>
          {hint}
        </span>
      )}
      <span className="text-gray-500 shrink-0 ml-auto flex items-center gap-1">
        {call.result !== undefined
          ? <span className="text-green-400">✓</span>
          : <span className="animate-spin w-3 h-3 border border-gray-500 border-t-gray-300 rounded-full inline-block" />
        }
        {formatTimestamp(call.timestamp)}
      </span>
    </div>
  );
};

/** Test result notification */
const TestResultBadge: React.FC<{ activity: TestRunActivity }> = ({ activity }) => {
  const colors = {
    running: { bg: 'rgba(96,165,250,0.15)', border: '#60a5fa40', text: '#60a5fa', icon: '⏳' },
    passed:  { bg: 'rgba(74,222,128,0.15)', border: '#4ade8040', text: '#4ade80', icon: '✅' },
    failed:  { bg: 'rgba(248,113,113,0.15)',border: '#f8717140', text: '#f87171', icon: '❌' },
    error:   { bg: 'rgba(251,146,60,0.15)', border: '#fb923c40', text: '#fb923c', icon: '⚠️' },
  };
  const c = colors[activity.status] || colors.error;
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border"
      style={{ background: c.bg, borderColor: c.border }}
    >
      <span>{c.icon}</span>
      <span className="font-medium text-gray-200 truncate flex-1" title={activity.testCaseName}>
        {activity.testCaseName}
      </span>
      <span style={{ color: c.text }} className="shrink-0 font-semibold">
        {activity.status === 'running' ? '…' : activity.status}
        {activity.durationMs ? ` (${(activity.durationMs / 1000).toFixed(1)}s)` : ''}
      </span>
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
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const thinkingContainerRef = useRef<HTMLDivElement>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const prevToolCallsLen = useRef(toolCalls.length);

  // ── Elapsed timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionStartTime || !isRunning) return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - sessionStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime, isRunning]);

  // ── Auto-scroll feed (scoped to container — never scrolls the page) ────────
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

  // Thinking text — keep last 2000 chars to avoid overflow
  const displayThinking = thinkingText.slice(-2000);

  // Last 30 tool calls reversed (newest first in reverse, but we show oldest→newest)
  const displayCalls = useMemo(() => toolCalls.slice(-40), [toolCalls]);

  return (
    <div className="space-y-4">

      {/* ── Phase Banner ─────────────────────────────────────────────────────── */}
      {(isRunning || phaseConfig) && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border"
          style={{
            background: phaseConfig ? phaseConfig.color + '15' : 'rgba(99,102,241,0.1)',
            borderColor: phaseConfig ? phaseConfig.color + '40' : '#6366f140',
          }}
        >
          <LiveDot active={isRunning} />
          {phaseConfig && (
            <span
              className={`font-semibold text-sm ${phaseConfig.pulse && isRunning ? 'animate-pulse' : ''}`}
              style={{ color: phaseConfig.color }}
            >
              {phaseConfig.label}
            </span>
          )}
          {currentMessage && (
            <span className="text-sm text-gray-300 truncate flex-1">{currentMessage}</span>
          )}
          {!currentMessage && !phaseConfig && isRunning && (
            <span className="text-sm text-gray-400 animate-pulse">AI is working…</span>
          )}
          {elapsedMs > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-gray-400 shrink-0">
              <Icons.clock /> {formatTime(elapsedMs)}
            </span>
          )}
        </div>
      )}

      {/* ── Main Grid: Browser + Thinking ────────────────────────────────────── */}
      <div className={`grid gap-4 ${expandedPreview ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[3fr_2fr]'}`}>

        {/* Browser Preview */}
        <div className="rounded-xl overflow-hidden border border-gray-700/60 bg-gray-900/80"
          style={{ boxShadow: '0 0 40px rgba(0,0,0,0.5), 0 0 1px rgba(99,102,241,0.3) inset' }}>
          {/* Browser chrome bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/90 border-b border-gray-700/50">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <div className="w-3 h-3 rounded-full bg-green-400/70" />
            </div>
            <div className="flex-1 flex items-center gap-2 mx-2 bg-gray-700/50 rounded-md px-3 py-1">
              <Icons.monitor />
              <span className="text-xs text-gray-300 truncate font-mono">
                {currentUrl || '—'}
              </span>
            </div>
            <button
              onClick={() => setExpandedPreview(!expandedPreview)}
              className="text-gray-400 hover:text-gray-200 transition-colors p-1"
              title={expandedPreview ? 'Minimize' : 'Expand'}
            >
              {expandedPreview ? <Icons.compress /> : <Icons.expand />}
            </button>
          </div>
          {/* Screenshot area */}
          <div className={`relative ${expandedPreview ? 'h-[520px]' : 'h-64 lg:h-80'} bg-gray-950 flex items-center justify-center`}>
            {currentScreenshot ? (
              <img
                src={currentScreenshot}
                alt="Live browser view"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-600">
                {isRunning ? (
                  <>
                    <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
                    <span className="text-sm text-gray-500">Waiting for first screenshot…</span>
                  </>
                ) : (
                  <>
                    <Icons.monitor />
                    <span className="text-sm">No preview available</span>
                  </>
                )}
              </div>
            )}
            {/* Live indicator overlay */}
            {isRunning && currentScreenshot && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 rounded-full px-2 py-1">
                <LiveDot />
                <span className="text-xs text-green-400 font-semibold">LIVE</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Thinking Panel */}
        {!expandedPreview && (
          <div className="rounded-xl border border-gray-700/60 bg-gray-900/80 overflow-hidden flex flex-col"
            style={{ boxShadow: '0 0 40px rgba(0,0,0,0.5)' }}>
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-800/90 border-b border-gray-700/50">
              <span className="text-green-400"><Icons.brain /></span>
              <span className="text-sm font-semibold text-gray-200">AI Thinking</span>
              {thinkingText && isRunning && (
                <span className="ml-1 flex gap-0.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1 h-1 rounded-full bg-green-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
              )}
              <button
                onClick={() => setShowThinking(!showThinking)}
                className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-0.5 rounded bg-gray-700/50"
              >
                {showThinking ? 'Hide' : 'Show'}
              </button>
            </div>
            {/* Content */}
            {showThinking ? (
              <div ref={thinkingContainerRef} className="flex-1 overflow-y-auto p-3 font-mono text-xs text-green-300/90 leading-relaxed"
                style={{ minHeight: '200px', maxHeight: '320px', background: 'rgba(0,20,0,0.4)' }}>
                {displayThinking || (
                  <span className="text-gray-600 italic">
                    {isRunning ? 'Waiting for AI response…' : 'Session is paused or stopped.'}
                  </span>
                )}
                {/* Blinking cursor while streaming */}
                {isRunning && thinkingText && (
                  <span className="inline-block w-2 h-3 bg-green-400 animate-pulse ml-0.5 align-bottom" />
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-gray-600 p-4">
                Click "Show" to see AI reasoning
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Stats Bar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 justify-start">
        <StatTile value={iteration || 0} label="Iteration" color="#818cf8"
          icon={<Icons.spark />} pulse={isRunning} />
        <StatTile value={pagesExplored} label="Pages" color="#60a5fa"
          icon={<Icons.navigate />} />
        <StatTile value={testsGenerated} label="Tests" color="#4ade80"
          icon={<Icons.test />} />
        <StatTile value={bugsFound} label="Bugs" color="#f87171"
          icon={<Icons.bug />} />
        {testRunActivity.length > 0 && (
          <>
            <StatTile
              value={testRunActivity.filter(a => a.status === 'passed').length}
              label="Passed" color="#22d3ee"
              icon={<Icons.test />}
            />
            <StatTile
              value={testRunActivity.filter(a => a.status === 'failed' || a.status === 'error').length}
              label="Failed" color="#fb923c"
              icon={<Icons.bug />}
            />
          </>
        )}
        {costDollars && Number(costDollars) > 0 && (
          <StatTile value={`$${costDollars}`} label="Cost" color="#fbbf24"
            icon={<Icons.dollar />} />
        )}
      </div>

      {/* ── Test Execution Feed ───────────────────────────────────────────────── */}
      {testRunActivity.length > 0 && (
        <div className="rounded-xl border border-gray-700/60 bg-gray-900/80 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/90 border-b border-gray-700/50">
            <span className="text-indigo-400"><Icons.test /></span>
            <span className="text-sm font-semibold text-gray-200">Test Execution</span>
            <span className="ml-1 text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full">
              {testRunActivity.filter(a => a.status === 'passed').length}/{testRunActivity.length} passed
            </span>
          </div>
          <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto">
            {[...testRunActivity].reverse().map(activity => (
              <TestResultBadge key={activity.testCaseId} activity={activity} />
            ))}
          </div>
          {testRunActivity.some(a => a.failureReason) && (
            <div className="px-4 pb-3 text-xs text-red-400 truncate border-t border-gray-700/30 pt-2">
              ⚠ {testRunActivity.find(a => a.failureReason)?.failureReason}
            </div>
          )}
        </div>
      )}

      {/* ── Action Feed ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-700/60 bg-gray-900/80 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/90 border-b border-gray-700/50">
          <span className="text-purple-400"><Icons.spark /></span>
          <span className="text-sm font-semibold text-gray-200">Action Feed</span>
          {toolCalls.length > 0 && (
            <span className="ml-1 text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full">
              {toolCalls.length}
            </span>
          )}
          <button
            onClick={() => setShowToolCalls(!showToolCalls)}
            className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-0.5 rounded bg-gray-700/50"
          >
            {showToolCalls ? 'Hide' : 'Show'}
          </button>
        </div>
        {showToolCalls && (
          <div ref={feedContainerRef} className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
            {displayCalls.length === 0 ? (
              <div className="text-gray-600 text-sm py-3 text-center italic">
                {isRunning ? 'Waiting for first action…' : 'No actions recorded'}
              </div>
            ) : (
              displayCalls.map((call, idx) => (
                <ActionRow
                  key={idx}
                  call={call}
                  isNew={idx >= prevToolCallsLen.current - 1}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
