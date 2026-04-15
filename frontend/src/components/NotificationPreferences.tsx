/**
 * NotificationPreferences — toggle switches for email notification triggers.
 * Displayed in Settings > Notifications tab.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiMail, FiCheckCircle, FiAlertTriangle, FiActivity, FiGitPullRequest } from 'react-icons/fi';
import { apiClient } from '../services/api';
import { useToastContext } from '../contexts/ToastContext';

interface TriggerConfig {
  key: string;
  labelKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
}

const TRIGGERS: TriggerConfig[] = [
  {
    key: 'scan_complete',
    labelKey: 'settings.notifications.scanComplete',
    descriptionKey: 'settings.notifications.scanCompleteDesc',
    icon: <FiCheckCircle className="text-green-500" size={18} />,
  },
  {
    key: 'critical_bug',
    labelKey: 'settings.notifications.criticalBug',
    descriptionKey: 'settings.notifications.criticalBugDesc',
    icon: <FiAlertTriangle className="text-red-500" size={18} />,
  },
  {
    key: 'monitor_alert',
    labelKey: 'settings.notifications.monitorAlert',
    descriptionKey: 'settings.notifications.monitorAlertDesc',
    icon: <FiActivity className="text-amber-500" size={18} />,
  },
  {
    key: 'autofix_pr',
    labelKey: 'settings.notifications.autofixPr',
    descriptionKey: 'settings.notifications.autofixPrDesc',
    icon: <FiGitPullRequest className="text-purple-500" size={18} />,
  },
];

export const NotificationPreferences: React.FC = () => {
  const { t } = useTranslation('settings');
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
      success(t(newValue ? 'settings.notifications.enabled' : 'settings.notifications.disabled'));
    } catch {
      showError(t('settings.notifications.updateFailed'));
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {t("settings.notifications.loading")}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <FiMail className="text-muted-foreground" size={20} />
        <h3 className="text-lg font-semibold text-foreground">{t("settings.notifications.emailTitle")}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t("settings.notifications.emailDesc")}
      </p>

      <div className="space-y-4">
        {TRIGGERS.map(trigger => {
          const enabled = prefs[trigger.key] ?? true;
          const isUpdating = updating === trigger.key;
          return (
            <div
              key={trigger.key}
              className="flex items-center justify-between py-3 px-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {trigger.icon}
                <div>
                  <p className="text-sm font-medium text-foreground">{t(trigger.labelKey)}</p>
                  <p className="text-xs text-muted-foreground">{t(trigger.descriptionKey)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => togglePref(trigger.key)}
                disabled={isUpdating}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${
                  enabled ? 'bg-primary' : 'bg-input'
                } ${isUpdating ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                role="switch"
                aria-checked={enabled}
                aria-label={t(trigger.labelKey)}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-foreground shadow-sm transition-transform ${
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
