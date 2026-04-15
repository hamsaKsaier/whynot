import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiTrash2, FiCheck, FiZap, FiEye, FiEyeOff, FiLoader } from 'react-icons/fi';
import { apiClient } from '../../../services/api';

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

type ProviderName = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'custom';

const PROVIDER_LABELS: Record<ProviderName, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  openrouter: 'OpenRouter',
  custom: 'Custom (OpenAI-compatible)',
};

const PROVIDER_MODELS: Record<ProviderName, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'],
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-3-5-sonnet-20241022'],
  google: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  openrouter: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-001', 'meta-llama/llama-3.1-405b-instruct'],
  custom: [],
};

export const AiContent: React.FC = () => {
  const { t } = useTranslation('settings');
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formProvider, setFormProvider] = useState<ProviderName>('openai');
  const [formModel, setFormModel] = useState('gpt-4o');
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

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleProviderChange = (provider: ProviderName) => {
    setFormProvider(provider);
    const models = PROVIDER_MODELS[provider];
    setFormModel(models[0] || '');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FiLoader className="h-5 w-5 animate-spin text-muted-foreground" />
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
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-foreground hover:bg-primary/90 transition-colors duration-150 w-full sm:w-auto"
          >
            <FiPlus className="h-4 w-4" />
            {t('settings.ai.addProvider', 'Add provider')}
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-card p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t('settings.ai.providerLabel', 'Provider')}
              </label>
              <select
                value={formProvider}
                onChange={(e) => handleProviderChange(e.target.value as ProviderName)}
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {(Object.keys(PROVIDER_LABELS) as ProviderName[]).map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t('settings.ai.modelLabel', 'Model')}
              </label>
              {PROVIDER_MODELS[formProvider].length > 0 ? (
                <select
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  {PROVIDER_MODELS[formProvider].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  placeholder="e.g. my-model-v1"
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              )}
            </div>
          </div>

          {formProvider === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Base URL
              </label>
              <input
                type="url"
                value={formBaseUrl}
                onChange={(e) => setFormBaseUrl(e.target.value)}
                placeholder="https://my-api.example.com/v1"
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              {t('settings.ai.apiKeyLabel', 'API Key')}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="sk-..."
                required
                className="w-full rounded-md border border-border bg-muted px-3 py-2 pe-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormApiKey(''); setShowApiKey(false); }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formModel || !formApiKey}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors duration-150"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {configs.length === 0 && !showForm && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No AI providers configured yet. Add one to use your own API keys.
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
                    {PROVIDER_LABELS[config.provider as ProviderName] || config.provider}
                  </span>
                  {config.isDefault && (
                    <span className="inline-flex items-center rounded-md bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary border border-primary/30">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {config.model} &middot; {config.apiKey}
                </p>
                {testResult && testResult.id === config.id && (
                  <p className={`text-xs mt-1 ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {testResult.ok
                      ? t('settings.ai.testSuccess', 'Connection successful ({{ms}}ms)', { ms: testResult.latencyMs })
                      : t('settings.ai.testFailure', 'Connection failed: {{error}}', { error: testResult.error })}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleTest(config.id)}
                  disabled={testingId === config.id}
                  title={t('settings.ai.testButton', 'Test connection')}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 disabled:opacity-50"
                >
                  {testingId === config.id ? (
                    <FiLoader className="h-4 w-4 animate-spin" />
                  ) : (
                    <FiZap className="h-4 w-4" />
                  )}
                </button>
                {!config.isDefault && (
                  <button
                    onClick={() => handleSetDefault(config.id)}
                    title={t('settings.ai.setDefault', 'Set as default')}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
                  >
                    <FiCheck className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(config.id)}
                  disabled={deletingId === config.id}
                  title={t('settings.ai.delete', 'Delete')}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors duration-150 disabled:opacity-50"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
