import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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

export const GitHubReposContent: React.FC = () => <GitHubReposPage embedded />;

export const GitHubReposPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { t } = useTranslation('dashboard');
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
      showError(error.response?.data?.error || t('dashboard.github.connectError'));
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
      setTestResult({ id, success: false, message: error.response?.data?.error || t('dashboard.github.testFailed') });
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleting(id);
      await apiClient.delete(`/github-repos/${id}`);
      setRepos(prev => prev.filter(r => r.id !== id));
      success(t('dashboard.github.disconnected'));
    } catch (error: any) {
      showError(error.response?.data?.error || t('dashboard.github.disconnectError'));
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className={embedded ? '' : 'p-6 max-w-4xl mx-auto'}>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('dashboard.github.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('dashboard.github.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-foreground rounded-lg hover:bg-sky-700 transition-colors"
          >
            <FiPlus className="h-4 w-4" />
            {t('dashboard.github.connectRepo')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t('dashboard.github.loading')}</div>
      ) : repos.length === 0 ? (
        <div className="text-center py-16 bg-muted rounded-xl border border-dashed border-border">
          <FiGithub className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t('dashboard.github.emptyTitle')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('dashboard.github.emptyDescription')}</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-foreground rounded-lg hover:bg-sky-700 transition-colors"
          >
            <FiGithub className="h-4 w-4" />
            {t('dashboard.github.connectRepository')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {repos.map(r => (
            <div key={r.id} className="bg-card rounded-lg border border-border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FiGithub className="h-8 w-8 text-foreground" />
                  <div>
                    <h3 className="font-medium text-foreground">
                      <span className="text-muted-foreground">{r.owner}/</span>{r.repo}
                    </h3>
                    <p className="text-xs text-muted-foreground">{t('dashboard.github.branch')}: {r.default_branch} &middot; {t('dashboard.github.connected')} {new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {testResult?.id === r.id && (
                    <span className={`text-xs px-2 py-1 rounded ${testResult.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                      {testResult.success ? <FiCheck className="inline me-1" /> : <FiX className="inline me-1" />}
                      {testResult.message}
                    </span>
                  )}
                  <button
                    onClick={() => handleTest(r.id)}
                    disabled={testing === r.id}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                    title={t('dashboard.github.testConnection')}
                  >
                    <FiRefreshCw className={`h-4 w-4 ${testing === r.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(r.id)}
                    disabled={deleting === r.id}
                    className="p-2 text-red-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                    title={t('dashboard.github.disconnect')}
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
        title={t('dashboard.github.connectTitle')}
        size="lg"
      >
        <p className="text-sm text-muted-foreground mb-4">
          {t('dashboard.github.tokenDescription')}
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('dashboard.github.ownerLabel')}</label>
              <input
                type="text"
                value={owner}
                onChange={e => setOwner(e.target.value)}
                placeholder="octocat"
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">{t('dashboard.github.repositoryLabel')}</label>
              <input
                type="text"
                value={repo}
                onChange={e => setRepo(e.target.value)}
                placeholder="my-app"
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('dashboard.github.defaultBranchLabel')}</label>
            <input
              type="text"
              value={branch}
              onChange={e => setBranch(e.target.value)}
              placeholder="main"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('dashboard.github.tokenLabel')}</label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('dashboard.github.tokenHint')}
            </p>
          </div>
        </div>

        <ModalFooter>
          <button
            onClick={() => setShowAddModal(false)}
            className="px-4 py-2 text-foreground bg-muted rounded-lg hover:bg-muted/70 transition-colors"
          >
            {t('dashboard.github.cancel')}
          </button>
          <button
            onClick={handleAdd}
            disabled={saving || !owner.trim() || !repo.trim() || !token.trim()}
            className="px-4 py-2 bg-sky-600 text-foreground rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50"
          >
            {saving ? t('dashboard.github.connecting') : t('dashboard.github.connect')}
          </button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title={t('dashboard.github.disconnectTitle')}
        message={t('dashboard.github.disconnectMessage')}
        confirmText={t('dashboard.github.disconnect')}
        cancelText={t('dashboard.github.cancel')}
        variant="danger"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
};
