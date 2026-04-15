import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiKey,
  FiPlus,
  FiTrash2,
  FiCopy,
  FiCheck,
  FiX,
  FiClock,
  FiActivity,
  FiBell,
  FiSend,
  FiRefreshCw,
  FiShield,
  FiAlertTriangle,
  FiExternalLink
} from 'react-icons/fi';
import { apiClient } from '../services/api';
import { useToastContext } from '../contexts/ToastContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  rate_limit_per_hour: number;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

interface NotificationChannel {
  id: string;
  name: string;
  channelType: string;
  config: any;
  isActive: boolean;
  createdAt: string;
}

interface WebhookLog {
  id: string;
  apiKeyId: string | null;
  endpoint: string;
  method: string;
  responseStatus: number;
  durationMs: number;
  createdAt: string;
}

export const WebhookContent: React.FC = () => <WebhookManagementPage embedded />;

export const WebhookManagementPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { t } = useTranslation('dashboard');
  const { success, error: showError } = useToastContext();

  // API Keys State
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['retest', 'status']);
  const [newKeyExpiry, setNewKeyExpiry] = useState<number | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Notification Channels State
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'email' | 'slack'>('email');
  const [channelConfig, setChannelConfig] = useState({ webhookUrl: '' });

  // Webhook Logs State
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Confirm Dialog State
  const [revokeConfirm, setRevokeConfirm] = useState<{isOpen: boolean; keyId: string | null}>({isOpen: false, keyId: null});
  const [deleteChannelConfirm, setDeleteChannelConfirm] = useState<{isOpen: boolean; channelId: string | null}>({isOpen: false, channelId: null});

  // Active Tab
  const [activeTab, setActiveTab] = useState<'keys' | 'channels' | 'logs'>('keys');

  // Load data on mount
  useEffect(() => {
    loadAPIKeys();
    loadNotificationChannels();
    loadWebhookLogs();
  }, []);

  const loadAPIKeys = async () => {
    try {
      setLoadingKeys(true);
      const response = await apiClient.get('/qa-loop/api/api-keys');
      setApiKeys(response.data.api_keys || []);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setLoadingKeys(false);
    }
  };

  const loadNotificationChannels = async () => {
    try {
      setLoadingChannels(true);
      const response = await apiClient.get('/qa-loop/api/notification-channels');
      setChannels(response.data.channels || []);
    } catch (error) {
      console.error('Failed to load notification channels:', error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const loadWebhookLogs = async () => {
    try {
      setLoadingLogs(true);
      const response = await apiClient.get('/qa-loop/api/webhook-logs?limit=50');
      setLogs(response.data.logs || []);
    } catch (error) {
      console.error('Failed to load webhook logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const createAPIKey = async () => {
    try {
      const response = await apiClient.post('/qa-loop/api/api-keys', {
        name: newKeyName,
        permissions: newKeyPermissions,
        expires_in_days: newKeyExpiry
      });

      setCreatedKey(response.data.api_key.key);
      setShowCreateKey(false);
      setNewKeyName('');
      loadAPIKeys();
    } catch (error) {
      console.error('Failed to create API key:', error);
    }
  };

  const revokeAPIKey = (id: string) => {
    setRevokeConfirm({isOpen: true, keyId: id});
  };

  const confirmRevokeAPIKey = async () => {
    const id = revokeConfirm.keyId;
    setRevokeConfirm({isOpen: false, keyId: null});
    if (!id) return;

    try {
      await apiClient.delete(`/qa-loop/api/api-keys/${id}`);
      loadAPIKeys();
    } catch (error) {
      console.error('Failed to revoke API key:', error);
    }
  };

  const createNotificationChannel = async () => {
    try {
      await apiClient.post('/qa-loop/api/notification-channels', {
        name: channelName,
        channel_type: channelType,
        config: channelConfig
      });

      setShowCreateChannel(false);
      setChannelName('');
      setChannelConfig({ webhookUrl: '' });
      loadNotificationChannels();
    } catch (error) {
      console.error('Failed to create notification channel:', error);
    }
  };

  const deleteNotificationChannel = (id: string) => {
    setDeleteChannelConfirm({isOpen: true, channelId: id});
  };

  const confirmDeleteNotificationChannel = async () => {
    const id = deleteChannelConfirm.channelId;
    setDeleteChannelConfirm({isOpen: false, channelId: null});
    if (!id) return;

    try {
      await apiClient.delete(`/qa-loop/api/notification-channels/${id}`);
      loadNotificationChannels();
    } catch (error) {
      console.error('Failed to delete notification channel:', error);
    }
  };

  const testNotificationChannel = async (id: string) => {
    try {
      await apiClient.post(`/qa-loop/api/notification-channels/${id}/test`);
      success(t('dashboard.webhooks.testSent'));
    } catch (error: any) {
      showError(t('dashboard.webhooks.testError', { details: error.response?.data?.details || error.message }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('dashboard.webhooks.never');
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadgeColor = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-green-900/30 text-green-400';
    if (status >= 400 && status < 500) return 'bg-yellow-900/30 text-yellow-400';
    return 'bg-red-900/30 text-red-400';
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        {!embedded && (
          <div className="page-header flex items-center justify-between">
            <div>
              <h1 className="page-title flex items-center gap-2">
                <FiShield className="text-primary" />
                {t('dashboard.webhooks.title')}
              </h1>
              <p className="page-subtitle">
                {t('dashboard.webhooks.subtitle')}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          {[
            { id: 'keys', label: t('dashboard.webhooks.tabs.apiKeys'), icon: FiKey },
            { id: 'channels', label: t('dashboard.webhooks.tabs.notifications'), icon: FiBell },
            { id: 'logs', label: t('dashboard.webhooks.tabs.activityLogs'), icon: FiActivity }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }
              `}
            >
              <tab.icon className="text-lg" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Created Key Modal */}
        {createdKey && (
          <div className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg p-6 max-w-lg w-full mx-4 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-900/30 rounded-full">
                  <FiCheck className="text-green-500 text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {t('dashboard.webhooks.keyCreated')}
                </h3>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-yellow-300 mb-2">
                  <FiAlertTriangle />
                  <span className="font-medium">{t('dashboard.webhooks.saveKeyNow')}</span>
                </div>
                <p className="text-sm text-yellow-400">
                  {t('dashboard.webhooks.keyShownOnce')}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-muted rounded-lg p-3 mb-4">
                <code className="flex-1 font-mono text-sm text-foreground break-all">
                  {createdKey}
                </code>
                <button
                  onClick={() => copyToClipboard(createdKey)}
                  className="p-2 text-muted-foreground hover:text-foreground"
                >
                  {copiedKey ? <FiCheck className="text-green-500" /> : <FiCopy />}
                </button>
              </div>

              <button
                onClick={() => setCreatedKey(null)}
                className="w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                {t('dashboard.webhooks.done')}
              </button>
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'keys' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-foreground">
                {t('dashboard.webhooks.apiKeysCount', { count: apiKeys.length })}
              </h2>
              <button
                onClick={() => setShowCreateKey(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <FiPlus /> {t('dashboard.webhooks.createKey')}
              </button>
            </div>

            {/* Create Key Form */}
            {showCreateKey && (
              <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
                <h3 className="font-medium text-foreground mb-4">{t('dashboard.webhooks.createNewKey')}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {t('dashboard.webhooks.keyNameLabel')}
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder={t('dashboard.webhooks.keyNamePlaceholder')}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {t('dashboard.webhooks.permissionsLabel')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['retest', 'status', 'trigger', 'admin'].map(perm => (
                        <label key={perm} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newKeyPermissions.includes(perm)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewKeyPermissions([...newKeyPermissions, perm]);
                              } else {
                                setNewKeyPermissions(newKeyPermissions.filter(p => p !== perm));
                              }
                            }}
                            className="rounded text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-foreground capitalize">{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {t('dashboard.webhooks.expiresInLabel')}
                    </label>
                    <select
                      value={newKeyExpiry || ''}
                      onChange={(e) => setNewKeyExpiry(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                    >
                      <option value="">{t('dashboard.webhooks.expiresNever')}</option>
                      <option value="30">{t('dashboard.webhooks.expires30days')}</option>
                      <option value="90">{t('dashboard.webhooks.expires90days')}</option>
                      <option value="365">{t('dashboard.webhooks.expires1year')}</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCreateKey(false)}
                      className="px-4 py-2 text-muted-foreground hover:text-foreground"
                    >
                      {t('dashboard.webhooks.cancel')}
                    </button>
                    <button
                      onClick={createAPIKey}
                      disabled={!newKeyName}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('dashboard.webhooks.create')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Keys List */}
            {loadingKeys ? (
              <div className="text-center py-8 text-muted-foreground">{t('dashboard.webhooks.loadingKeys')}</div>
            ) : apiKeys.length === 0 ? (
              <div className="rounded-lg border border-border bg-card text-center py-12 px-8">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FiKey className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{t('dashboard.webhooks.noKeysTitle')}</h3>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                  {t('dashboard.webhooks.noKeysDescription')}
                </p>
                <button
                  onClick={() => setShowCreateKey(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <FiPlus className="h-3.5 w-3.5" /> {t('dashboard.webhooks.createKey')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map(key => (
                  <div
                    key={key.id}
                    className={`
                      bg-card rounded-lg p-4 shadow-sm border
                      ${key.revoked_at
                        ? 'border-red-700 opacity-60'
                        : 'border-border'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FiKey className={key.revoked_at ? 'text-red-500' : 'text-primary'} />
                        <div>
                          <div className="font-medium text-foreground">
                            {key.name}
                            {key.revoked_at && (
                              <span className="ms-2 text-xs bg-red-900/30 text-red-600 px-2 py-0.5 rounded">
                                {t('dashboard.webhooks.revoked')}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {key.key_prefix}••••••••
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-end text-sm">
                          <div className="text-muted-foreground">{t('dashboard.webhooks.lastUsed')}</div>
                          <div className="text-foreground">
                            {formatDate(key.last_used_at)}
                          </div>
                        </div>

                        {!key.revoked_at && (
                          <button
                            onClick={() => revokeAPIKey(key.id)}
                            className="p-2 text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
                            title={t('dashboard.webhooks.revokeKey')}
                          >
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {key.permissions.map(perm => (
                        <span
                          key={perm}
                          className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded"
                        >
                          {perm}
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground">
                        • {key.rate_limit_per_hour}/hr limit
                      </span>
                      {key.expires_at && (
                        <span className="text-xs text-muted-foreground">
                          • Expires {new Date(key.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notification Channels Tab */}
        {activeTab === 'channels' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-foreground">
                {t('dashboard.webhooks.channelsCount', { count: channels.length })}
              </h2>
              <button
                onClick={() => setShowCreateChannel(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <FiPlus /> {t('dashboard.webhooks.addChannel')}
              </button>
            </div>

            {/* Triggers info */}
            <div className="bg-card rounded-lg p-5 shadow-sm border border-border mb-4">
              <h3 className="font-medium text-foreground mb-3">{t('dashboard.webhooks.triggersTitle')}</h3>
              <div className="space-y-2">
                {[
                  { label: t('dashboard.webhooks.triggerScanComplete'), desc: t('dashboard.webhooks.triggerScanCompleteDesc') },
                  { label: t('dashboard.webhooks.triggerBugFound'), desc: t('dashboard.webhooks.triggerBugFoundDesc') },
                  { label: t('dashboard.webhooks.triggerMonitorAlert'), desc: t('dashboard.webhooks.triggerMonitorAlertDesc') },
                ].map(trigger => (
                  <div key={trigger.label} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <FiBell className="text-primary flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-foreground">{trigger.label}</div>
                      <div className="text-xs text-muted-foreground">{trigger.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Create Channel Form */}
            {showCreateChannel && (
              <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
                <h3 className="font-medium text-foreground mb-4">{t('dashboard.webhooks.addChannelTitle')}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {t('dashboard.webhooks.channelNameLabel')}
                    </label>
                    <input
                      type="text"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      placeholder={t('dashboard.webhooks.channelNamePlaceholder')}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {t('dashboard.webhooks.channelTypeLabel')}
                    </label>
                    <select
                      value={channelType}
                      onChange={(e) => setChannelType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                    >
                      <option value="email">{t('dashboard.webhooks.channelTypeEmail')}</option>
                      <option value="slack">{t('dashboard.webhooks.channelTypeSlack')}</option>
                    </select>
                  </div>

                  {channelType === 'slack' && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        {t('dashboard.webhooks.slackWebhookUrlLabel')}
                      </label>
                      <input
                        type="url"
                        value={channelConfig.webhookUrl}
                        onChange={(e) => setChannelConfig({ ...channelConfig, webhookUrl: e.target.value })}
                        placeholder="https://hooks.slack.com/services/..."
                        className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                      />
                    </div>
                  )}

                  {channelType === 'email' as any && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        {t('dashboard.webhooks.emailAddressLabel')}
                      </label>
                      <input
                        type="email"
                        value={channelConfig.webhookUrl}
                        onChange={(e) => setChannelConfig({ ...channelConfig, webhookUrl: e.target.value })}
                        placeholder="team@example.com"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCreateChannel(false)}
                      className="px-4 py-2 text-muted-foreground hover:text-foreground"
                    >
                      {t('dashboard.webhooks.cancel')}
                    </button>
                    <button
                      onClick={createNotificationChannel}
                      disabled={!channelName || !channelConfig.webhookUrl}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('dashboard.webhooks.addChannel')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Channels List */}
            {loadingChannels ? (
              <div className="text-center py-8 text-muted-foreground">{t('dashboard.webhooks.loadingChannels')}</div>
            ) : channels.length === 0 ? (
              <div className="rounded-lg border border-border bg-card text-center py-12 px-8">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FiBell className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{t('dashboard.webhooks.noChannelsTitle')}</h3>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                  {t('dashboard.webhooks.noChannelsDescription')}
                </p>
                <button
                  onClick={() => setShowCreateChannel(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <FiPlus className="h-3.5 w-3.5" /> {t('dashboard.webhooks.addChannel')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {channels.map(channel => (
                  <div
                    key={channel.id}
                    className="bg-card rounded-lg p-4 shadow-sm border border-border"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FiBell className="text-blue-500" />
                        <div>
                          <div className="font-medium text-foreground">
                            {channel.name}
                          </div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {channel.channelType}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => testNotificationChannel(channel.id)}
                          className="p-2 text-blue-500 hover:bg-blue-900/20 rounded-lg transition-colors"
                          title={t('dashboard.webhooks.sendTestNotification')}
                        >
                          <FiSend />
                        </button>
                        <button
                          onClick={() => deleteNotificationChannel(channel.id)}
                          className="p-2 text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
                          title={t('dashboard.webhooks.deleteChannel')}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Activity Logs Tab */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-foreground">
                {t('dashboard.webhooks.recentActivity')}
              </h2>
              <button
                onClick={loadWebhookLogs}
                className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                <FiRefreshCw /> {t('dashboard.webhooks.refresh')}
              </button>
            </div>

            {loadingLogs ? (
              <div className="text-center py-8 text-muted-foreground">{t('dashboard.webhooks.loadingLogs')}</div>
            ) : logs.length === 0 ? (
              <div className="rounded-lg border border-border bg-card text-center py-12 px-8">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                    <FiActivity className="h-6 w-6 text-muted-foreground" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{t('dashboard.webhooks.noActivityTitle')}</h3>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                  {t('dashboard.webhooks.noActivityDescription')}
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                        {t('dashboard.webhooks.endpoint')}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                        {t('dashboard.webhooks.status')}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                        {t('dashboard.webhooks.duration')}
                      </th>
                      <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase">
                        {t('dashboard.webhooks.time')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm">
                          <span className="text-muted-foreground me-2">{log.method}</span>
                          <span className="text-foreground">{log.endpoint}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(log.responseStatus)}`}>
                            {log.responseStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {log.durationMs}ms
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(log.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Documentation Section */}
        <div className="mt-8 p-6 bg-muted rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FiExternalLink className="rtl:scale-x-[-1]" /> {t('dashboard.webhooks.apiDocumentation')}
          </h3>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium text-foreground mb-2">{t('dashboard.webhooks.triggerRetest')}</h4>
              <pre className="bg-muted text-green-400 p-3 rounded-lg overflow-x-auto">
                {`curl -X POST https://your-domain/api/qa-loop/webhook/retest \\
  -H "X-QALoop-Key: qal_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"project_id": "...", "mode": "smart"}'`}
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">{t('dashboard.webhooks.triggerNewSession')}</h4>
              <pre className="bg-muted text-green-400 p-3 rounded-lg overflow-x-auto">
                {`curl -X POST https://your-domain/api/qa-loop/webhook/trigger \\
  -H "X-QALoop-Key: qal_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"target_url": "https://example.com", "mode": "explore"}'`}
              </pre>
            </div>
          </div>
        </div>

        {/* Confirm Dialogs */}
        <ConfirmDialog
          isOpen={revokeConfirm.isOpen}
          title={t('dashboard.webhooks.revokeTitle')}
          message={t('dashboard.webhooks.revokeMessage')}
          confirmText={t('dashboard.webhooks.revokeConfirm')}
          variant="danger"
          onConfirm={confirmRevokeAPIKey}
          onCancel={() => setRevokeConfirm({isOpen: false, keyId: null})}
        />
        <ConfirmDialog
          isOpen={deleteChannelConfirm.isOpen}
          title={t('dashboard.webhooks.deleteChannelTitle')}
          message={t('dashboard.webhooks.deleteChannelMessage')}
          confirmText={t('dashboard.webhooks.deleteConfirm')}
          variant="danger"
          onConfirm={confirmDeleteNotificationChannel}
          onCancel={() => setDeleteChannelConfirm({isOpen: false, channelId: null})}
        />
    </div>
  );
};
