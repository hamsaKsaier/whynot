import React, { useState, useEffect } from 'react';
import { FiGithub, FiPlus, FiTrash2, FiRefreshCw, FiCheck, FiX } from 'react-icons/fi';
import { apiClient } from '../services/api';
import { useToastContext } from '../contexts/ToastContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal, ModalFooter } from '../components/common/Modal';

interface GitHubRepo {
  id: string;
  workspace_id: string;
  owner: string;
  repo: string;
  default_branch: string;
  access_token: string | null;
  created_at: string;
}

export const GitHubReposPage: React.FC = () => {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { success, error: showError } = useToastContext();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  useEffect(() => {
    loadRepos();
  }, []);

  const loadRepos = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/github-repos?workspace_id=${workspaceId}`);
      setRepos(res.data);
    } catch (error) {
      console.error('Failed to load repos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!owner.trim() || !repo.trim() || !token.trim()) return;
    try {
      setSaving(true);
      await apiClient.post('/github-repos', {
        workspace_id: workspaceId,
        owner: owner.trim(),
        repo: repo.trim(),
        default_branch: branch.trim() || 'main',
        access_token: token.trim(),
      });
      setShowAddModal(false);
      setOwner('');
      setRepo('');
      setBranch('main');
      setToken('');
      await loadRepos();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to connect repo');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: string) => {
    try {
      setTesting(id);
      setTestResult(null);
      const res = await apiClient.post(`/github-repos/${id}/test`);
      setTestResult({ id, ...res.data });
    } catch (error: any) {
      setTestResult({ id, success: false, message: error.response?.data?.error || 'Test failed' });
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id);
      await apiClient.delete(`/github-repos/${id}`);
      setRepos(prev => prev.filter(r => r.id !== id));
      success('Repository disconnected successfully');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to disconnect');
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GitHub Repositories</h1>
          <p className="text-sm text-gray-500 mt-1">Connect repos to enable Auto-Fix — AI generates PRs to fix discovered bugs</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <FiPlus className="h-4 w-4" />
          Connect Repo
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading repositories...</div>
      ) : repos.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <FiGithub className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No repositories connected</h3>
          <p className="text-sm text-gray-500 mb-4">Connect a GitHub repository to enable automatic bug fixes via pull requests</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <FiGithub className="h-4 w-4" />
            Connect Repository
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {repos.map(r => (
            <div key={r.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FiGithub className="h-8 w-8 text-gray-800" />
                  <div>
                    <h3 className="font-medium text-gray-900">
                      <span className="text-gray-500">{r.owner}/</span>{r.repo}
                    </h3>
                    <p className="text-xs text-gray-500">Branch: {r.default_branch} &middot; Connected {new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {testResult?.id === r.id && (
                    <span className={`text-xs px-2 py-1 rounded ${testResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {testResult.success ? <FiCheck className="inline mr-1" /> : <FiX className="inline mr-1" />}
                      {testResult.message}
                    </span>
                  )}
                  <button
                    onClick={() => handleTest(r.id)}
                    disabled={testing === r.id}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    title="Test connection"
                  >
                    <FiRefreshCw className={`h-4 w-4 ${testing === r.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(r.id)}
                    disabled={deleting === r.id}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    title="Disconnect"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Repo Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Connect GitHub Repository"
        size="lg"
      >
        <p className="text-sm text-gray-500 mb-4">
          Provide a personal access token with <code className="bg-gray-100 px-1 rounded">repo</code> scope
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
              <input
                type="text"
                value={owner}
                onChange={e => setOwner(e.target.value)}
                placeholder="octocat"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repository</label>
              <input
                type="text"
                value={repo}
                onChange={e => setRepo(e.target.value)}
                placeholder="my-app"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Branch</label>
            <input
              type="text"
              value={branch}
              onChange={e => setBranch(e.target.value)}
              placeholder="main"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Personal Access Token</label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Create at GitHub &gt; Settings &gt; Developer settings &gt; Personal access tokens.
              Needs <code className="bg-gray-100 px-1 rounded">repo</code> scope.
            </p>
          </div>
        </div>

        <ModalFooter>
          <button
            onClick={() => setShowAddModal(false)}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={saving || !owner.trim() || !repo.trim() || !token.trim()}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Connecting...' : 'Connect'}
          </button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Disconnect Repository"
        message="Are you sure you want to disconnect this repository? This action cannot be undone."
        confirmText="Disconnect"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};
