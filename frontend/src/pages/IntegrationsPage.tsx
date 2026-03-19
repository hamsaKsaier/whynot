import React, { useState, useEffect } from 'react';
import { FiLink, FiPlus, FiTrash2, FiCheck, FiX, FiRefreshCw, FiGithub } from 'react-icons/fi';
import { apiClient } from '../services/api';
import { useToastContext } from '../contexts/ToastContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal, ModalFooter } from '../components/common/Modal';
import {
  connectClickUp,
  getClickUpWorkspaces,
  getClickUpLists,
  saveClickUpConfig,
  getClickUpStatus,
  getGitHubStatus,
  getGitHubRepos,
  saveGitHubConfig,
  ClickUpWorkspace,
  ClickUpList,
  ClickUpStatus,
  GitHubStatus,
  GitHubRepo,
} from '../services/integrations-api';

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
    color: 'bg-sky-500',
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
    color: 'bg-sky-500',
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

  // ClickUp bug reporting state
  const [clickUpStatus, setClickUpStatus] = useState<ClickUpStatus | null>(null);
  const [clickUpToken, setClickUpToken] = useState('');
  const [clickUpConnecting, setClickUpConnecting] = useState(false);
  const [clickUpWorkspaces, setClickUpWorkspaces] = useState<ClickUpWorkspace[]>([]);
  const [clickUpLists, setClickUpLists] = useState<ClickUpList[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [selectedList, setSelectedList] = useState<string>('');
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [savingClickUp, setSavingClickUp] = useState(false);

  // GitHub bug reporting state
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [loadingGithub, setLoadingGithub] = useState(false);
  const [savingGithub, setSavingGithub] = useState(false);

  const { success, error: showError } = useToastContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  useEffect(() => {
    loadIntegrations();
    loadBugReportingStatus();
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

  const loadBugReportingStatus = async () => {
    try {
      const [cuStatus, ghStatus] = await Promise.all([
        getClickUpStatus().catch(() => ({ connected: false }) as ClickUpStatus),
        getGitHubStatus().catch(() => ({ connected: false, githubId: null, repoOwner: null, repoName: null, repoFullName: null }) as GitHubStatus),
      ]);
      setClickUpStatus(cuStatus);
      setGithubStatus(ghStatus);
      if (cuStatus.workspaceId) setSelectedWorkspace(cuStatus.workspaceId);
      if (ghStatus.repoOwner && ghStatus.repoName) {
        setSelectedRepo(`${ghStatus.repoOwner}/${ghStatus.repoName}`);
      }
    } catch (error) {
      console.error('Failed to load bug reporting status:', error);
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

  // ClickUp bug reporting handlers
  const handleClickUpConnect = async () => {
    if (!clickUpToken.trim()) return;
    setClickUpConnecting(true);
    try {
      const result = await connectClickUp(clickUpToken.trim());
      success(`Connected to ClickUp as ${result.username}`);
      setClickUpToken('');
      setClickUpStatus({ connected: true, username: result.username });
      // Auto-load workspaces
      handleLoadWorkspaces();
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to connect to ClickUp');
    } finally {
      setClickUpConnecting(false);
    }
  };

  const handleLoadWorkspaces = async () => {
    setLoadingWorkspaces(true);
    try {
      const data = await getClickUpWorkspaces();
      setClickUpWorkspaces(data.workspaces);
      if (data.workspaces.length === 1) {
        setSelectedWorkspace(data.workspaces[0].id);
        handleLoadLists(data.workspaces[0].id);
      }
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to load workspaces');
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const handleLoadLists = async (wsId: string) => {
    setLoadingLists(true);
    setSelectedWorkspace(wsId);
    try {
      const data = await getClickUpLists(wsId);
      setClickUpLists(data.lists);
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to load lists');
    } finally {
      setLoadingLists(false);
    }
  };

  const handleSaveClickUpConfig = async () => {
    if (!selectedList || !selectedWorkspace) return;
    setSavingClickUp(true);
    try {
      const ws = clickUpWorkspaces.find(w => w.id === selectedWorkspace);
      const list = clickUpLists.find(l => l.id === selectedList);
      await saveClickUpConfig({
        workspaceId: selectedWorkspace,
        workspaceName: ws?.name || '',
        listId: selectedList,
        listName: list?.name || '',
      });
      setClickUpStatus(prev => prev ? {
        ...prev,
        workspaceId: selectedWorkspace,
        workspaceName: ws?.name || null,
        listId: selectedList,
        listName: list?.name || null,
      } : prev);
      success('ClickUp configuration saved');
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to save configuration');
    } finally {
      setSavingClickUp(false);
    }
  };

  // GitHub bug reporting handlers
  const handleLoadGithubRepos = async () => {
    setLoadingGithub(true);
    try {
      const data = await getGitHubRepos();
      setGithubRepos(data.repos);
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to load GitHub repos');
    } finally {
      setLoadingGithub(false);
    }
  };

  const handleSaveGithubConfig = async () => {
    if (!selectedRepo) return;
    const [owner, repo] = selectedRepo.split('/');
    if (!owner || !repo) return;
    setSavingGithub(true);
    try {
      await saveGitHubConfig({ repoOwner: owner, repoName: repo });
      setGithubStatus(prev => prev ? {
        ...prev,
        repoOwner: owner,
        repoName: repo,
        repoFullName: `${owner}/${repo}`,
      } : prev);
      success('GitHub Issues configuration saved');
    } catch (err: any) {
      showError(err.response?.data?.error || 'Failed to save GitHub configuration');
    } finally {
      setSavingGithub(false);
    }
  };

  useEffect(() => {
    if (clickUpStatus?.connected && clickUpWorkspaces.length === 0) {
      handleLoadWorkspaces();
    }
  }, [clickUpStatus?.connected]);

  useEffect(() => {
    if (githubStatus?.connected && githubRepos.length === 0) {
      handleLoadGithubRepos();
    }
  }, [githubStatus?.connected]);

  return (
    <div className={embedded ? '' : 'p-6 max-w-4xl mx-auto'}>
      {/* Header */}
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Integrations</h1>
            <p className="text-sm text-slate-400 mt-1">Connect bug trackers to create tasks from discovered bugs with one click</p>
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

      {/* ── Bug Reporting Integrations ──────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-1">Bug Reporting</h2>
        <p className="text-sm text-slate-400 mb-4">Configure where bugs are reported directly from bug cards</p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* ClickUp Section */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-sm">CU</div>
              <div>
                <h3 className="font-medium text-white">ClickUp</h3>
                <p className="text-xs text-slate-400">
                  {clickUpStatus?.connected
                    ? `Connected as ${clickUpStatus.username || 'ClickUp User'}`
                    : 'Not connected'}
                </p>
              </div>
              {clickUpStatus?.connected && (
                <FiCheck className="ml-auto text-green-500 h-5 w-5" />
              )}
            </div>

            {!clickUpStatus?.connected ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">API Token</label>
                  <input
                    type="password"
                    value={clickUpToken}
                    onChange={e => setClickUpToken(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm"
                    placeholder="pk_..."
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Get your token from ClickUp Settings &gt; Apps &gt; API Token
                  </p>
                </div>
                <button
                  onClick={handleClickUpConnect}
                  disabled={clickUpConnecting || !clickUpToken.trim()}
                  className="w-full px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {clickUpConnecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Workspace selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Workspace</label>
                  {loadingWorkspaces ? (
                    <p className="text-sm text-slate-500">Loading workspaces...</p>
                  ) : (
                    <select
                      value={selectedWorkspace}
                      onChange={e => handleLoadLists(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm"
                    >
                      <option value="">Select workspace...</option>
                      {clickUpWorkspaces.map(ws => (
                        <option key={ws.id} value={ws.id}>{ws.name} ({ws.members} members)</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* List selector */}
                {selectedWorkspace && (
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">Target List</label>
                    {loadingLists ? (
                      <p className="text-sm text-slate-500">Loading lists...</p>
                    ) : (
                      <select
                        value={selectedList}
                        onChange={e => setSelectedList(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm"
                      >
                        <option value="">Select list...</option>
                        {clickUpLists.map(list => (
                          <option key={list.id} value={list.id}>
                            {list.folder ? `${list.space} / ${list.folder} / ${list.name}` : `${list.space} / ${list.name}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {clickUpStatus.listName && (
                  <div className="text-xs text-green-600 bg-green-900/20 rounded px-3 py-2">
                    Currently reporting to: <strong>{clickUpStatus.listName}</strong>
                    {clickUpStatus.workspaceName && <span> in {clickUpStatus.workspaceName}</span>}
                  </div>
                )}

                <button
                  onClick={handleSaveClickUpConfig}
                  disabled={savingClickUp || !selectedList}
                  className="w-full px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {savingClickUp ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            )}
          </div>

          {/* GitHub Section */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white">
                <FiGithub className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium text-white">GitHub Issues</h3>
                <p className="text-xs text-slate-400">
                  {githubStatus?.connected
                    ? 'Connected via OAuth'
                    : 'Not connected — sign in with GitHub first'}
                </p>
              </div>
              {githubStatus?.connected && (
                <FiCheck className="ml-auto text-green-500 h-5 w-5" />
              )}
            </div>

            {!githubStatus?.connected ? (
              <div className="text-center py-4">
                <p className="text-sm text-slate-400 mb-3">Sign in with GitHub to report bugs as issues</p>
                <a
                  href="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm"
                >
                  <FiGithub className="h-4 w-4" />
                  Sign in with GitHub
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Target Repository</label>
                  {loadingGithub ? (
                    <p className="text-sm text-slate-500">Loading repos...</p>
                  ) : githubRepos.length === 0 ? (
                    <div className="text-sm text-slate-400">
                      <p>No repos connected yet.</p>
                      <a href="/settings?tab=github" className="text-primary-600 hover:text-primary-300 text-sm">
                        Connect a repo in GitHub Repos settings
                      </a>
                    </div>
                  ) : (
                    <select
                      value={selectedRepo}
                      onChange={e => setSelectedRepo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-slate-600 focus:border-slate-500 text-sm"
                    >
                      <option value="">Select repository...</option>
                      {githubRepos.map(repo => (
                        <option key={repo.id} value={`${repo.owner}/${repo.repo}`}>
                          {repo.owner}/{repo.repo}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {githubStatus.repoFullName && (
                  <div className="text-xs text-green-600 bg-green-900/20 rounded px-3 py-2">
                    Currently reporting to: <strong>{githubStatus.repoFullName}</strong>
                  </div>
                )}

                {githubRepos.length > 0 && (
                  <button
                    onClick={handleSaveGithubConfig}
                    disabled={savingGithub || !selectedRepo}
                    className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors text-sm"
                  >
                    {savingGithub ? 'Saving...' : 'Save Configuration'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Workspace-level Integrations (existing) ────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Workspace Integrations</h2>
          <p className="text-sm text-slate-400">Jira, ClickUp, and Linear integrations shared across the workspace</p>
        </div>
        {embedded && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
          >
            <FiPlus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      {/* Integrations List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading integrations...</div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 rounded-xl border border-dashed border-slate-600">
          <FiLink className="h-10 w-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-medium text-white mb-1">No workspace integrations yet</h3>
          <p className="text-sm text-slate-400 mb-3">Connect Jira, ClickUp, or Linear to push bugs as tasks</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
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
              <div key={integration.id} className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${typeInfo?.color || 'bg-slate-9000'} flex items-center justify-center text-white font-bold text-sm`}>
                      {integration.type === 'jira' ? 'J' : integration.type === 'clickup' ? 'C' : 'L'}
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{integration.name}</h3>
                      <p className="text-xs text-slate-400">{typeInfo?.label} &middot; {integration.is_active ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {testResult?.id === integration.id && (
                      <span className={`text-xs px-2 py-1 rounded ${testResult.success ? 'bg-green-900/30 text-green-700' : 'bg-red-900/30 text-red-700'}`}>
                        {testResult.success ? <FiCheck className="inline mr-1" /> : <FiX className="inline mr-1" />}
                        {testResult.message}
                      </span>
                    )}
                    <button
                      onClick={() => handleTestConnection(integration.id)}
                      disabled={testing === integration.id}
                      className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors disabled:opacity-50"
                      title="Test connection"
                    >
                      <FiRefreshCw className={`h-4 w-4 ${testing === integration.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(integration.id)}
                      disabled={deleting === integration.id}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                      title="Delete integration"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
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
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-slate-700 hover:border-primary-300 hover:bg-primary-900/20 transition-colors text-left"
              >
                <div className={`w-12 h-12 rounded-lg ${type.color} flex items-center justify-center text-white font-bold`}>
                  {type.type === 'jira' ? 'J' : type.type === 'clickup' ? 'C' : 'L'}
                </div>
                <div>
                  <div className="font-medium text-white">{type.label}</div>
                  <div className="text-sm text-slate-400">{type.description}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Config form */
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">Name</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="My Jira Integration"
              />
            </div>
            {selectedType.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-slate-200 mb-1">{field.label}</label>
                <input
                  type={field.type}
                  value={formData[field.key] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
            className="px-4 py-2 text-slate-200 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
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
