import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Check, Zap, Eye, EyeOff, Loader2, Info } from 'lucide-react';
import { apiClient } from '../../../services/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';

interface AiConfig {
  id: string;
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKey: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AvailableProvider {
  provider: string;
  displayName: string;
  models: string[];
  defaultModel: string;
}

interface AIProvidersData {
  providers: AvailableProvider[];
  tier: 'byo_keys' | 'managed_payg';
  hasPlatformKeys: boolean;
  platformDefault: { provider: string; model: string } | null;
}

export const AiContent: React.FC = () => {
  const { t } = useTranslation('settings');
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableProviders, setAvailableProviders] = useState<AIProvidersData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formProvider, setFormProvider] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; latencyMs?: number; error?: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await apiClient.get('/me/ai-config');
      setConfigs(res.data.items);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await apiClient.get('/me/ai-providers');
      const data: AIProvidersData = res.data;
      setAvailableProviders(data);
      // Set initial form provider to first available
      if (data.providers.length > 0 && !formProvider) {
        const first = data.providers[0];
        setFormProvider(first.provider);
        setFormModel(first.defaultModel || first.models[0] || '');
      }
    } catch {
      // handled by interceptor
    }
  }, [formProvider]);

  useEffect(() => {
    fetchConfigs();
    fetchProviders();
  }, [fetchConfigs, fetchProviders]);

  const selectedProviderData = availableProviders?.providers.find(
    (p) => p.provider === formProvider,
  );
  const models = selectedProviderData?.models || [];

  const handleProviderChange = (provider: string) => {
    setFormProvider(provider);
    const providerData = availableProviders?.providers.find((p) => p.provider === provider);
    setFormModel(providerData?.defaultModel || providerData?.models[0] || '');
    setFormBaseUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string> = {
        provider: formProvider,
        model: formModel,
        apiKey: formApiKey,
      };
      if (formProvider === 'custom' && formBaseUrl) {
        body.baseUrl = formBaseUrl;
      }
      await apiClient.post('/me/ai-config', body);
      setShowForm(false);
      setFormApiKey('');
      setFormBaseUrl('');
      setShowApiKey(false);
      await fetchConfigs();
    } catch {
      // error handled by interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await apiClient.post(`/me/ai-config/${id}/test`);
      setTestResult({ id, ...res.data });
    } catch {
      setTestResult({ id, ok: false, error: 'Request failed' });
    } finally {
      setTestingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await apiClient.put(`/me/ai-config/${id}/default`);
      await fetchConfigs();
    } catch {
      // handled by interceptor
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiClient.delete(`/me/ai-config/${id}`);
      setTestResult(null);
      await fetchConfigs();
    } catch {
      // handled by interceptor
    } finally {
      setDeletingId(null);
    }
  };

  const getProviderDisplayName = (provider: string): string => {
    const found = availableProviders?.providers.find((p) => p.provider === provider);
    return found?.displayName || provider;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t('settings.ai.title', 'AI Providers')}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('settings.ai.description', 'Configure your own AI provider keys for test generation.')}
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            size="sm"
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 me-1.5" />
            {t('settings.ai.addProvider', 'Add provider')}
          </Button>
        )}
      </div>

      {/* Tier information banner */}
      {availableProviders && (
        <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
          {availableProviders.tier === 'managed_payg' ? (
            <div>
              <p className="font-medium text-foreground">
                {t('settings.ai.tierInfo.managed', 'Managed AI Keys')}
              </p>
              <p className="text-muted-foreground mt-0.5">
                {t('settings.ai.tierInfo.managedDesc', 'Your plan includes managed AI access. You can optionally add your own keys for custom provider access.')}
              </p>
              {availableProviders.hasPlatformKeys && configs.length === 0 && (
                <>
                  <p className="text-muted-foreground mt-1">
                    {t('settings.ai.usingPlatformKey', "You're currently using the platform's managed AI keys. No configuration needed.")}
                  </p>
                  {availableProviders.platformDefault && (
                    <p className="text-muted-foreground mt-0.5">
                      {t('settings.ai.usingPlatformKeyProvider', 'Currently using: {{provider}} / {{model}} (platform default)', {
                        provider: getProviderDisplayName(availableProviders.platformDefault.provider),
                        model: availableProviders.platformDefault.model,
                      })}
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
            <div>
              <p className="font-medium text-foreground">
                {t('settings.ai.tierInfo.byo', 'Bring Your Own Keys')}
              </p>
              <p className="text-muted-foreground mt-0.5">
                {t('settings.ai.tierInfo.byoDesc', 'Add your own AI provider API keys to use AI features. Your keys are encrypted and stored securely.')}
              </p>
              {configs.length === 0 && (
                <div className="flex items-center gap-1.5 mt-2 text-foreground">
                  <Info className="h-4 w-4 flex-shrink-0" />
                  <p className="font-medium">
                    {t('settings.ai.keyRequired', 'You need to add an API key to use AI features.')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-card p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('settings.ai.providerLabel', 'Provider')}</Label>
              <Select value={formProvider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders?.providers.map((p) => (
                    <SelectItem key={p.provider} value={p.provider}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t('settings.ai.modelLabel', 'Model')}</Label>
              {models.length > 0 ? (
                <Select value={formModel} onValueChange={setFormModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="text"
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  placeholder={t('settings.ai.modelPlaceholder', 'e.g. my-model-v1')}
                />
              )}
            </div>
          </div>

          {formProvider === 'custom' && (
            <div className="space-y-1.5">
              <Label>{t('settings.ai.baseUrlLabel', 'Base URL')}</Label>
              <Input
                type="url"
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder="https://my-api.example.com/v1"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t('settings.ai.apiKeyLabel', 'API Key')}</Label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="sk-..."
                required
                className="pe-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setShowForm(false); setFormApiKey(''); setShowApiKey(false); }}
            >
              {t('settings.ai.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || !formModel || !formApiKey}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
                  {t('settings.ai.saving', 'Saving...')}
                </>
              ) : (
                t('settings.ai.save', 'Save')
              )}
            </Button>
          </div>
        </form>
      )}

      {configs.length === 0 && !showForm && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground text-sm">
            {t('settings.ai.noConfigs', 'No AI providers configured yet. Add one to use your own API keys.')}
          </p>
        </div>
      )}

      {configs.length > 0 && (
        <div className="space-y-3">
          {configs.map((config) => (
            <div
              key={config.id}
              className="rounded-lg border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground text-sm">
                    {getProviderDisplayName(config.provider)}
                  </span>
                  {config.isDefault && (
                    <Badge variant="outline" className="text-xs">
                      {t('settings.ai.default', 'Default')}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {config.model} &middot; {config.apiKey}
                </p>
                {testResult && testResult.id === config.id && (
                  <p className={`text-xs mt-1 ${testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {testResult.ok
                      ? t('settings.ai.testSuccess', 'Connection successful ({{ms}}ms)', { ms: testResult.latencyMs })
                      : t('settings.ai.testFailure', 'Connection failed: {{error}}', { error: testResult.error })}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleTest(config.id)}
                  disabled={testingId === config.id}
                  title={t('settings.ai.testButton', 'Test connection')}
                  className="h-8 w-8"
                >
                  {testingId === config.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                </Button>
                {!config.isDefault && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSetDefault(config.id)}
                    title={t('settings.ai.setDefault', 'Set as default')}
                    className="h-8 w-8"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(config.id)}
                  disabled={deletingId === config.id}
                  title={t('settings.ai.delete', 'Delete')}
                  className="h-8 w-8 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
