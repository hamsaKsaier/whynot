import React, { useState, useEffect } from 'react';
import { FiLink, FiPlus, FiTrash2, FiCheck, FiX, FiRefreshCw, FiExternalLink } from 'react-icons/fi';
import { apiClient } from '../services/api';

interface Integration {
  id: string;
  workspace_id: string;
  type: 'jira' | 'clickup' | 'linear';
  name: string;
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const INTEGRATION_TYPES = [
  {
    type: 'jira' as const,
    label: 'Jira',
    description: 'Create bug tickets in Jira from discovered bugs',
    icon: '/jira-icon.svg',
    color: 'bg-blue-500',
    fields: [
      { key: 'apiUrl', label: 'Jira URL', placeholder: 'https://yourteam.atlassian.net', type: 'text' },
      { key: 'email', label: 'Email', placeholder: 'you@example.com', type: 'email' },
      { key: 'apiToken', label: 'API Token', placeholder: 'Your Jira API token', type: 'password' },
      { key: 'projectKey', label: 'Project Key', placeholder: 'PROJ', type: 'text' },
    ],
  },
  {
    type: 'clickup' as const,
    label: 'ClickUp',
    description: 'Create tasks in ClickUp from discovered bugs',
    icon: '/clickup-icon.svg',
    color: 'bg-purple-500',
    fields: [
      { key: 'apiToken', label: 'API Token', placeholder: 'Your ClickUp API token', type: 'password' },
      { key: 'listId', label: 'List ID', placeholder: 'Target list ID for tasks', type: 'text' },
    ],
  },
  {
    type: 'linear' as const,
    label: 'Linear',
    description: 'Create issues in Linear from discovered bugs',
    icon: '/linear-icon.svg',
    color: 'bg-indigo-500',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'Your Linear API key', type: 'password' },
      { key: 'teamId', label: 'Team ID', placeholder: 'Target team ID', type: 'text' },
    ],
  },
];

export const IntegrationsPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<typeof INTEGRATION_TYPES[number] | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formName, setFormName] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const workspaceId = localStorage.getItem('workspace_id') || '';

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/integrations?workspace_id=${workspaceId}`);
      setIntegrations(res.data);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIntegration = async () => {
    if (!selectedType || !formName.trim()) return;

    try {
      setSaving(true);
      await apiClient.post('/integrations', {
        workspace_id: workspaceId,
        type: selectedType.type,
        name: formName,
        config: formData,
      });
      setShowAddModal(false);
      setSelectedType(null);
      setFormData({});
      setFormName('');
      await loadIntegrations();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create integration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      setTesting(id);
      setTestResult(null);
      const res = await apiClient.post(`/integrations/${id}/test`);
      setTestResult({ id, ...res.data });
    } catch (error: any) {
      setTestResult({ id, success: false, message: error.response?.data?.error || 'Connection failed' });
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;
    try {
      setDeleting(id);
      await apiClient.delete(`/integrations/${id}`);
      setIntegrations(prev => prev.filter(i => i.id !== id));
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete integration');
    } finally {
      setDeleting(null);
    }
  };

  const getTypeInfo = (type: string) => INTEGRATION_TYPES.find(t => t.type === type);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-500 mt-1">Connect bug trackers to create tasks from discovered bugs with one click</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <FiPlus className="h-4 w-4" />
          Add Integration
        </button>
      </div>

      {/* Integrations List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading integrations...</div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <FiLink className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations yet</h3>
          <p className="text-sm text-gray-500 mb-4">Connect Jira, ClickUp, or Linear to push bugs as tasks</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <FiPlus className="h-4 w-4" />
            Add Integration
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration) => {
            const typeInfo = getTypeInfo(integration.type);
            return (
              <div key={integration.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${typeInfo?.color || 'bg-gray-500'} flex items-center justify-center text-white font-bold text-sm`}>
                      {integration.type === 'jira' ? 'J' : integration.type === 'clickup' ? 'C' : 'L'}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{integration.name}</h3>
                      <p className="text-xs text-gray-500">{typeInfo?.label} &middot; {integration.is_active ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {testResult?.id === integration.id && (
                      <span className={`text-xs px-2 py-1 rounded ${testResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {testResult.success ? <FiCheck className="inline mr-1" /> : <FiX className="inline mr-1" />}
                        {testResult.message}
                      </span>
                    )}
                    <button
                      onClick={() => handleTestConnection(integration.id)}
                      disabled={testing === integration.id}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                      title="Test connection"
                    >
                      <FiRefreshCw className={`h-4 w-4 ${testing === integration.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDelete(integration.id)}
                      disabled={deleting === integration.id}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Delete integration"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  {integration.config.apiUrl && <span>URL: {integration.config.apiUrl}</span>}
                  {integration.config.projectKey && <span className="ml-3">Project: {integration.config.projectKey}</span>}
                  {integration.config.listId && <span className="ml-3">List: {integration.config.listId}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Integration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedType ? `Connect ${selectedType.label}` : 'Add Integration'}
              </h2>
            </div>

            <div className="p-6">
              {!selectedType ? (
                /* Type selection */
                <div className="space-y-3">
                  {INTEGRATION_TYPES.map((type) => (
                    <button
                      key={type.type}
                      onClick={() => {
                        setSelectedType(type);
                        setFormName(type.label);
                      }}
                      className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
                    >
                      <div className={`w-12 h-12 rounded-lg ${type.color} flex items-center justify-center text-white font-bold`}>
                        {type.type === 'jira' ? 'J' : type.type === 'clickup' ? 'C' : 'L'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{type.label}</div>
                        <div className="text-sm text-gray-500">{type.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                /* Config form */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="My Jira Integration"
                    />
                  </div>
                  {selectedType.fields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                      <input
                        type={field.type}
                        value={formData[field.key] || ''}
                        onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  if (selectedType) {
                    setSelectedType(null);
                    setFormData({});
                  } else {
                    setShowAddModal(false);
                  }
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {selectedType ? 'Back' : 'Cancel'}
              </button>
              {selectedType && (
                <button
                  onClick={handleAddIntegration}
                  disabled={saving || !formName.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
