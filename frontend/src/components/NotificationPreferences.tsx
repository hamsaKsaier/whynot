/**
 * NotificationPreferences — toggle switches for email notification triggers.
 * Displayed in Settings > Notifications tab.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { FiMail, FiCheckCircle, FiAlertTriangle, FiActivity, FiGitPullRequest } from 'react-icons/fi';
import { apiClient } from '../services/api';
import { useToastContext } from '../contexts/ToastContext';

interface TriggerConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TRIGGERS: TriggerConfig[] = [
  {
    key: 'scan_complete',
    label: 'Scan complete',
    description: 'Get notified when a QA scan finishes',
    icon: <FiCheckCircle className="text-green-500" size={18} />,
  },
  {
    key: 'critical_bug',
    label: 'Critical bug found',
    description: 'Immediate alert when a critical severity bug is detected',
    icon: <FiAlertTriangle className="text-red-500" size={18} />,
  },
  {
    key: 'monitor_alert',
    label: 'Monitor alert',
    description: 'Alerts from scheduled QA monitors',
    icon: <FiActivity className="text-amber-500" size={18} />,
  },
  {
    key: 'autofix_pr',
    label: 'Auto-fix PR ready',
    description: 'Notification when an auto-fix pull request is created',
    icon: <FiGitPullRequest className="text-purple-500" size={18} />,
  },
];

export const NotificationPreferences: React.FC = () => {
  const { success, error: showError } = useToastContext();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications/preferences');
      setPrefs(res.data.preferences || {});
    } catch {
      // defaults to all enabled
      const defaults: Record<string, boolean> = {};
      TRIGGERS.forEach(t => { defaults[t.key] = true; });
      setPrefs(defaults);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  const togglePref = async (triggerType: string) => {
    const newValue = !prefs[triggerType];
    setUpdating(triggerType);
    try {
      await apiClient.put('/notifications/preferences', {
        trigger_type: triggerType,
        enabled: newValue,
      });
      setPrefs(prev => ({ ...prev, [triggerType]: newValue }));
      success(`Notification ${newValue ? 'enabled' : 'disabled'}`);
    } catch {
      showError('Failed to update preference');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
        Loading preferences...
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <FiMail className="text-slate-200" size={20} />
        <h3 className="text-lg font-semibold text-white">Email Notifications</h3>
      </div>
      <p className="text-sm text-slate-400 mb-6">
        Choose which events trigger an email notification to your account email.
      </p>

      <div className="space-y-4">
        {TRIGGERS.map(trigger => {
          const enabled = prefs[trigger.key] ?? true;
          const isUpdating = updating === trigger.key;
          return (
            <div
              key={trigger.key}
              className="flex items-center justify-between py-3 px-4 rounded-lg border border-slate-700 hover:bg-slate-900 transition-colors"
            >
              <div className="flex items-center gap-3">
                {trigger.icon}
                <div>
                  <p className="text-sm font-medium text-white">{trigger.label}</p>
                  <p className="text-xs text-slate-400">{trigger.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => togglePref(trigger.key)}
                disabled={isUpdating}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  enabled ? 'bg-blue-600' : 'bg-slate-700'
                } ${isUpdating ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                role="switch"
                aria-checked={enabled}
                aria-label={`${trigger.label} notifications`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
