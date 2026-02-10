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
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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

export const WebhookManagementPage: React.FC = () => {
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
  const [channelType, setChannelType] = useState<'slack' | 'discord' | 'webhook'>('slack');
  const [channelConfig, setChannelConfig] = useState({ webhookUrl: '' });

  // Webhook Logs State
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

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
      const response = await axios.get(`${API_URL}/qa-loop/api/api-keys`);
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
      const response = await axios.get(`${API_URL}/qa-loop/api/notification-channels`);
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
      const response = await axios.get(`${API_URL}/qa-loop/api/webhook-logs?limit=50`);
      setLogs(response.data.logs || []);
    } catch (error) {
      console.error('Failed to load webhook logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const createAPIKey = async () => {
    try {
      const response = await axios.post(`${API_URL}/qa-loop/api/api-keys`, {
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

  const revokeAPIKey = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/qa-loop/api/api-keys/${id}`);
      loadAPIKeys();
    } catch (error) {
      console.error('Failed to revoke API key:', error);
    }
  };

  const createNotificationChannel = async () => {
    try {
      await axios.post(`${API_URL}/qa-loop/api/notification-channels`, {
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

  const deleteNotificationChannel = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this notification channel?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/qa-loop/api/notification-channels/${id}`);
      loadNotificationChannels();
    } catch (error) {
      console.error('Failed to delete notification channel:', error);
    }
  };

  const testNotificationChannel = async (id: string) => {
    try {
      await axios.post(`${API_URL}/qa-loop/api/notification-channels/${id}/test`);
      alert('Test notification sent!');
    } catch (error: any) {
      alert(`Failed to send test: ${error.response?.data?.details || error.message}`);
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
    if (status >= 200 && status < 300) return 'bg-green-100 text-green-800';
    if (status >= 400 && status < 500) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FiShield className="text-purple-500" />
            Webhook Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Manage API keys, notification channels, and monitor webhook activity
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
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
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
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
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <FiCheck className="text-green-500 text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  API Key Created
                </h3>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 mb-2">
                  <FiAlertTriangle />
                  <span className="font-medium">Save this key now!</span>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  This key will only be shown once. Store it securely.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 rounded-lg p-3 mb-4">
                <code className="flex-1 font-mono text-sm text-gray-800 dark:text-gray-200 break-all">
                  {createdKey}
                </code>
                <button
                  onClick={() => copyToClipboard(createdKey)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {copiedKey ? <FiCheck className="text-green-500" /> : <FiCopy />}
                </button>
              </div>

              <button
                onClick={() => setCreatedKey(null)}
                className="w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                API Keys ({apiKeys.length})
              </h2>
              <button
                onClick={() => setShowCreateKey(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                <FiPlus /> Create Key
              </button>
            </div>

            {/* Create Key Form */}
            {showCreateKey && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Create New API Key</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., CI/CD Pipeline"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                            className="rounded text-purple-500 focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Expires In
                    </label>
                    <select
                      value={newKeyExpiry || ''}
                      onChange={(e) => setNewKeyExpiry(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createAPIKey}
                      disabled={!newKeyName}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Keys List */}
            {loadingKeys ? (
              <div className="text-center py-8 text-gray-500">Loading API keys...</div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No API keys created yet. Create one to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map(key => (
                  <div
                    key={key.id}
                    className={`
                      bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border
                      ${key.revoked_at
                        ? 'border-red-200 dark:border-red-800 opacity-60'
                        : 'border-gray-200 dark:border-gray-700'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FiKey className={key.revoked_at ? 'text-red-500' : 'text-purple-500'} />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {key.name}
                            {key.revoked_at && (
                              <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                                Revoked
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {key.key_prefix}••••••••
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <div className="text-gray-500">Last used</div>
                          <div className="text-gray-700 dark:text-gray-300">
                            {formatDate(key.last_used_at)}
                          </div>
                        </div>

                        {!key.revoked_at && (
                          <button
                            onClick={() => revokeAPIKey(key.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                          className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded"
                        >
                          {perm}
                        </span>
                      ))}
                      <span className="text-xs text-gray-500">
                        • {key.rate_limit_per_hour}/hr limit
                      </span>
                      {key.expires_at && (
                        <span className="text-xs text-gray-500">
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Notification Channels ({channels.length})
              </h2>
              <button
                onClick={() => setShowCreateChannel(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                <FiPlus /> Add Channel
              </button>
            </div>

            {/* Create Channel Form */}
            {showCreateChannel && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Add Notification Channel</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Channel Name
                    </label>
                    <input
                      type="text"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      placeholder="e.g., Team Slack"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Channel Type
                    </label>
                    <select
                      value={channelType}
                      onChange={(e) => setChannelType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="slack">Slack</option>
                      <option value="discord">Discord</option>
                      <option value="webhook">Generic Webhook</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      value={channelConfig.webhookUrl}
                      onChange={(e) => setChannelConfig({ ...channelConfig, webhookUrl: e.target.value })}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCreateChannel(false)}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createNotificationChannel}
                      disabled={!channelName || !channelConfig.webhookUrl}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Channel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Channels List */}
            {loadingChannels ? (
              <div className="text-center py-8 text-gray-500">Loading channels...</div>
            ) : channels.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No notification channels configured yet.
              </div>
            ) : (
              <div className="space-y-3">
                {channels.map(channel => (
                  <div
                    key={channel.id}
                    className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FiBell className="text-blue-500" />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {channel.name}
                          </div>
                          <div className="text-sm text-gray-500 capitalize">
                            {channel.channelType}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => testNotificationChannel(channel.id)}
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Send test notification"
                        >
                          <FiSend />
                        </button>
                        <button
                          onClick={() => deleteNotificationChannel(channel.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Webhook Activity
              </h2>
              <button
                onClick={loadWebhookLogs}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <FiRefreshCw /> Refresh
              </button>
            </div>

            {loadingLogs ? (
              <div className="text-center py-8 text-gray-500">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No webhook activity recorded yet.
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Endpoint
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <td className="px-4 py-3 text-sm">
                          <span className="text-gray-500 mr-2">{log.method}</span>
                          <span className="text-gray-900 dark:text-white">{log.endpoint}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(log.responseStatus)}`}>
                            {log.responseStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {log.durationMs}ms
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
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
        <div className="mt-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FiExternalLink /> API Documentation
          </h3>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Trigger Retest</h4>
              <pre className="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                {`curl -X POST https://your-domain/api/qa-loop/webhook/retest \\
  -H "X-QALoop-Key: qal_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"project_id": "...", "mode": "smart"}'`}
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Trigger New Session</h4>
              <pre className="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                {`curl -X POST https://your-domain/api/qa-loop/webhook/trigger \\
  -H "X-QALoop-Key: qal_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"target_url": "https://example.com", "mode": "explore"}'`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebhookManagementPage;
