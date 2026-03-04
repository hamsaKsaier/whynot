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
    <div className="space-y-6">
        {/* Header */}
        <div className="page-header flex items-center justify-between">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <FiShield className="text-purple-500" />
              Webhook Management
            </h1>
            <p className="page-subtitle">
              Manage API keys, notification channels, and monitor webhook activity
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
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
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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
            <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-full">
                  <FiCheck className="text-green-500 text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  API Key Created
                </h3>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-yellow-800 mb-2">
                  <FiAlertTriangle />
                  <span className="font-medium">Save this key now!</span>
                </div>
                <p className="text-sm text-yellow-700">
                  This key will only be shown once. Store it securely.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-3 mb-4">
                <code className="flex-1 font-mono text-sm text-gray-800 break-all">
                  {createdKey}
                </code>
                <button
                  onClick={() => copyToClipboard(createdKey)}
                  className="p-2 text-gray-500 hover:text-gray-700"
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
              <h2 className="text-lg font-semibold text-gray-900">
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
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-4">Create New API Key</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., CI/CD Pipeline"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                          <span className="text-sm text-gray-700 capitalize">{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expires In
                    </label>
                    <select
                      value={newKeyExpiry || ''}
                      onChange={(e) => setNewKeyExpiry(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
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
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
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
              <div className="text-center py-8 text-gray-500">Loading API keys…</div>
            ) : apiKeys.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white text-center py-12 px-8">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center">
                    <FiKey className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">No API keys yet</h3>
                <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
                  Create an API key to trigger test runs from your CI/CD pipeline or external tools.
                </p>
                <button
                  onClick={() => setShowCreateKey(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
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
                      bg-white rounded-xl p-4 shadow-sm border
                      ${key.revoked_at
                        ? 'border-red-200 opacity-60'
                        : 'border-gray-200'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FiKey className={key.revoked_at ? 'text-red-500' : 'text-purple-500'} />
                        <div>
                          <div className="font-medium text-gray-900">
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
                          <div className="text-gray-700">
                            {formatDate(key.last_used_at)}
                          </div>
                        </div>

                        {!key.revoked_at && (
                          <button
                            onClick={() => revokeAPIKey(key.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
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
              <h2 className="text-lg font-semibold text-gray-900">
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
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-4">Add Notification Channel</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Channel Name
                    </label>
                    <input
                      type="text"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      placeholder="e.g., Team Slack"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Channel Type
                    </label>
                    <select
                      value={channelType}
                      onChange={(e) => setChannelType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    >
                      <option value="slack">Slack</option>
                      <option value="discord">Discord</option>
                      <option value="webhook">Generic Webhook</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      value={channelConfig.webhookUrl}
                      onChange={(e) => setChannelConfig({ ...channelConfig, webhookUrl: e.target.value })}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCreateChannel(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
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
              <div className="text-center py-8 text-gray-500">Loading channels…</div>
            ) : channels.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white text-center py-12 px-8">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FiBell className="h-6 w-6 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">No notification channels</h3>
                <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
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
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FiBell className="text-blue-500" />
                        <div>
                          <div className="font-medium text-gray-900">
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
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Send test notification"
                        >
                          <FiSend />
                        </button>
                        <button
                          onClick={() => deleteNotificationChannel(channel.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Webhook Activity
              </h2>
              <button
                onClick={loadWebhookLogs}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                <FiRefreshCw /> Refresh
              </button>
            </div>

            {loadingLogs ? (
              <div className="text-center py-8 text-gray-500">Loading logs…</div>
            ) : logs.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white text-center py-12 px-8">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center">
                    <FiActivity className="h-6 w-6 text-gray-400" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">No activity yet</h3>
                <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
                  Webhook calls will appear here once your API key is used to trigger a test run.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
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
                  <tbody className="divide-y divide-gray-200">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <span className="text-gray-500 mr-2">{log.method}</span>
                          <span className="text-gray-900">{log.endpoint}</span>
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
        <div className="mt-8 p-6 bg-gray-100 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiExternalLink /> API Documentation
          </h3>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Trigger Retest</h4>
              <pre className="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                {`curl -X POST https://your-domain/api/qa-loop/webhook/retest \\
  -H "X-QALoop-Key: qal_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"project_id": "...", "mode": "smart"}'`}
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Trigger New Session</h4>
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
  );
};

export default WebhookManagementPage;
