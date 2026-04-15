/**
 * AgentProgressPanel — shows multi-agent status during v2 scans.
 *
 * Displays each agent's progress (idle/working/done), discovery count,
 * and current task. Polls the /agents endpoint during running scans,
 * uses cached data after completion.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, Loader2, Clock } from 'lucide-react';

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
  const { t } = useTranslation('runner');
  switch (status) {
    case 'done':
      return (
        <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800">
          <CheckCircle className="h-3 w-3" /> {t('runner.qaLoop.agents.done')}
        </Badge>
      );
    case 'working':
      return (
        <Badge variant="outline" className="gap-1 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300 border-sky-200 dark:border-sky-800">
          <Loader2 className="h-3 w-3 animate-spin" /> {t('runner.qaLoop.agents.working')}
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800">
          <AlertTriangle className="h-3 w-3" /> {t('runner.qaLoop.agents.error')}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" /> {t('runner.qaLoop.agents.idle')}
        </Badge>
      );
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
    <Card className="shadow-none">
      <CardContent className="flex items-center gap-3 py-2 px-3">
        <span className="text-lg">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{meta.label}</span>
            <StatusBadge status={entry.status} />
          </div>
          {entry.status === 'working' && entry.current_task && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.current_task}</p>
          )}
          {stats.length > 0 && entry.status !== 'idle' && (
            <p className="text-xs text-muted-foreground mt-0.5">{stats.join(' \u00B7 ')}</p>
          )}
        </div>
        {entry.status === 'working' && entry.progress_pct > 0 && (
          <Progress value={entry.progress_pct} className="w-12 h-1.5" />
        )}
      </CardContent>
    </Card>
  );
}

interface AgentProgressPanelProps {
  sessionId: string;
  isRunning: boolean;
}

export const AgentProgressPanel: React.FC<AgentProgressPanelProps> = ({ sessionId, isRunning }) => {
  const { t } = useTranslation('runner');
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
    <Card className="mb-4">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span className="text-base">{'\uD83E\uDD16'}</span> {t('runner.qaLoop.agents.qaTeam')}
          {isRunning && (
            <Badge variant="outline" className="text-xs bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300 border-sky-200 dark:border-sky-800">
              Live
            </Badge>
          )}
        </h3>
        <div className="space-y-2">
          {sorted.map(entry => (
            <AgentRow key={entry.agent_type} entry={entry} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
