/**
 * AgentProgressPanel — shows multi-agent status during v2 scans.
 *
 * Displays each agent's progress (idle/working/done), discovery count,
 * and current task. Polls the /agents endpoint during running scans,
 * uses cached data after completion.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../services/api';
import { FiCheckCircle, FiAlertTriangle, FiLoader, FiClock } from 'react-icons/fi';

interface AgentBoardEntry {
  agent_type: string;
  status: string;
  current_task: string | null;
  progress_pct: number;
  discoveries: any[];
  pages_explored: number;
  tests_generated: number;
  bugs_found: number;
  api_endpoints_tested: number;
}

const AGENT_META: Record<string, { icon: string; label: string }> = {
  qa_lead:     { icon: '\uD83E\uDDE0', label: 'QA Lead' },
  exploratory: { icon: '\uD83D\uDD0D', label: 'Exploratory' },
  security:    { icon: '\uD83D\uDD10', label: 'Security' },
  api_tester:  { icon: '\uD83C\uDF10', label: 'API Tester' },
  auto_tester: { icon: '\uD83E\uDD16', label: 'Auto Tester' },
};

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'done':
      return <span className="flex items-center gap-1 text-green-400 text-xs"><FiCheckCircle className="w-3.5 h-3.5" /> Done</span>;
    case 'working':
      return <span className="flex items-center gap-1 text-sky-400 text-xs"><FiLoader className="w-3.5 h-3.5 animate-spin" /> Working</span>;
    case 'error':
      return <span className="flex items-center gap-1 text-red-400 text-xs"><FiAlertTriangle className="w-3.5 h-3.5" /> Error</span>;
    default:
      return <span className="flex items-center gap-1 text-slate-500 text-xs"><FiClock className="w-3.5 h-3.5" /> Idle</span>;
  }
}

function AgentRow({ entry }: { entry: AgentBoardEntry }) {
  const meta = AGENT_META[entry.agent_type] || { icon: '\u2699\uFE0F', label: entry.agent_type };
  const stats: string[] = [];
  if (entry.pages_explored > 0) stats.push(`${entry.pages_explored} pages`);
  if (entry.bugs_found > 0) stats.push(`${entry.bugs_found} bugs`);
  if (entry.tests_generated > 0) stats.push(`${entry.tests_generated} tests`);
  if (entry.api_endpoints_tested > 0) stats.push(`${entry.api_endpoints_tested} endpoints`);

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800/60 border border-slate-700/40">
      <span className="text-lg">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">{meta.label}</span>
          <StatusBadge status={entry.status} />
        </div>
        {entry.status === 'working' && entry.current_task && (
          <p className="text-xs text-slate-400 truncate mt-0.5">{entry.current_task}</p>
        )}
        {stats.length > 0 && entry.status !== 'idle' && (
          <p className="text-xs text-slate-500 mt-0.5">{stats.join(' \u00B7 ')}</p>
        )}
      </div>
      {entry.status === 'working' && entry.progress_pct > 0 && (
        <div className="w-12 h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${entry.progress_pct}%` }} />
        </div>
      )}
    </div>
  );
}

interface AgentProgressPanelProps {
  sessionId: string;
  isRunning: boolean;
}

export const AgentProgressPanel: React.FC<AgentProgressPanelProps> = ({ sessionId, isRunning }) => {
  const [agents, setAgents] = useState<AgentBoardEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await apiClient.get(`/qa-loop/sessions/${sessionId}/agents`);
      if (res.data?.agents && res.data.agents.length > 0) {
        setAgents(res.data.agents);
        setLoaded(true);
      }
    } catch {
      // silently ignore — may not be a v2 session
    }
  }, [sessionId]);

  useEffect(() => {
    fetchAgents();
    if (isRunning) {
      const interval = setInterval(fetchAgents, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchAgents, isRunning]);

  if (!loaded || agents.length === 0) return null;

  // Order agents by expected execution order
  const order = ['qa_lead', 'exploratory', 'security', 'api_tester', 'auto_tester'];
  const sorted = [...agents].sort((a, b) => order.indexOf(a.agent_type) - order.indexOf(b.agent_type));

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/80 p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <span className="text-base">{'\uD83E\uDD16'}</span> QA Team
        {isRunning && <span className="text-xs text-sky-400 animate-pulse">Live</span>}
      </h3>
      <div className="space-y-2">
        {sorted.map(entry => (
          <AgentRow key={entry.agent_type} entry={entry} />
        ))}
      </div>
    </div>
  );
};
