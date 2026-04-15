import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Flag,
  Loader2,
  Search,
  Plus,
  Trash2,
  History,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  getFeatureFlags,
  getOrgFeatureFlags,
  setOrgFlagOverride,
  clearOrgFlagOverride,
  getAuditLog,
} from '../services/api';

interface FeatureFlag {
  key: string;
  name: string;
  description: string | null;
  default_enabled: boolean;
  rollout_percent: number;
  created_at: string;
  updated_at: string;
}

interface OrgFlagRow {
  key: string;
  name: string;
  description: string | null;
  default_enabled: boolean;
  rollout_percent: number;
  override_enabled: boolean | null;
  set_by: string | null;
  set_at: string | null;
}

interface AuditEntry {
  id: string;
  actor_id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export function FeatureFlagsPage() {
  const { t } = useTranslation('admin');

  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);

  // Override lookup
  const [orgId, setOrgId] = useState('');
  const [orgFlags, setOrgFlags] = useState<OrgFlagRow[] | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  // Override dialog
  const [overrideDialog, setOverrideDialog] = useState<{
    open: boolean;
    flagKey: string;
    orgId: string;
    currentValue: boolean | null;
  }>({ open: false, flagKey: '', orgId: '', currentValue: null });
  const [overrideSaving, setOverrideSaving] = useState(false);

  // Audit trail
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchFlags = useCallback(async () => {
    try {
      const data = await getFeatureFlags();
      setFlags(data.flags || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleSelectFlag = useCallback(
    async (flag: FeatureFlag) => {
      setSelectedFlag(flag);
      setOrgFlags(null);
      setOrgId('');
      setAuditLoading(true);
      try {
        const data = await getAuditLog({
          action: 'feature_flag.override_set',
          target_type: 'feature_flag',
          target_id: flag.key,
          limit: 50,
        });
        const clearData = await getAuditLog({
          action: 'feature_flag.override_clear',
          target_type: 'feature_flag',
          target_id: flag.key,
          limit: 50,
        });
        const combined = [
          ...(data.entries || []),
          ...(clearData.entries || []),
        ].sort(
          (a: AuditEntry, b: AuditEntry) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setAuditEntries(combined.slice(0, 50));
      } catch {
        setAuditEntries([]);
      } finally {
        setAuditLoading(false);
      }
    },
    []
  );

  const handleLookupOrg = useCallback(async () => {
    if (!orgId.trim()) return;
    setOrgLoading(true);
    try {
      const data = await getOrgFeatureFlags(orgId.trim());
      setOrgFlags(data.flags || []);
    } catch {
      setOrgFlags([]);
    } finally {
      setOrgLoading(false);
    }
  }, [orgId]);

  const handleSetOverride = useCallback(
    async (enabled: boolean) => {
      setOverrideSaving(true);
      try {
        await setOrgFlagOverride(
          overrideDialog.orgId,
          overrideDialog.flagKey,
          enabled
        );
        if (orgFlags) {
          setOrgFlags(
            orgFlags.map((f) =>
              f.key === overrideDialog.flagKey
                ? { ...f, override_enabled: enabled }
                : f
            )
          );
        }
        setOverrideDialog((prev) => ({ ...prev, open: false }));
      } finally {
        setOverrideSaving(false);
      }
    },
    [overrideDialog, orgFlags]
  );

  const handleClearOverride = useCallback(
    async (flagKey: string, targetOrgId: string) => {
      await clearOrgFlagOverride(targetOrgId, flagKey);
      if (orgFlags) {
        setOrgFlags(
          orgFlags.map((f) =>
            f.key === flagKey ? { ...f, override_enabled: null, set_by: null, set_at: null } : f
          )
        );
      }
    },
    [orgFlags]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Flag className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">{t('admin.featureFlags.title')}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Flag list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t('admin.featureFlags.allFlags')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {flags.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">
                {t('admin.featureFlags.noFlags')}
              </p>
            ) : (
              <div className="divide-y">
                {flags.map((flag) => (
                  <button
                    key={flag.key}
                    onClick={() => handleSelectFlag(flag)}
                    className={`w-full text-start px-4 py-3 hover:bg-muted/50 transition-colors duration-150 ${
                      selectedFlag?.key === flag.key ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{flag.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {flag.default_enabled
                          ? t('admin.featureFlags.defaultOn')
                          : t('admin.featureFlags.defaultOff')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {flag.key}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Flag detail + overrides */}
        <Card className="lg:col-span-2">
          {!selectedFlag ? (
            <CardContent className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">
                {t('admin.featureFlags.selectFlag')}
              </p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{selectedFlag.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedFlag.default_enabled ? (
                      <ToggleRight className="h-4 w-4 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Badge variant="outline">
                      {t('admin.featureFlags.rollout')}: {selectedFlag.rollout_percent}%
                    </Badge>
                  </div>
                </div>
                {selectedFlag.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedFlag.description}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Org override lookup */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">
                    {t('admin.featureFlags.orgOverrides')}
                  </h3>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t('admin.featureFlags.orgIdPlaceholder')}
                      value={orgId}
                      onChange={(e) => setOrgId(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLookupOrg()}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleLookupOrg}
                      disabled={!orgId.trim() || orgLoading}
                    >
                      {orgLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {orgFlags !== null && (
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-start">
                            {t('admin.featureFlags.flagName')}
                          </TableHead>
                          <TableHead className="text-start">
                            {t('admin.featureFlags.default')}
                          </TableHead>
                          <TableHead className="text-start">
                            {t('admin.featureFlags.override')}
                          </TableHead>
                          <TableHead className="text-end">
                            {t('admin.featureFlags.actions')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orgFlags.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell className="text-start">
                              <div>
                                <span className="text-sm font-medium">
                                  {row.name}
                                </span>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {row.key}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-start">
                              <Badge
                                variant="outline"
                                className={
                                  row.default_enabled
                                    ? 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300'
                                    : ''
                                }
                              >
                                {row.default_enabled ? 'On' : 'Off'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-start">
                              {row.override_enabled === null ? (
                                <span className="text-xs text-muted-foreground">
                                  {t('admin.featureFlags.noOverride')}
                                </span>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={
                                    row.override_enabled
                                      ? 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300'
                                      : 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300'
                                  }
                                >
                                  {row.override_enabled
                                    ? t('admin.featureFlags.enable')
                                    : t('admin.featureFlags.disable')}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-end">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setOverrideDialog({
                                      open: true,
                                      flagKey: row.key,
                                      orgId: orgId.trim(),
                                      currentValue: row.override_enabled,
                                    })
                                  }
                                >
                                  <Plus className="h-3 w-3 me-1" />
                                  {t('admin.featureFlags.setOverride')}
                                </Button>
                                {row.override_enabled !== null && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleClearOverride(row.key, orgId.trim())
                                    }
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Audit trail */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">
                      {t('admin.featureFlags.auditTrail')}
                    </h3>
                  </div>

                  {auditLoading ? (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        {t('admin.featureFlags.loadingAudit')}
                      </span>
                    </div>
                  ) : auditEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      {t('admin.featureFlags.noAuditEntries')}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-start">
                            {t('admin.featureFlags.auditDate')}
                          </TableHead>
                          <TableHead className="text-start">
                            {t('admin.featureFlags.auditActor')}
                          </TableHead>
                          <TableHead className="text-start">
                            {t('admin.featureFlags.auditAction')}
                          </TableHead>
                          <TableHead className="text-start">
                            {t('admin.featureFlags.auditDetails')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-start text-xs">
                              {new Date(entry.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-start text-xs">
                              {entry.actor_email || entry.actor_id}
                            </TableCell>
                            <TableCell className="text-start">
                              <Badge variant="outline" className="text-xs">
                                {entry.action.replace('feature_flag.', '')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-start text-xs font-mono">
                              {entry.details
                                ? `org: ${(entry.details as Record<string, unknown>).target_org_id ?? '—'}, ${(entry.details as Record<string, unknown>).before ?? '—'} → ${(entry.details as Record<string, unknown>).after ?? 'cleared'}`
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* Override dialog */}
      <Dialog
        open={overrideDialog.open}
        onOpenChange={(open) =>
          setOverrideDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.featureFlags.setOverrideTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.featureFlags.setOverrideDescription', {
                flag: overrideDialog.flagKey,
                org: overrideDialog.orgId,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label>{t('admin.featureFlags.flagKey')}</Label>
              <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded-md">
                {overrideDialog.flagKey}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('admin.featureFlags.orgId')}</Label>
              <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded-md">
                {overrideDialog.orgId}
              </code>
            </div>
            <Separator />
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <div>
                <p className="text-sm font-medium">
                  {t('admin.featureFlags.enableForOrg')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {overrideDialog.currentValue === null
                    ? t('admin.featureFlags.currentlyNoOverride')
                    : overrideDialog.currentValue
                      ? t('admin.featureFlags.currentlyEnabled')
                      : t('admin.featureFlags.currentlyDisabled')}
                </p>
              </div>
              <Switch
                checked={overrideDialog.currentValue ?? false}
                onCheckedChange={(checked) =>
                  setOverrideDialog((prev) => ({
                    ...prev,
                    currentValue: checked,
                  }))
                }
                className="data-[state=checked]:bg-green-600"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setOverrideDialog((prev) => ({ ...prev, open: false }))
              }
            >
              {t('admin.featureFlags.cancel')}
            </Button>
            <Button
              onClick={() =>
                handleSetOverride(overrideDialog.currentValue ?? false)
              }
              disabled={overrideSaving}
            >
              {overrideSaving && (
                <Loader2 className="h-4 w-4 me-1 animate-spin" />
              )}
              {t('admin.featureFlags.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
