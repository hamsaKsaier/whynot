import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../../../components/ui/dialog';
import { useAuth } from '../../../contexts/AuthContext';
import { apiClient, requestDataExport, pollExportStatus } from '../../../services/api';
import { toast } from 'sonner';

export const DangerZoneTab: React.FC = () => {
  const { t } = useTranslation('settings');
  const { logout } = useAuth();

  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await requestDataExport(exportFormat);
      const exportId = res.id;
      toast.success(t('settings.danger.exportQueued', { defaultValue: 'Export queued. Preparing your data...' }));

      const maxAttempts = 60;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const status = await pollExportStatus(exportId);
        if (status.status === 'completed' && status.downloadUrl) {
          window.open(status.downloadUrl, '_blank');
          toast.success(t('settings.danger.exportReady', { defaultValue: 'Export ready — download started.' }));
          return;
        }
        if (status.status === 'failed') {
          toast.error(t('settings.danger.exportFailed', { defaultValue: 'Export failed. Please try again.' }));
          return;
        }
      }
      toast.error(t('settings.danger.exportTimeout', { defaultValue: 'Export is taking too long. Please try again later.' }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to start export');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      await apiClient.post('/me/delete', { password: deletePassword });
      toast.success(t('settings.danger.deleteScheduled', { defaultValue: 'Account scheduled for deletion. You have 7 days to cancel.' }));
      setShowDeleteDialog(false);
      setTimeout(() => logout(), 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.danger.exportTitle', { defaultValue: 'Export My Data' })}</CardTitle>
          <CardDescription>
            {t('settings.danger.exportDesc', { defaultValue: 'Download all your data including projects, test cases, and results.' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'json' | 'csv')}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport} disabled={exporting} className="gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t('settings.danger.exportBtn', { defaultValue: 'Export data' })}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t('settings.danger.deleteTitle', { defaultValue: 'Delete Account' })}
          </CardTitle>
          <CardDescription>
            {t('settings.danger.deleteDesc', { defaultValue: 'Permanently delete your account and all associated data. This action has a 7-day grace period during which you can contact support to cancel.' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} className="gap-2">
            <Trash2 className="h-4 w-4" />
            {t('settings.danger.deleteBtn', { defaultValue: 'Delete my account' })}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t('settings.danger.deleteConfirmTitle', { defaultValue: 'Delete Account' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('settings.danger.deleteWarning', { defaultValue: 'This will schedule your account for permanent deletion. All your data including projects, test cases, results, and API keys will be removed after a 7-day grace period.' })}
            </p>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('settings.danger.enterPassword', { defaultValue: 'Enter your password to confirm' })}
              </label>
              <div className="relative">
                <input
                  type={showDeletePassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 pe-10 bg-card border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-destructive"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('settings.danger.typeDelete', { defaultValue: 'Type DELETE to confirm' })}
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 bg-card border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-destructive"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('settings.danger.cancel', { defaultValue: 'Cancel' })}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleting || deleteConfirm !== 'DELETE' || !deletePassword}
              className="gap-2"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t('settings.danger.confirmDelete', { defaultValue: 'Delete my account' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
