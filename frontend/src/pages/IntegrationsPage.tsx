import React, { useState, useEffect } from 'react';
import { FiLink, FiPlus, FiTrash2, FiCheck, FiX, FiRefreshCw, FiKey, FiCopy, FiTerminal } from 'react-icons/fi';
import { apiClient } from '../services/api';
import { useToastContext } from '../contexts/ToastContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal, ModalFooter } from '../components/common/Modal';

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
      { key: 'listId', label: 'List ID', placeholder: 'List ID or full ClickUp list URL', type: 'text' },
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

export const IntegrationsContent: React.FC = () => <IntegrationsPage embedded />;

export const IntegrationsPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { success, error: showError } = useToastContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

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
      showError(error.response?.data?.error || 'Failed to create integration');
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
    try {
      setDeleting(id);
      await apiClient.delete(`/integrations/${id}`);
      setIntegrations(prev => prev.filter(i => i.id !== id));
      success('Integration deleted successfully');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to delete integration');
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  };

  const getTypeInfo = (type: string) => INTEGRATION_TYPES.find(t => t.type === type);

  return (
    <div className={embedded ? '' : 'p-6 max-w-4xl mx-auto'}>
      {/* Header */}
      {!embedded && (
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
      )}

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
                      onClick={() => setDeleteConfirm(integration.id)}
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
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={selectedType ? `Connect ${selectedType.label}` : 'Add Integration'}
        size="lg"
      >
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

        <ModalFooter>
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
        </ModalFooter>
      </Modal>

      {/* ── CI/CD Integration Section ────────────────────────────────────── */}
      <CIKeysSection />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete Integration"
        message="Are you sure you want to delete this integration? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};

// ── CI API Keys Section ────────────────────────────────────────────────────

interface CIKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

const CIKeysSection: React.FC = () => {
  const [keys, setKeys] = useState<CIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadKeys = async () => {
    try {
      const res = await apiClient.get('/ci/keys');
      setKeys(res.data);
    } catch {
      // CI keys endpoint may not be available
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadKeys(); }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await apiClient.post('/ci/keys', { name: newKeyName });
      setCreatedKey(res.data.key);
      setNewKeyName('');
      loadKeys();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Revoke this API key? Any CI pipelines using it will stop working.')) return;
    try {
      await apiClient.delete(`/ci/keys/${id}`);
      loadKeys();
    } catch (error) {
      console.error('Failed to revoke key:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FiTerminal className="h-5 w-5 text-purple-600" />
            CI/CD Integration
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Run QA scans from GitHub Actions, GitLab CI, or any CI pipeline
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setCreatedKey(null); }}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm transition-colors"
        >
          <FiKey className="h-4 w-4" />
          New API Key
        </button>
      </div>

      {/* Created key display */}
      {createdKey && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
            <FiCheck className="h-4 w-4" />
            API Key Created — Save this now!
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white border border-green-200 rounded text-sm font-mono text-gray-900 select-all">
              {createdKey}
            </code>
            <button
              onClick={() => copyToClipboard(createdKey)}
              className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              {copied ? <FiCheck className="h-4 w-4" /> : <FiCopy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-green-600 mt-2">This key will not be shown again.</p>
        </div>
      )}

      {/* Create form */}
      {showCreate && !createdKey && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g., GitHub Actions)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-2 text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="text-center py-6 text-gray-400 text-sm">Loading API keys...</div>
      ) : keys.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <FiKey className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-2">No API keys yet</p>
          <p className="text-gray-400 text-xs max-w-sm mx-auto">
            Create an API key to authenticate QA scans from your CI/CD pipeline
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <FiKey className={`h-4 w-4 ${k.is_active ? 'text-purple-500' : 'text-gray-300'}`} />
                <div>
                  <span className="text-sm font-medium text-gray-900">{k.name}</span>
                  <span className="text-xs text-gray-400 ml-2 font-mono">{k.key_prefix}...</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                {k.last_used_at && (
                  <span>Last used: {new Date(k.last_used_at).toLocaleDateString()}</span>
                )}
                <span>{new Date(k.created_at).toLocaleDateString()}</span>
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="text-red-400 hover:text-red-600 transition-colors p-1"
                  title="Revoke key"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage instructions */}
      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Quick Start</h3>
        <pre className="text-xs text-gray-600 bg-white p-3 rounded border border-gray-200 overflow-x-auto">{`# Start a QA scan
curl -X POST https://your-whynot-instance.com/api/ci/scan \\
  -H "Authorization: Bearer wn_ci_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"targetUrl": "https://your-app.com", "qualityThreshold": 80}'

# Check results (poll until status=completed)
curl https://your-whynot-instance.com/api/ci/results/SESSION_ID \\
  -H "Authorization: Bearer wn_ci_your_key_here"`}</pre>
      </div>
    </div>
  );
};
