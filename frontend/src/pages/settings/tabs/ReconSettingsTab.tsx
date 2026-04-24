import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Switch } from '../../../components/ui/switch';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { apiClient } from '../../../services/api';

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
}

interface ReconSettings {
  notifyRecipientUserIds: string[];
  emailOnComplete: boolean;
  emailOnFail: boolean;
  paygCapCredits: number;
}

const DEFAULT_SETTINGS: ReconSettings = {
  notifyRecipientUserIds: [],
  emailOnComplete: true,
  emailOnFail: true,
  paygCapCredits: 0,
};

const MAX_PAYG_CAP = 100_000;

export const ReconSettingsTab: React.FC = () => {
  const { t } = useTranslation('settings');
  const [settings, setSettings] = useState<ReconSettings>(DEFAULT_SETTINGS);
  const [capInput, setCapInput] = useState<string>('0');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [settingsRes, membersRes] = await Promise.all([
        apiClient.get('/recon/settings'),
        apiClient.get('/me/organization/members'),
      ]);
      const next = { ...DEFAULT_SETTINGS, ...(settingsRes.data.settings ?? {}) };
      setSettings(next);
      setCapInput(String(next.paygCapCredits ?? 0));
      setMembers(membersRes.data.members ?? []);
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const capNumber = Number(capInput);
  const capError = useMemo<string | null>(() => {
    if (capInput === '' || Number.isNaN(capNumber)) {
      return t('settings.recon.paygCap.error.negative', { defaultValue: 'Cap must be 0 or greater' });
    }
    if (capNumber < 0) {
      return t('settings.recon.paygCap.error.negative', { defaultValue: 'Cap must be 0 or greater' });
    }
    if (capNumber > MAX_PAYG_CAP) {
      return t('settings.recon.paygCap.error.tooLarge', {
        defaultValue: 'Cap must be 100,000 or less',
      });
    }
    if (!Number.isInteger(capNumber)) {
      return t('settings.recon.paygCap.error.negative', { defaultValue: 'Cap must be 0 or greater' });
    }
    return null;
  }, [capInput, capNumber, t]);

  const selectedRecipients = useMemo(
    () =>
      settings.notifyRecipientUserIds
        .map((id) => members.find((m) => m.userId === id || m.id === id))
        .filter((m): m is Member => Boolean(m)),
    [settings.notifyRecipientUserIds, members],
  );

  const availableMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          !settings.notifyRecipientUserIds.includes(m.userId) &&
          !settings.notifyRecipientUserIds.includes(m.id),
      ),
    [members, settings.notifyRecipientUserIds],
  );

  const addRecipient = (memberId: string) => {
    setSettings((prev) => ({
      ...prev,
      notifyRecipientUserIds: [...prev.notifyRecipientUserIds, memberId],
    }));
    setRecipientPickerOpen(false);
  };

  const removeRecipient = (memberId: string) => {
    setSettings((prev) => ({
      ...prev,
      notifyRecipientUserIds: prev.notifyRecipientUserIds.filter((id) => id !== memberId),
    }));
  };

  const handleSave = async () => {
    if (capError) return;
    setSaving(true);
    try {
      const payload = {
        notify_recipient_user_ids: settings.notifyRecipientUserIds,
        email_on_complete: settings.emailOnComplete,
        email_on_fail: settings.emailOnFail,
        payg_cap_credits: capNumber,
      };
      const res = await apiClient.put('/recon/settings', payload);
      const next = { ...DEFAULT_SETTINGS, ...(res.data.settings ?? {}) };
      setSettings(next);
      setCapInput(String(next.paygCapCredits ?? 0));
      toast.success(t('settings.recon.saveSuccess', { defaultValue: 'Recon settings saved' }));
    } catch {
      toast.error(t('settings.recon.saveError', { defaultValue: 'Failed to save Recon settings' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            {t('settings.recon.notifications.title', { defaultValue: 'Notifications' })}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('settings.recon.notifications.description', {
              defaultValue: 'Choose who gets emailed when a scan completes or fails.',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors duration-150 gap-2 sm:gap-4 min-h-[44px]">
            <div className="flex-1">
              <Label htmlFor="recon-email-complete" className="text-sm font-medium text-foreground cursor-pointer">
                {t('settings.recon.notifications.emailOnComplete', {
                  defaultValue: 'Email me on every scan completion',
                })}
              </Label>
            </div>
            <Switch
              id="recon-email-complete"
              checked={settings.emailOnComplete}
              onCheckedChange={(v) => setSettings((prev) => ({ ...prev, emailOnComplete: v }))}
              className="data-[state=checked]:bg-primary"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors duration-150 gap-2 sm:gap-4 min-h-[44px]">
            <div className="flex-1">
              <Label htmlFor="recon-email-fail" className="text-sm font-medium text-foreground cursor-pointer">
                {t('settings.recon.notifications.emailOnFail', {
                  defaultValue: 'Email me when a scan fails',
                })}
              </Label>
            </div>
            <Switch
              id="recon-email-fail"
              checked={settings.emailOnFail}
              onCheckedChange={(v) => setSettings((prev) => ({ ...prev, emailOnFail: v }))}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          <div className="p-3 space-y-2">
            <Label className="text-sm font-medium text-foreground">
              {t('settings.recon.notifications.recipients.label', { defaultValue: 'Recipients' })}
            </Label>
            <div
              role="list"
              aria-label={t('settings.recon.notifications.recipients.label', { defaultValue: 'Recipients' })}
              className="flex flex-wrap gap-2 p-2 rounded-md border border-border bg-background min-h-[44px]"
              data-testid="recon-recipients-list"
            >
              {selectedRecipients.length === 0 && (
                <span className="text-sm text-muted-foreground self-center">
                  {t('settings.recon.notifications.recipients.empty', {
                    defaultValue: 'No recipients selected',
                  })}
                </span>
              )}
              {selectedRecipients.map((m) => (
                <Badge
                  key={m.userId || m.id}
                  variant="outline"
                  role="listitem"
                  className="gap-1.5 text-xs"
                >
                  <span>{m.email}</span>
                  <button
                    type="button"
                    onClick={() => removeRecipient(m.userId || m.id)}
                    aria-label={t('settings.recon.notifications.recipients.remove', {
                      defaultValue: 'Remove {{email}}',
                    }).replace('{{email}}', m.email)}
                    className="ms-1 text-muted-foreground hover:text-foreground transition-colors duration-150"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRecipientPickerOpen((v) => !v)}
                disabled={availableMembers.length === 0}
              >
                {t('settings.recon.notifications.recipients.placeholder', {
                  defaultValue: 'Add recipient',
                })}
              </Button>
              {recipientPickerOpen && availableMembers.length > 0 && (
                <div
                  role="listbox"
                  className="absolute z-10 mt-1 w-full max-w-xs rounded-md border border-border bg-popover shadow-sm"
                >
                  {availableMembers.map((m) => (
                    <button
                      key={m.userId || m.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => addRecipient(m.userId || m.id)}
                      className="block w-full text-start px-3 py-2 text-sm hover:bg-accent transition-colors duration-150"
                    >
                      <div className="font-medium text-foreground">{m.name || m.email}</div>
                      <div className="text-xs text-muted-foreground">{m.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            {t('settings.recon.paygCap.label', { defaultValue: 'Max credits per scan' })}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('settings.recon.paygCap.help', {
              defaultValue:
                'Hard cap on credits spent per scan. Enter 0 to use the platform default.',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="recon-payg-cap" className="sr-only">
              {t('settings.recon.paygCap.label', { defaultValue: 'Max credits per scan' })}
            </Label>
            <Input
              id="recon-payg-cap"
              type="number"
              min={0}
              max={MAX_PAYG_CAP}
              step={1}
              value={capInput}
              onChange={(e) => setCapInput(e.target.value)}
              aria-invalid={Boolean(capError)}
              aria-describedby={capError ? 'recon-payg-cap-error' : undefined}
            />
            {capError && (
              <p id="recon-payg-cap-error" className="text-xs text-destructive">
                {capError}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border opacity-60">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            {t('settings.recon.schedule.title', { defaultValue: 'Default schedule' })}
            <Badge variant="outline" className="text-xs font-normal">
              {t('settings.recon.schedule.comingSoon', { defaultValue: 'Coming soon' })}
            </Badge>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('settings.recon.schedule.description', {
              defaultValue: 'Automatically re-run scans on a recurring schedule.',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            aria-disabled="true"
            data-testid="recon-schedule-coming-soon"
            className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/30 min-h-[44px] pointer-events-none"
          >
            <span className="text-sm text-muted-foreground">
              {t('settings.recon.schedule.comingSoon', { defaultValue: 'Coming soon' })}
            </span>
            <Switch
              checked={false}
              disabled
              aria-label={t('settings.recon.schedule.comingSoon', { defaultValue: 'Coming soon' })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={Boolean(capError) || saving}>
          {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
          {t('settings.recon.save', { defaultValue: 'Save' })}
        </Button>
      </div>
    </div>
  );
};
