import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiTrash2, FiRefreshCw, FiCopy, FiCheck } from 'react-icons/fi';
import { Loader2, Key } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { apiClient } from '../../../services/api';
import { toast } from 'sonner';

interface ApiKey {
  id: string;
  label: string;
  lastFour: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export const ApiKeysTab: React.FC = () => {
  const { t } = useTranslation('settings');

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [creating, setCreating] = useState(false);

  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      const res = await apiClient.get('/me/api-keys');
      setKeys(res.data.keys || []);
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await apiClient.post('/me/api-keys', { label: newKeyLabel });
      setCreatedKey(res.data.key);
      setNewKeyLabel('');
      loadKeys();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create API key');
      setShowCreateDialog(false);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    toast.success(t('settings.apiKeys.copied', { defaultValue: 'Copied to clipboard' }));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseCreatedKey = () => {
    setCreatedKey(null);
    setCopied(false);
    setShowCreateDialog(false);
  };

  const handleRotate = async (keyId: string) => {
    setRotatingId(keyId);
    try {
      const res = await apiClient.post(`/me/api-keys/${keyId}/rotate`);
      setCreatedKey(res.data.key);
      setShowCreateDialog(true);
      loadKeys();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to rotate API key');
    } finally {
      setRotatingId(null);
    }
  };

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      await apiClient.delete(`/me/api-keys/${keyId}`);
      toast.success(t('settings.apiKeys.revoked', { defaultValue: 'API key revoked' }));
      loadKeys();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to revoke API key');
    } finally {
      setRevokingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">{t('settings.apiKeys.title', { defaultValue: 'API Keys' })}</CardTitle>
            <CardDescription className="text-slate-400">
              {t('settings.apiKeys.description', { defaultValue: 'Manage API keys for programmatic access. Keys are hashed at rest and shown only once upon creation.' })}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)} className="gap-2">
            <FiPlus className="h-4 w-4" />
            {t('settings.apiKeys.create', { defaultValue: 'Create key' })}
          </Button>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-8 w-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">{t('settings.apiKeys.empty', { defaultValue: 'No API keys yet. Create one to get started.' })}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-start text-slate-400">{t('settings.apiKeys.label', { defaultValue: 'Label' })}</TableHead>
                  <TableHead className="text-start text-slate-400">{t('settings.apiKeys.key', { defaultValue: 'Key' })}</TableHead>
                  <TableHead className="text-start text-slate-400">{t('settings.apiKeys.created', { defaultValue: 'Created' })}</TableHead>
                  <TableHead className="text-start text-slate-400">{t('settings.apiKeys.lastUsed', { defaultValue: 'Last used' })}</TableHead>
                  <TableHead className="text-end text-slate-400">{t('settings.apiKeys.actions', { defaultValue: 'Actions' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id} className="border-slate-700">
                    <TableCell className="text-start text-white font-medium">{key.label}</TableCell>
                    <TableCell className="text-start">
                      <code className="text-slate-400 text-sm bg-slate-700/50 px-2 py-0.5 rounded">
                        {'••••••••' + key.lastFour}
                      </code>
                    </TableCell>
                    <TableCell className="text-start text-slate-300 text-sm">{formatDate(key.createdAt)}</TableCell>
                    <TableCell className="text-start text-slate-400 text-sm">
                      {key.lastUsedAt ? formatDate(key.lastUsedAt) : t('settings.apiKeys.never', { defaultValue: 'Never' })}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRotate(key.id)}
                          disabled={rotatingId === key.id}
                          className="text-slate-400 hover:text-white"
                          title={t('settings.apiKeys.rotate', { defaultValue: 'Rotate' })}
                        >
                          {rotatingId === key.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FiRefreshCw className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(key.id)}
                          disabled={revokingId === key.id}
                          className="text-red-400 hover:text-red-300"
                          title={t('settings.apiKeys.revoke', { defaultValue: 'Revoke' })}
                        >
                          {revokingId === key.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FiTrash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) handleCloseCreatedKey(); else setShowCreateDialog(true); }}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {createdKey
                ? t('settings.apiKeys.keyCreated', { defaultValue: 'API Key Created' })
                : t('settings.apiKeys.createTitle', { defaultValue: 'Create API Key' })}
            </DialogTitle>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <p className="text-sm text-amber-400">
                {t('settings.apiKeys.copyWarning', { defaultValue: 'Copy this key now. You will not be able to see it again.' })}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-green-400 text-sm break-all">
                  {createdKey}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1 flex-shrink-0">
                  {copied ? <FiCheck className="h-4 w-4" /> : <FiCopy className="h-4 w-4" />}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseCreatedKey}>
                  {t('settings.apiKeys.done', { defaultValue: 'Done' })}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {t('settings.apiKeys.labelField', { defaultValue: 'Label' })}
                </label>
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder={t('settings.apiKeys.labelPlaceholder', { defaultValue: 'e.g. CI/CD Pipeline' })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
                  required
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t('settings.apiKeys.cancel', { defaultValue: 'Cancel' })}</Button>
                </DialogClose>
                <Button type="submit" disabled={creating} className="gap-2">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('settings.apiKeys.createBtn', { defaultValue: 'Create' })}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
