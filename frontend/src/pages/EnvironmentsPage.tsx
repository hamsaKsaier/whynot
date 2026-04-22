import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit, FiTrash2, FiServer, FiZap, FiExternalLink } from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { SkeletonCard } from '../components/common/SkeletonCard';
import { EmptyState } from '../components/common/EmptyState';
import { useToastContext } from '../contexts/ToastContext';
import {
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  type SavedEnvironment,
} from '../services/api';

export const EnvironmentsContent: React.FC = () => <EnvironmentsPage embedded />;

export const EnvironmentsPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();

  const [environments, setEnvironments] = useState<SavedEnvironment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEnv, setEditingEnv] = useState<SavedEnvironment | null>(null);
  const [formData, setFormData] = useState({ name: '', url: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<SavedEnvironment | null>(null);

  const fetchEnvironments = useCallback(async () => {
    try {
      const { environments: envs } = await getEnvironments();
      setEnvironments(envs);
    } catch (err: any) {
      showError(err.response?.data?.error || err.message || t('dashboard.environments.loadError'));
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const openCreateModal = () => {
    setEditingEnv(null);
    setFormData({ name: '', url: '', description: '' });
    setModalOpen(true);
  };

  const openEditModal = (env: SavedEnvironment) => {
    setEditingEnv(env);
    setFormData({ name: env.name, url: env.url, description: env.description || '' });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.url) return;

    setSaving(true);
    try {
      if (editingEnv) {
        const { environment } = await updateEnvironment(editingEnv.id, formData);
        setEnvironments(prev => prev.map(e => e.id === editingEnv.id ? environment : e));
        success(t('dashboard.environments.updated'));
      } else {
        const { environment } = await createEnvironment(formData);
        setEnvironments(prev => [...prev, environment]);
        success(t('dashboard.environments.created'));
      }
      setModalOpen(false);
    } catch (err: any) {
      showError(err.response?.data?.error || err.message || t('dashboard.environments.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEnvironment(deleteTarget.id);
      setEnvironments(prev => prev.filter(e => e.id !== deleteTarget.id));
      success(t('dashboard.environments.deleted'));
    } catch (err: any) {
      showError(err.response?.data?.error || err.message || t('dashboard.environments.deleteError'));
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleUseInQALoop = (env: SavedEnvironment) => {
    navigate('/qa-loop', { state: { websiteUrl: env.url } });
  };

  return (
    <div>
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('dashboard.environments.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('dashboard.environments.subtitle')}</p>
          </div>
          <Button onClick={openCreateModal} className="flex w-full sm:w-auto items-center justify-center gap-2">
            <FiPlus className="h-4 w-4" />
            <span>{t('dashboard.environments.new')}</span>
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard count={3} />
        </div>
      ) : environments.length === 0 ? (
        <Card className="py-14 px-8">
          <EmptyState
            icon={<FiServer />}
            title={t('dashboard.environments.emptyTitle')}
            description={t('dashboard.environments.emptyDescription')}
            action={
              <div className="flex gap-3">
                <Button onClick={openCreateModal}>
                  <FiPlus className="me-2 h-4 w-4" />
                  {t('dashboard.environments.add')}
                </Button>
                <Button variant="secondary" onClick={() => navigate('/qa-loop')}>
                  <FiZap className="me-2 h-4 w-4" />
                  {t('dashboard.environments.skipToQaLoop')}
                </Button>
              </div>
            }
            tip={t('dashboard.environments.tip')}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {environments.map((env) => (
            <Card key={env.id} className="p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-foreground min-w-0 truncate">{env.name}</h3>
                <div className="flex items-center flex-shrink-0">
                  <button
                    onClick={() => handleUseInQALoop(env)}
                    className="p-2 rounded hover:bg-green-900/20 transition-colors"
                    title={t('dashboard.environments.useInQaLoop')}
                  >
                    <FiZap className="h-4 w-4 text-green-600" />
                  </button>
                  <a
                    href={env.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded hover:bg-muted transition-colors"
                    title={t('dashboard.environments.openUrl')}
                  >
                    <FiExternalLink className="h-4 w-4 text-muted-foreground rtl:scale-x-[-1]" />
                  </a>
                  <button
                    onClick={() => openEditModal(env)}
                    className="p-2 rounded hover:bg-muted transition-colors"
                    title={t('dashboard.environments.edit')}
                  >
                    <FiEdit className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(env)}
                    className="p-2 rounded hover:bg-red-900/20 transition-colors"
                    title={t('dashboard.environments.delete')}
                  >
                    <FiTrash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-primary-600 mb-2 truncate">{env.url}</p>
              {env.description && (
                <p className="text-xs text-muted-foreground">{env.description}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEnv ? t('dashboard.environments.editTitle') : t('dashboard.environments.newTitle')}
        size="sm"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('dashboard.environments.nameLabel')}
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('dashboard.environments.namePlaceholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('dashboard.environments.urlLabel')}
            </label>
            <Input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('dashboard.environments.descriptionLabel')}
            </label>
            <Input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('dashboard.environments.descriptionPlaceholder')}
            />
          </div>
          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              {t('dashboard.environments.cancel')}
            </Button>
            <Button type="submit" disabled={saving || !formData.name || !formData.url}>
              {saving ? t('dashboard.environments.saving') : editingEnv ? t('dashboard.environments.update') : t('dashboard.environments.create')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('dashboard.environments.deleteTitle')}
        message={t('dashboard.environments.deleteConfirm', { name: deleteTarget?.name })}
        confirmText={t('dashboard.environments.delete')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
};
