import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('dashboard');
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
      alert(error.response?.data?.error || t('dashboard.monitors.createError'));
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
    if (!window.confirm(t('dashboard.monitors.deleteConfirm'))) return;
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
      alert(error.response?.data?.error || t('dashboard.monitors.triggerError'));
    } finally {
      setTriggering(null);
    }
  };

  const formatNextRun = (dateStr: string | null) => {
    if (!dateStr) return t('dashboard.monitors.notScheduled');
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff < 0) return t('dashboard.monitors.dueNow');
    if (diff < 60000) return t('dashboard.monitors.lessThanMinute');
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
        <FiLoader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FiClock className="h-6 w-6 text-primary" />
            {t('dashboard.monitors.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('dashboard.monitors.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <FiPlus className="h-4 w-4" />
          {t('dashboard.monitors.new')}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-card rounded-lg border border-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('dashboard.monitors.createTitle')}</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('dashboard.monitors.nameLabel')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('dashboard.monitors.namePlaceholder')}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('dashboard.monitors.targetUrlLabel')}</label>
                <input
                  type="text"
                  value={form.target_url}
                  onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))}
                  placeholder="https://your-app.com"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('dashboard.monitors.scheduleLabel')}</label>
                <select
                  value={form.cron_expression}
                  onChange={e => setForm(f => ({ ...f, cron_expression: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                >
                  {CRON_PRESETS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('dashboard.monitors.qualityThresholdLabel')}</label>
                <select
                  value={form.quality_threshold}
                  onChange={e => setForm(f => ({ ...f, quality_threshold: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
                >
                  {[60, 70, 80, 90].map(v => (
                    <option key={v} value={v}>{v}%</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('dashboard.monitors.maxIterationsLabel')}</label>
                <select
                  value={form.max_iterations}
                  onChange={e => setForm(f => ({ ...f, max_iterations: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary"
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
                className="px-4 py-2 text-foreground bg-muted rounded-lg hover:bg-muted/70"
              >
                {t('dashboard.monitors.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiPlus className="h-4 w-4" />}
                {t('dashboard.monitors.createMonitor')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Monitor list */}
      {monitors.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <FiClock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t('dashboard.monitors.emptyTitle')}</h3>
          <p className="text-muted-foreground mb-4">
            {t('dashboard.monitors.emptyDescription')}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <FiPlus className="h-4 w-4" />
            {t('dashboard.monitors.createFirst')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {monitors.map((monitor) => (
            <div
              key={monitor.id}
              className={`bg-card rounded-lg border p-5 transition-colors ${
                monitor.is_enabled ? 'border-border' : 'border-border opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Status indicator */}
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    monitor.last_status === 'pass' ? 'bg-green-400' :
                    monitor.last_status === 'fail' ? 'bg-red-400' :
                    monitor.last_status === 'running' ? 'bg-blue-400' :
                    monitor.last_status === 'error' ? 'bg-yellow-400' :
                    'bg-muted-foreground'
                  }`} />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{monitor.name}</h3>
                      {!monitor.is_enabled && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{t('dashboard.monitors.paused')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="truncate max-w-xs">{monitor.target_url}</span>
                      <span className="text-muted-foreground">|</span>
                      <span>{getCronLabel(monitor.cron_expression)}</span>
                      <span className="text-muted-foreground">|</span>
                      <span>{t('dashboard.monitors.threshold')}: {monitor.quality_threshold}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 flex-shrink-0">
                  {/* Last status */}
                  {monitor.last_status && (
                    <div className="flex items-center gap-1.5 text-sm">
                      {statusIcons[monitor.last_status]}
                      <span className="text-muted-foreground">{statusLabels[monitor.last_status]}</span>
                      {monitor.last_quality_score !== null && (
                        <span className="text-muted-foreground ms-1">({monitor.last_quality_score})</span>
                      )}
                    </div>
                  )}

                  {/* Next run */}
                  {monitor.is_enabled && monitor.next_run_at && (
                    <div className="text-xs text-muted-foreground">
                      {t('dashboard.monitors.next')}: {formatNextRun(monitor.next_run_at)}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTrigger(monitor.id)}
                      disabled={triggering === monitor.id || monitor.last_status === 'running'}
                      className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                      title={t('dashboard.monitors.runNow')}
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
                          ? 'text-muted-foreground hover:text-yellow-600 hover:bg-yellow-900/20'
                          : 'text-muted-foreground hover:text-green-600 hover:bg-green-900/20'
                      }`}
                      title={monitor.is_enabled ? t('dashboard.monitors.pause') : t('dashboard.monitors.resume')}
                    >
                      {monitor.is_enabled ? <FiPause className="h-4 w-4" /> : <FiRefreshCw className="h-4 w-4" />}
                    </button>
                    {monitor.last_session_id && (
                      <a
                        href={`/qa-loop?session=${monitor.last_session_id}`}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title={t('dashboard.monitors.viewLastSession')}
                      >
                        <FiExternalLink className="h-4 w-4 rtl:scale-x-[-1]" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(monitor.id)}
                      className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-900/20 rounded-lg transition-colors"
                      title={t('dashboard.monitors.delete')}
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
                  {t('dashboard.monitors.consecutiveFailures', { count: monitor.consecutive_failures })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
