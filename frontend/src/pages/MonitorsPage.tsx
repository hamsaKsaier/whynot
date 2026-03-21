import React, { useState, useEffect } from 'react';
import { FiClock, FiPlus, FiTrash2, FiPlay, FiPause, FiRefreshCw, FiCheck, FiX, FiAlertTriangle, FiLoader, FiExternalLink } from 'react-icons/fi';
import { apiClient } from '../services/api';

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

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at 9am', value: '0 9 * * *' },
  { label: 'Weekdays at 9am', value: '0 9 * * 1-5' },
  { label: 'Weekly (Monday 9am)', value: '0 9 * * 1' },
  { label: 'Monthly (1st at midnight)', value: '0 0 1 * *' },
];

const statusIcons: Record<string, React.ReactNode> = {
  pass: <FiCheck className="h-4 w-4 text-green-500" />,
  fail: <FiX className="h-4 w-4 text-red-500" />,
  running: <FiLoader className="h-4 w-4 text-blue-500 animate-spin" />,
  error: <FiAlertTriangle className="h-4 w-4 text-yellow-500" />,
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
  const [form, setForm] = useState({
    name: '',
    target_url: '',
    cron_expression: '0 9 * * *',
    quality_threshold: 80,
    max_iterations: 5,
  });
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);

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
    // Refresh every 30s
    const interval = setInterval(loadMonitors, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.target_url) return;

    let targetUrl = form.target_url.trim();
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

    setSaving(true);
    try {
      await apiClient.post('/monitors', { ...form, target_url: targetUrl });
      setShowForm(false);
      setForm({ name: '', target_url: '', cron_expression: '0 9 * * *', quality_threshold: 80, max_iterations: 5 });
      loadMonitors();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create monitor');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    try {
      await apiClient.put(`/monitors/${id}`, { is_enabled: !currentEnabled });
      loadMonitors();
    } catch (error) {
      console.error('Failed to toggle monitor:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this monitor?')) return;
    try {
      await apiClient.delete(`/monitors/${id}`);
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

  const getCronLabel = (expr: string): string => {
    const preset = CRON_PRESETS.find(p => p.value === expr);
    return preset ? preset.label : expr;
  };

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
            <FiClock className="h-6 w-6 text-sky-600" />
            QA Monitors
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Schedule recurring QA scans to monitor your apps continuously
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
        >
          <FiPlus className="h-4 w-4" />
          New Monitor
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Create Monitor</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Production Health Check"
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Target URL</label>
                <input
                  type="text"
                  value={form.target_url}
                  onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))}
                  placeholder="https://your-app.com"
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Schedule</label>
                <select
                  value={form.cron_expression}
                  onChange={e => setForm(f => ({ ...f, cron_expression: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  {CRON_PRESETS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Quality Threshold</label>
                <select
                  value={form.quality_threshold}
                  onChange={e => setForm(f => ({ ...f, quality_threshold: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  {[60, 70, 80, 90].map(v => (
                    <option key={v} value={v}>{v}%</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Max Iterations</label>
                <select
                  value={form.max_iterations}
                  onChange={e => setForm(f => ({ ...f, max_iterations: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500"
                >
                  {[3, 5, 10, 20].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-slate-200 bg-slate-900 rounded-lg hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiPlus className="h-4 w-4" />}
                Create Monitor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Monitor list */}
      {monitors.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <FiClock className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No monitors yet</h3>
          <p className="text-slate-400 mb-4">
            Create a monitor to run scheduled QA scans on your apps
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
          >
            <FiPlus className="h-4 w-4" />
            Create your first monitor
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {monitors.map((monitor) => (
            <div
              key={monitor.id}
              className={`bg-slate-800 rounded-xl border p-5 transition-colors ${
                monitor.is_enabled ? 'border-slate-700' : 'border-slate-700 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Status indicator */}
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    monitor.last_status === 'pass' ? 'bg-green-400' :
                    monitor.last_status === 'fail' ? 'bg-red-400' :
                    monitor.last_status === 'running' ? 'bg-blue-400 animate-pulse' :
                    monitor.last_status === 'error' ? 'bg-yellow-400' :
                    'bg-slate-500'
                  }`} />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white truncate">{monitor.name}</h3>
                      {!monitor.is_enabled && (
                        <span className="text-xs bg-slate-900 text-slate-400 px-2 py-0.5 rounded">Paused</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="truncate max-w-xs">{monitor.target_url}</span>
                      <span className="text-slate-500">|</span>
                      <span>{getCronLabel(monitor.cron_expression)}</span>
                      <span className="text-slate-500">|</span>
                      <span>Threshold: {monitor.quality_threshold}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 flex-shrink-0">
                  {/* Last status */}
                  {monitor.last_status && (
                    <div className="flex items-center gap-1.5 text-sm">
                      {statusIcons[monitor.last_status]}
                      <span className="text-slate-400">{statusLabels[monitor.last_status]}</span>
                      {monitor.last_quality_score !== null && (
                        <span className="text-slate-500 ml-1">({monitor.last_quality_score})</span>
                      )}
                    </div>
                  )}

                  {/* Next run */}
                  {monitor.is_enabled && monitor.next_run_at && (
                    <div className="text-xs text-slate-500">
                      Next: {formatNextRun(monitor.next_run_at)}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTrigger(monitor.id)}
                      disabled={triggering === monitor.id || monitor.last_status === 'running'}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                      title="Run now"
                    >
                      {triggering === monitor.id ? (
                        <FiLoader className="h-4 w-4 animate-spin" />
                      ) : (
                        <FiPlay className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleToggle(monitor.id, monitor.is_enabled)}
                      className={`p-2 rounded-lg transition-colors ${
                        monitor.is_enabled
                          ? 'text-slate-500 hover:text-yellow-600 hover:bg-yellow-900/20'
                          : 'text-slate-500 hover:text-green-600 hover:bg-green-900/20'
                      }`}
                      title={monitor.is_enabled ? 'Pause' : 'Resume'}
                    >
                      {monitor.is_enabled ? <FiPause className="h-4 w-4" /> : <FiRefreshCw className="h-4 w-4" />}
                    </button>
                    {monitor.last_session_id && (
                      <a
                        href={`/qa-loop?session=${monitor.last_session_id}`}
                        className="p-2 text-slate-500 hover:text-sky-600 hover:bg-sky-900/20 rounded-lg transition-colors"
                        title="View last session"
                      >
                        <FiExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(monitor.id)}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Consecutive failures warning */}
              {monitor.consecutive_failures > 2 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-yellow-600 bg-yellow-900/20 px-3 py-2 rounded-lg">
                  <FiAlertTriangle className="h-3 w-3" />
                  {monitor.consecutive_failures} consecutive failures
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
