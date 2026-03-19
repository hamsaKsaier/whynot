import React, { useState, useEffect, useMemo } from 'react';
import {
  FiClock, FiPlus, FiTrash2, FiPlay, FiPause, FiRefreshCw,
  FiCheck, FiX, FiAlertTriangle, FiLoader, FiExternalLink,
  FiEdit2, FiChevronDown, FiChevronUp, FiCalendar, FiGlobe
} from 'react-icons/fi';
import { apiClient } from '../services/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface QAMonitor {
  id: string;
  name: string;
  target_url: string;
  cron_expression: string;
  quality_threshold: number;
  max_iterations: number;
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_session_id: string | null;
  last_quality_score: number | null;
  last_status: 'pass' | 'fail' | 'running' | 'error' | null;
  consecutive_failures: number;
  created_at: string;
}

interface HistoryEntry {
  id: string;
  target_url: string;
  status: string;
  quality_score: number | null;
  bugs_found: number;
  tests_generated: number;
  created_at: string;
  completed_at: string | null;
}

type ScheduleType = 'daily' | 'weekly' | 'monthly' | 'custom';

// ── Cron-to-text utility ─────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseCronField(field: string, min: number, max: number): number[] {
  if (field === '*') return [];
  const values: number[] = [];
  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) values.push(i);
    } else if (part.includes('/')) {
      const [base, step] = part.split('/');
      const start = base === '*' ? min : parseInt(base, 10);
      const stepN = parseInt(step, 10);
      for (let i = start; i <= max; i += stepN) values.push(i);
    } else {
      const v = parseInt(part, 10);
      if (!isNaN(v)) values.push(v);
    }
  }
  return values.filter(v => v >= min && v <= max);
}

function formatTime12(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

function cronToHumanReadable(cron: string): string {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return cron;

    const [minuteF, hourF, domF, _monthF, dowF] = parts;
    const minutes = parseCronField(minuteF, 0, 59);
    const hours = parseCronField(hourF, 0, 23);
    const doms = parseCronField(domF, 1, 31);
    const dows = parseCronField(dowF, 0, 6);

    // "every minute" variant
    if (minuteF === '*' && hourF === '*') return 'Every minute';

    // "every N minutes"
    if (minuteF.startsWith('*/') && hourF === '*') {
      const step = parseInt(minuteF.split('/')[1], 10);
      return `Every ${step} minute${step !== 1 ? 's' : ''}`;
    }

    // "every N hours"
    if (minuteF !== '*' && hourF.startsWith('*/')) {
      const step = parseInt(hourF.split('/')[1], 10);
      const min = minutes[0] ?? 0;
      return `Every ${step} hour${step !== 1 ? 's' : ''} at :${min.toString().padStart(2, '0')}`;
    }

    // Time string
    const hour = hours.length > 0 ? hours[0] : 0;
    const minute = minutes.length > 0 ? minutes[0] : 0;
    const timeStr = formatTime12(hour, minute);

    // Day of month
    if (doms.length > 0 && dowF === '*') {
      const dayStr = doms.map(d => {
        const suffix = d === 1 || d === 21 || d === 31 ? 'st' :
                       d === 2 || d === 22 ? 'nd' :
                       d === 3 || d === 23 ? 'rd' : 'th';
        return `${d}${suffix}`;
      }).join(', ');
      return `Monthly on the ${dayStr} at ${timeStr}`;
    }

    // Day of week
    if (dows.length > 0) {
      if (dows.length === 5 && dows.every((d, i) => d === i + 1)) {
        return `Weekdays at ${timeStr}`;
      }
      if (dows.length === 7) {
        return `Every day at ${timeStr}`;
      }
      const dayNames = dows.map(d => DAY_NAMES[d]);
      if (dayNames.length === 1) {
        return `Every ${dayNames[0]} at ${timeStr}`;
      }
      const last = dayNames.pop();
      return `Every ${dayNames.join(', ')} and ${last} at ${timeStr}`;
    }

    // Daily (hour set, no dow/dom)
    if (hours.length > 0 && dowF === '*' && domF === '*') {
      return `Every day at ${timeStr}`;
    }

    // Hourly (minute set, hour is *)
    if (hourF === '*' && minutes.length > 0) {
      return `Every hour at :${minutes[0].toString().padStart(2, '0')}`;
    }

    return cron;
  } catch {
    return cron;
  }
}

function getNextCronRuns(cron: string, count: number): Date[] {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return [];

    const [minuteF, hourF, domF, _monthF, dowF] = parts;
    const runs: Date[] = [];
    const now = new Date();
    const candidate = new Date(now);
    candidate.setSeconds(0);
    candidate.setMilliseconds(0);

    for (let attempt = 0; attempt < 1000 && runs.length < count; attempt++) {
      candidate.setMinutes(candidate.getMinutes() + 1);

      const min = candidate.getMinutes();
      const hr = candidate.getHours();
      const dom = candidate.getDate();
      const dow = candidate.getDay();

      if (minuteF !== '*' && !parseCronField(minuteF, 0, 59).includes(min)) continue;
      if (hourF !== '*' && !parseCronField(hourF, 0, 23).includes(hr)) continue;
      if (domF !== '*' && !parseCronField(domF, 1, 31).includes(dom)) continue;
      if (dowF !== '*' && !parseCronField(dowF, 0, 6).includes(dow)) continue;

      runs.push(new Date(candidate));
    }
    return runs;
  } catch {
    return [];
  }
}

// ── Timezone ─────────────────────────────────────────────────────────────────

const USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// ── Component ────────────────────────────────────────────────────────────────

const statusIcons: Record<string, React.ReactNode> = {
  pass: <FiCheck className="h-4 w-4 text-green-400" />,
  fail: <FiX className="h-4 w-4 text-red-400" />,
  running: <FiLoader className="h-4 w-4 text-blue-400 animate-spin" />,
  error: <FiAlertTriangle className="h-4 w-4 text-yellow-400" />,
};

const statusLabels: Record<string, string> = {
  pass: 'Passing',
  fail: 'Failing',
  running: 'Running',
  error: 'Error',
};

export const MonitorsPage: React.FC = () => {
  const [monitors, setMonitors] = useState<QAMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMonitorId, setEditingMonitorId] = useState<string | null>(null);
  const [expandedMonitorId, setExpandedMonitorId] = useState<string | null>(null);
  const [historyMap, setHistoryMap] = useState<Record<string, HistoryEntry[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    target_url: '',
    cron_expression: '0 9 * * *',
    quality_threshold: 80,
    max_iterations: 5,
  });
  const [scheduleType, setScheduleType] = useState<ScheduleType>('daily');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleDays, setScheduleDays] = useState<number[]>([1]); // Monday
  const [scheduleDom, setScheduleDom] = useState(1);
  const [customCron, setCustomCron] = useState('0 9 * * *');

  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadMonitors = async () => {
    try {
      const res = await apiClient.get('/monitors');
      setMonitors(res.data);
    } catch (error) {
      console.error('Failed to load monitors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitors();
    const interval = setInterval(loadMonitors, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadHistory = async (monitorId: string) => {
    if (historyMap[monitorId]) return;
    setHistoryLoading(monitorId);
    try {
      const res = await apiClient.get(`/monitors/${monitorId}/history?limit=30`);
      setHistoryMap(prev => ({ ...prev, [monitorId]: res.data }));
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(null);
    }
  };

  // ── Build cron from schedule UI ──────────────────────────────────────────

  const buildCronFromSchedule = (): string => {
    const [h, m] = scheduleTime.split(':').map(Number);
    switch (scheduleType) {
      case 'daily':
        return `${m} ${h} * * *`;
      case 'weekly': {
        const days = scheduleDays.length > 0 ? scheduleDays.sort().join(',') : '1';
        return `${m} ${h} * * ${days}`;
      }
      case 'monthly':
        return `${m} ${h} ${scheduleDom} * *`;
      case 'custom':
        return customCron;
    }
  };

  const detectScheduleType = (cron: string): void => {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      setScheduleType('custom');
      setCustomCron(cron);
      return;
    }
    const [minF, hourF, domF, _monthF, dowF] = parts;
    const min = parseInt(minF, 10);
    const hr = parseInt(hourF, 10);

    if (!isNaN(min) && !isNaN(hr)) {
      setScheduleTime(`${hr.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    }

    if (domF !== '*' && dowF === '*') {
      setScheduleType('monthly');
      setScheduleDom(parseInt(domF, 10) || 1);
    } else if (dowF !== '*' && domF === '*') {
      setScheduleType('weekly');
      setScheduleDays(parseCronField(dowF, 0, 6));
    } else if (domF === '*' && dowF === '*' && !isNaN(hr)) {
      setScheduleType('daily');
    } else {
      setScheduleType('custom');
      setCustomCron(cron);
    }
  };

  // Compute the cron for preview
  const activeCron = useMemo(() => buildCronFromSchedule(), [scheduleType, scheduleTime, scheduleDays, scheduleDom, customCron]);
  const cronPreview = useMemo(() => cronToHumanReadable(activeCron), [activeCron]);
  const nextRuns = useMemo(() => getNextCronRuns(activeCron, 3), [activeCron]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({ name: '', target_url: '', cron_expression: '0 9 * * *', quality_threshold: 80, max_iterations: 5 });
    setScheduleType('daily');
    setScheduleTime('09:00');
    setScheduleDays([1]);
    setScheduleDom(1);
    setCustomCron('0 9 * * *');
    setEditingMonitorId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.target_url) return;

    let targetUrl = form.target_url.trim();
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

    const cronExpr = buildCronFromSchedule();
    setSaving(true);
    try {
      if (editingMonitorId) {
        await apiClient.put(`/monitors/${editingMonitorId}`, { ...form, target_url: targetUrl, cron_expression: cronExpr });
      } else {
        await apiClient.post('/monitors', { ...form, target_url: targetUrl, cron_expression: cronExpr });
      }
      setShowForm(false);
      resetForm();
      loadMonitors();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save monitor');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (monitor: QAMonitor) => {
    setForm({
      name: monitor.name,
      target_url: monitor.target_url,
      cron_expression: monitor.cron_expression,
      quality_threshold: monitor.quality_threshold,
      max_iterations: monitor.max_iterations,
    });
    detectScheduleType(monitor.cron_expression);
    setEditingMonitorId(monitor.id);
    setShowForm(true);
  };

  const handlePause = async (id: string) => {
    try {
      await apiClient.patch(`/monitors/${id}/pause`);
      loadMonitors();
    } catch (error) {
      console.error('Failed to pause monitor:', error);
    }
  };

  const handleResume = async (id: string) => {
    try {
      await apiClient.patch(`/monitors/${id}/resume`);
      loadMonitors();
    } catch (error) {
      console.error('Failed to resume monitor:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/monitors/${id}`);
      setDeleteConfirmId(null);
      setHistoryMap(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      loadMonitors();
    } catch (error) {
      console.error('Failed to delete monitor:', error);
    }
  };

  const handleTrigger = async (id: string) => {
    setTriggering(id);
    try {
      await apiClient.post(`/monitors/${id}/trigger`);
      setTimeout(loadMonitors, 2000);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to trigger monitor');
    } finally {
      setTriggering(null);
    }
  };

  const toggleHistory = (monitorId: string) => {
    if (expandedMonitorId === monitorId) {
      setExpandedMonitorId(null);
    } else {
      setExpandedMonitorId(monitorId);
      loadHistory(monitorId);
    }
  };

  // ── Formatting helpers ───────────────────────────────────────────────────

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  const formatNextRun = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff < 0) return 'Due now';
    if (diff < 60000) return 'Less than a minute';
    if (diff < 3600000) return `${Math.round(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h`;
    return `${Math.round(diff / 86400000)}d`;
  };

  const formatDuration = (start: string, end: string | null): string => {
    if (!end) return 'In progress';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return '<1s';
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const getStatusDot = (monitor: QAMonitor): string => {
    if (!monitor.is_enabled) return 'bg-slate-500';
    if (monitor.last_status === 'fail' || monitor.last_status === 'error' || monitor.consecutive_failures > 0) return 'bg-red-400';
    if (monitor.last_status === 'running') return 'bg-blue-400 animate-pulse';
    if (monitor.last_status === 'pass') return 'bg-green-400';
    return 'bg-slate-500';
  };

  const getResultBadge = (status: string | null) => {
    if (status === 'pass' || status === 'completed') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/40 text-green-400 border border-green-800">Pass</span>;
    }
    if (status === 'fail' || status === 'failed') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/40 text-red-400 border border-red-800">Fail</span>;
    }
    if (status === 'running') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/40 text-blue-400 border border-blue-800">Running</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400 border border-slate-600">Never run</span>;
  };

  // ── Regression helpers for history ───────────────────────────────────────

  const getBugDiff = (history: HistoryEntry[], index: number): React.ReactNode => {
    const current = history[index];
    if (index >= history.length - 1) return <span className="text-slate-500">--</span>;
    const previous = history[index + 1];
    const diff = current.bugs_found - previous.bugs_found;
    if (diff > 0) return <span className="text-red-400 font-medium">+{diff} new bug{diff !== 1 ? 's' : ''}</span>;
    if (diff < 0) return <span className="text-green-400 font-medium">{diff} bug{Math.abs(diff) !== 1 ? 's' : ''} fixed</span>;
    return <span className="text-slate-500">No change</span>;
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FiLoader className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FiClock className="h-6 w-6 text-sky-500" />
            QA Monitors
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Schedule recurring QA scans to monitor your apps continuously
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
        >
          <FiPlus className="h-4 w-4" />
          New Monitor
        </button>
      </div>

      {/* ── Create / Edit Form ──────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingMonitorId ? 'Edit Monitor' : 'Create Monitor'}
          </h2>
          <form onSubmit={handleCreate} className="space-y-5">
            {/* Name + URL */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Production Health Check"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Target URL</label>
                <input
                  type="text"
                  value={form.target_url}
                  onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))}
                  placeholder="https://your-app.com"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* ── Schedule Section ───────────────────────────────────────── */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Schedule</label>

              {/* Schedule type radio buttons */}
              <div className="flex gap-2 mb-3">
                {(['daily', 'weekly', 'monthly', 'custom'] as ScheduleType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setScheduleType(type)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      scheduleType === type
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>

              {/* Time picker for daily/weekly/monthly */}
              {scheduleType !== 'custom' && (
                <div className="flex items-center gap-4 mb-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Time</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* Day-of-week picker for weekly */}
              {scheduleType === 'weekly' && (
                <div className="mb-3">
                  <label className="block text-xs text-slate-400 mb-2">Days of the week</label>
                  <div className="flex gap-1">
                    {DAY_SHORT.map((day, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setScheduleDays(prev =>
                            prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                          );
                        }}
                        className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                          scheduleDays.includes(i)
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Day-of-month picker for monthly */}
              {scheduleType === 'monthly' && (
                <div className="mb-3">
                  <label className="block text-xs text-slate-400 mb-1">Day of month</label>
                  <select
                    value={scheduleDom}
                    onChange={e => setScheduleDom(Number(e.target.value))}
                    className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Custom cron input */}
              {scheduleType === 'custom' && (
                <div className="mb-3">
                  <label className="block text-xs text-slate-400 mb-1">Cron expression</label>
                  <input
                    type="text"
                    value={customCron}
                    onChange={e => setCustomCron(e.target.value)}
                    placeholder="0 9 * * 1-5"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 font-mono text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Schedule preview */}
              <div className="bg-slate-900 rounded-lg border border-slate-700 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <FiCalendar className="h-4 w-4 text-sky-500" />
                  <span className="text-slate-200 font-medium">{cronPreview}</span>
                </div>
                {nextRuns.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    Next runs: {nextRuns.map((d, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        {d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                  <FiGlobe className="h-3 w-3" />
                  All times in {USER_TIMEZONE}
                </div>
              </div>
            </div>

            {/* Quality + Iterations */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Quality Threshold</label>
                <select
                  value={form.quality_threshold}
                  onChange={e => setForm(f => ({ ...f, quality_threshold: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                >
                  {[60, 70, 80, 90].map(v => (
                    <option key={v} value={v}>{v}%</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Max Iterations</label>
                <select
                  value={form.max_iterations}
                  onChange={e => setForm(f => ({ ...f, max_iterations: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                >
                  {[3, 5, 10, 20].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : editingMonitorId ? <FiCheck className="h-4 w-4" /> : <FiPlus className="h-4 w-4" />}
                {editingMonitorId ? 'Save Changes' : 'Create Monitor'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Monitor List ────────────────────────────────────────────────── */}
      {monitors.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <FiClock className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No monitors yet</h3>
          <p className="text-slate-400 mb-4">
            Create a monitor to run scheduled QA scans on your apps
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
          >
            <FiPlus className="h-4 w-4" />
            Create your first monitor
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {monitors.map((monitor) => (
            <div key={monitor.id}>
              {/* Monitor Card */}
              <div
                className={`bg-slate-800 rounded-xl border p-5 transition-colors ${
                  monitor.is_enabled ? 'border-slate-700' : 'border-slate-700 opacity-60'
                } ${expandedMonitorId === monitor.id ? 'rounded-b-none border-b-0' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: status dot + info */}
                  <div
                    className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => toggleHistory(monitor.id)}
                  >
                    {/* Status dot */}
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${getStatusDot(monitor)}`} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white truncate">{monitor.name}</h3>
                        {!monitor.is_enabled && (
                          <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded border border-slate-600">Paused</span>
                        )}
                        {getResultBadge(monitor.last_status)}
                      </div>

                      {/* Details row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="truncate max-w-xs" title={monitor.target_url}>{monitor.target_url}</span>
                        <span>{cronToHumanReadable(monitor.cron_expression)}</span>
                        <span>Last run: {formatDate(monitor.last_run_at)}</span>
                        {monitor.is_enabled && monitor.next_run_at && (
                          <span>Next: {formatNextRun(monitor.next_run_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleTrigger(monitor.id)}
                      disabled={triggering === monitor.id || monitor.last_status === 'running'}
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                      title="Run now"
                    >
                      {triggering === monitor.id ? (
                        <FiLoader className="h-4 w-4 animate-spin" />
                      ) : (
                        <FiPlay className="h-4 w-4" />
                      )}
                    </button>
                    {monitor.is_enabled ? (
                      <button
                        onClick={() => handlePause(monitor.id)}
                        className="p-2 text-slate-400 hover:text-yellow-400 hover:bg-yellow-900/20 rounded-lg transition-colors"
                        title="Pause"
                      >
                        <FiPause className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleResume(monitor.id)}
                        className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Resume"
                      >
                        <FiRefreshCw className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(monitor)}
                      className="p-2 text-slate-400 hover:text-sky-400 hover:bg-sky-900/20 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </button>
                    {monitor.last_session_id && (
                      <a
                        href={`/qa-loop?session=${monitor.last_session_id}`}
                        className="p-2 text-slate-400 hover:text-sky-400 hover:bg-sky-900/20 rounded-lg transition-colors"
                        title="View last session"
                      >
                        <FiExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      onClick={() => setDeleteConfirmId(monitor.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleHistory(monitor.id)}
                      className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
                      title={expandedMonitorId === monitor.id ? 'Hide history' : 'Show history'}
                    >
                      {expandedMonitorId === monitor.id ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Consecutive failures warning */}
                {monitor.consecutive_failures > 2 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400 bg-yellow-900/20 px-3 py-2 rounded-lg border border-yellow-800/40">
                    <FiAlertTriangle className="h-3 w-3" />
                    {monitor.consecutive_failures} consecutive failures
                  </div>
                )}
              </div>

              {/* ── History Panel ─────────────────────────────────────────── */}
              {expandedMonitorId === monitor.id && (
                <div className="bg-slate-800 border border-slate-700 border-t-0 rounded-b-xl px-5 pb-5">
                  <div className="border-t border-slate-700 pt-4">
                    <h4 className="text-sm font-semibold text-slate-300 mb-3">Run History (last 30)</h4>

                    {historyLoading === monitor.id ? (
                      <div className="flex items-center justify-center py-6">
                        <FiLoader className="h-5 w-5 animate-spin text-slate-500" />
                      </div>
                    ) : !historyMap[monitor.id] || historyMap[monitor.id].length === 0 ? (
                      <p className="text-sm text-slate-500 py-4 text-center">No runs yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-slate-500 uppercase tracking-wider">
                              <th className="text-left pb-2 pr-4">Date</th>
                              <th className="text-left pb-2 pr-4">Duration</th>
                              <th className="text-left pb-2 pr-4">Status</th>
                              <th className="text-left pb-2 pr-4">Bugs</th>
                              <th className="text-left pb-2 pr-4">Comparison</th>
                              <th className="text-left pb-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/50">
                            {historyMap[monitor.id].map((entry, idx) => {
                              const history = historyMap[monitor.id];
                              const prevEntry = idx < history.length - 1 ? history[idx + 1] : null;
                              const newRegressions = prevEntry ? Math.max(0, entry.bugs_found - prevEntry.bugs_found) : 0;

                              return (
                                <tr key={entry.id} className="text-slate-300">
                                  <td className="py-2 pr-4 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                                  <td className="py-2 pr-4 whitespace-nowrap text-slate-400">
                                    {formatDuration(entry.created_at, entry.completed_at)}
                                  </td>
                                  <td className="py-2 pr-4">{getResultBadge(entry.status)}</td>
                                  <td className="py-2 pr-4">{entry.bugs_found}</td>
                                  <td className="py-2 pr-4">
                                    {getBugDiff(history, idx)}
                                    {newRegressions > 0 && (
                                      <span className="ml-2 text-yellow-400 text-xs font-medium">
                                        {newRegressions} new regression{newRegressions !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 text-right">
                                    <a
                                      href={`/qa-loop?session=${entry.id}`}
                                      className="text-sky-500 hover:text-sky-400 text-xs"
                                    >
                                      View
                                    </a>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Monitor</h3>
            <p className="text-slate-400 text-sm mb-6">
              Are you sure? This will delete the monitor and all its history. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
