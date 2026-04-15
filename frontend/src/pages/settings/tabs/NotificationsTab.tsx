import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Switch } from '../../../components/ui/switch';
import { apiClient } from '../../../services/api';
import { toast } from 'sonner';

interface NotificationPreferences {
  productUpdates: boolean;
  billing: boolean;
  security: boolean;
  scanComplete: boolean;
  criticalBug: boolean;
  monitorAlert: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  productUpdates: true,
  billing: true,
  security: true,
  scanComplete: true,
  criticalBug: true,
  monitorAlert: true,
};

export const NotificationsTab: React.FC = () => {
  const { t } = useTranslation('settings');
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    try {
      const res = await apiClient.get('/me/notifications');
      setPrefs({ ...DEFAULT_PREFS, ...res.data.preferences });
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleToggle = async (key: keyof NotificationPreferences) => {
    const newValue = !prefs[key];
    setPrefs((prev) => ({ ...prev, [key]: newValue }));
    setSavingKey(key);
    try {
      await apiClient.patch('/me/notifications', { [key]: newValue });
    } catch {
      setPrefs((prev) => ({ ...prev, [key]: !newValue }));
      toast.error('Failed to update preference');
    } finally {
      setSavingKey(null);
    }
  };

  const categories = [
    {
      title: t('settings.notifications.emailTitle', { defaultValue: 'Email Notifications' }),
      description: t('settings.notifications.emailDesc', { defaultValue: 'Choose which email notifications you receive' }),
      items: [
        {
          key: 'productUpdates' as const,
          label: t('settings.notifications.productUpdates', { defaultValue: 'Product updates' }),
          description: t('settings.notifications.productUpdatesDesc', { defaultValue: 'New features, improvements, and tips' }),
        },
        {
          key: 'billing' as const,
          label: t('settings.notifications.billing', { defaultValue: 'Billing' }),
          description: t('settings.notifications.billingDesc', { defaultValue: 'Invoices, payment reminders, and subscription changes' }),
        },
        {
          key: 'security' as const,
          label: t('settings.notifications.security', { defaultValue: 'Security' }),
          description: t('settings.notifications.securityDesc', { defaultValue: 'Login alerts, password changes, and suspicious activity' }),
        },
      ],
    },
    {
      title: t('settings.notifications.activityTitle', { defaultValue: 'Activity Notifications' }),
      description: t('settings.notifications.activityDesc', { defaultValue: 'Notifications about your testing activity' }),
      items: [
        {
          key: 'scanComplete' as const,
          label: t('settings.notifications.scanComplete', { defaultValue: 'Scan complete' }),
          description: t('settings.notifications.scanCompleteDesc', { defaultValue: 'When a QA scan finishes running' }),
        },
        {
          key: 'criticalBug' as const,
          label: t('settings.notifications.criticalBug', { defaultValue: 'Critical bugs' }),
          description: t('settings.notifications.criticalBugDesc', { defaultValue: 'When a critical severity bug is detected' }),
        },
        {
          key: 'monitorAlert' as const,
          label: t('settings.notifications.monitorAlert', { defaultValue: 'Monitor alerts' }),
          description: t('settings.notifications.monitorAlertDesc', { defaultValue: 'When a monitored page has an issue' }),
        },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {categories.map((category) => (
        <Card key={category.title} className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">{category.title}</CardTitle>
            <CardDescription className="text-slate-400">{category.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {category.items.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-3 rounded-md hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex-1 me-4">
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-sm text-slate-400">{item.description}</p>
                </div>
                <Switch
                  checked={prefs[item.key]}
                  onCheckedChange={() => handleToggle(item.key)}
                  disabled={savingKey === item.key}
                  className="data-[state=checked]:bg-primary-600"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
