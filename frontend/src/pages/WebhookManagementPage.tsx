import React, { useState, useEffect } from 'react';
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
      success('Test notification sent!');
    } catch (error: any) {
      showError(`Failed to send test: ${error.response?.data?.details || error.message}`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadgeColor = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-green-900/30 text-green-300';
    if (status >= 400 && status < 500) return 'bg-yellow-900/30 text-yellow-300';
    return 'bg-red-900/30 text-red-300';
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        {!embedded && (
          <div className="page-header flex items-center justify-between">
            <div>
              <h1 className="page-title flex items-center gap-2">
                <FiShield className="text-sky-500" />
                Notifications
              </h1>
              <p className="page-subtitle">
                Manage API keys, notification channels, and monitor activity
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          {[
            { id: 'keys', label: 'API Keys', icon: FiKey },
            { id: 'channels', label: 'Notifications', icon: FiBell },
            { id: 'logs', label: 'Activity Logs', icon: FiActivity }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-900/30 rounded-full">
                  <FiCheck className="text-green-500 text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  API Key Created
                </h3>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-yellow-300 mb-2">
                  <FiAlertTriangle />
                  <span className="font-medium">Save this key now!</span>
                </div>
                <p className="text-sm text-yellow-700">
                  This key will only be shown once. Store it securely.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-3 mb-4">
                <code className="flex-1 font-mono text-sm text-slate-200 break-all">
                  {createdKey}
                </code>
                <button
                  onClick={() => copyToClipboard(createdKey)}
                  className="p-2 text-slate-400 hover:text-slate-200"
                >
                  {copiedKey ? <FiCheck className="text-green-500" /> : <FiCopy />}
                </button>
              </div>

              <button
                onClick={() => setCreatedKey(null)}
                className="w-full py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'keys' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">
                API Keys ({apiKeys.length})
              </h2>
              <button
                onClick={() => setShowCreateKey(true)}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
              >
                <FiPlus /> Create Key
              </button>
            </div>

            {/* Create Key Form */}
            {showCreateKey && (
              <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
                <h3 className="font-medium text-white mb-4">Create New API Key</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., CI/CD Pipeline"
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      Permissions
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
                            className="rounded text-sky-500 focus:ring-sky-500"
                          />
                          <span className="text-sm text-slate-200 capitalize">{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      Expires In
                    </label>
                    <select
                      value={newKeyExpiry || ''}
                      onChange={(e) => setNewKeyExpiry(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800 text-white"
                    >
                      <option value="">Never</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCreateKey(false)}
                      className="px-4 py-2 text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createAPIKey}
                      disabled={!newKeyName}
                      className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Keys List */}
            {loadingKeys ? (
              <div className="text-center py-8 text-slate-400">Loading API keys…</div>
            ) : apiKeys.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800 text-center py-12 px-8">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-xl bg-sky-900/20 flex items-center justify-center">
                    <FiKey className="h-6 w-6 text-sky-400" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">No API keys yet</h3>
                <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
                  Create an API key to trigger test runs from your CI/CD pipeline or external tools.
                </p>
                <button
                  onClick={() => setShowCreateKey(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
                >
                  <FiPlus className="h-3.5 w-3.5" /> Create Key
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map(key => (
                  <div
                    key={key.id}
                    className={`
                      bg-slate-800 rounded-xl p-4 shadow-sm border
                      ${key.revoked_at
                        ? 'border-red-800 opacity-60'
                        : 'border-slate-700'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FiKey className={key.revoked_at ? 'text-red-500' : 'text-sky-500'} />
                        <div>
                          <div className="font-medium text-white">
                            {key.name}
                            {key.revoked_at && (
                              <span className="ml-2 text-xs bg-red-900/30 text-red-600 px-2 py-0.5 rounded">
                                Revoked
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-400">
                            {key.key_prefix}••••••••
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <div className="text-slate-400">Last used</div>
                          <div className="text-slate-200">
                            {formatDate(key.last_used_at)}
                          </div>
                        </div>

                        {!key.revoked_at && (
                          <button
                            onClick={() => revokeAPIKey(key.id)}
                            className="p-2 text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Revoke key"
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
                          className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded"
                        >
                          {perm}
                        </span>
                      ))}
                      <span className="text-xs text-slate-400">
                        • {key.rate_limit_per_hour}/hr limit
                      </span>
                      {key.expires_at && (
                        <span className="text-xs text-slate-400">
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
              <h2 className="text-lg font-semibold text-white">
                Notification Channels ({channels.length})
              </h2>
              <button
                onClick={() => setShowCreateChannel(true)}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
              >
                <FiPlus /> Add Channel
              </button>
            </div>

            {/* Triggers info */}
            <div className="bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-700 mb-4">
              <h3 className="font-medium text-white mb-3">Notification Triggers</h3>
              <div className="space-y-2">
                {[
                  { label: 'Scan complete', desc: 'When a QA session finishes running' },
                  { label: 'Bug found (critical)', desc: 'When a critical-severity bug is discovered' },
                  { label: 'Monitor alert', desc: 'When a scheduled monitor detects a regression' },
                ].map(trigger => (
                  <div key={trigger.label} className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg">
                    <FiBell className="text-sky-500 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-white">{trigger.label}</div>
                      <div className="text-xs text-slate-400">{trigger.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Create Channel Form */}
            {showCreateChannel && (
              <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
                <h3 className="font-medium text-white mb-4">Add Notification Channel</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      Channel Name
                    </label>
                    <input
                      type="text"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      placeholder="e.g., Team Slack"
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">
                      Channel Type
                    </label>
                    <select
                      value={channelType}
                      onChange={(e) => setChannelType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800 text-white"
                    >
                      <option value="email">Email</option>
                      <option value="slack">Slack Webhook URL</option>
                    </select>
                  </div>

                  {channelType === 'slack' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-1">
                        Slack Webhook URL
                      </label>
                      <input
                        type="url"
                        value={channelConfig.webhookUrl}
                        onChange={(e) => setChannelConfig({ ...channelConfig, webhookUrl: e.target.value })}
                        placeholder="https://hooks.slack.com/services/..."
                        className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800 text-white"
                      />
                    </div>
                  )}

                  {channelType === 'email' as any && (
                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={channelConfig.webhookUrl}
                        onChange={(e) => setChannelConfig({ ...channelConfig, webhookUrl: e.target.value })}
                        placeholder="team@example.com"
                        className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800 text-white"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCreateChannel(false)}
                      className="px-4 py-2 text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createNotificationChannel}
                      disabled={!channelName || !channelConfig.webhookUrl}
                      className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Channel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Channels List */}
            {loadingChannels ? (
              <div className="text-center py-8 text-slate-400">Loading channels…</div>
            ) : channels.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800 text-center py-12 px-8">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-xl bg-blue-900/20 flex items-center justify-center">
                    <FiBell className="h-6 w-6 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">No notification channels</h3>
                <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
                  Connect Slack, Discord, or a generic webhook to receive test result notifications automatically.
                </p>
                <button
                  onClick={() => setShowCreateChannel(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <FiPlus className="h-3.5 w-3.5" /> Add Channel
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {channels.map(channel => (
                  <div
                    key={channel.id}
                    className="bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FiBell className="text-blue-500" />
                        <div>
                          <div className="font-medium text-white">
                            {channel.name}
                          </div>
                          <div className="text-sm text-slate-400 capitalize">
                            {channel.channelType}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => testNotificationChannel(channel.id)}
                          className="p-2 text-blue-500 hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Send test notification"
                        >
                          <FiSend />
                        </button>
                        <button
                          onClick={() => deleteNotificationChannel(channel.id)}
                          className="p-2 text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete channel"
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
              <h2 className="text-lg font-semibold text-white">
                Recent Activity
              </h2>
              <button
                onClick={loadWebhookLogs}
                className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-slate-200"
              >
                <FiRefreshCw /> Refresh
              </button>
            </div>

            {loadingLogs ? (
              <div className="text-center py-8 text-slate-400">Loading logs…</div>
            ) : logs.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800 text-center py-12 px-8">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-xl bg-slate-900 flex items-center justify-center">
                    <FiActivity className="h-6 w-6 text-slate-500" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-200 mb-1">No activity yet</h3>
                <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
                  Activity will appear here once your API key is used to trigger a test run.
                </p>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                        Endpoint
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-900">
                        <td className="px-4 py-3 text-sm">
                          <span className="text-slate-400 mr-2">{log.method}</span>
                          <span className="text-white">{log.endpoint}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(log.responseStatus)}`}>
                            {log.responseStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {log.durationMs}ms
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">
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
        <div className="mt-8 p-6 bg-slate-800 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FiExternalLink /> API Documentation
          </h3>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium text-slate-200 mb-2">Trigger Retest</h4>
              <pre className="bg-slate-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                {`curl -X POST https://your-domain/api/qa-loop/webhook/retest \\
  -H "X-QALoop-Key: qal_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"project_id": "...", "mode": "smart"}'`}
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-slate-200 mb-2">Trigger New Session</h4>
              <pre className="bg-slate-900 text-green-400 p-3 rounded-lg overflow-x-auto">
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
          title="Revoke API Key"
          message="Are you sure you want to revoke this API key? This action cannot be undone."
          confirmText="Revoke"
          variant="danger"
          onConfirm={confirmRevokeAPIKey}
          onCancel={() => setRevokeConfirm({isOpen: false, keyId: null})}
        />
        <ConfirmDialog
          isOpen={deleteChannelConfirm.isOpen}
          title="Delete Notification Channel"
          message="Are you sure you want to delete this notification channel?"
          confirmText="Delete"
          variant="danger"
          onConfirm={confirmDeleteNotificationChannel}
          onCancel={() => setDeleteChannelConfirm({isOpen: false, channelId: null})}
        />
    </div>
  );
};
