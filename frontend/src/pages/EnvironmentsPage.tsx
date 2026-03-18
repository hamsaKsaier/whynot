import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
      showError(err.response?.data?.error || err.message || 'Failed to load environments');
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
        success('Environment updated');
      } else {
        const { environment } = await createEnvironment(formData);
        setEnvironments(prev => [...prev, environment]);
        success('Environment created');
      }
      setModalOpen(false);
    } catch (err: any) {
      showError(err.response?.data?.error || err.message || 'Failed to save environment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEnvironment(deleteTarget.id);
      setEnvironments(prev => prev.filter(e => e.id !== deleteTarget.id));
      success('Environment deleted');
    } catch (err: any) {
      showError(err.response?.data?.error || err.message || 'Failed to delete environment');
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Environments</h1>
            <p className="text-gray-600 mt-1">Manage test environments and URLs</p>
          </div>
          <Button onClick={openCreateModal} className="flex items-center space-x-2">
            <FiPlus className="h-4 w-4" />
            <span>New Environment</span>
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard count={3} />
        </div>
      ) : environments.length === 0 ? (
        <Card className="py-14 px-8">
          <EmptyState
            icon={<FiServer />}
            title="No environments yet"
            description="Environments let you save base URLs for different deployment stages — Production, Staging, Local — so the QA Loop can test across your pipeline without re-typing URLs every time."
            action={
              <div className="flex gap-3">
                <Button onClick={openCreateModal}>
                  <FiPlus className="mr-2 h-4 w-4" />
                  Add Environment
                </Button>
                <Button variant="secondary" onClick={() => navigate('/qa-loop')}>
                  <FiZap className="mr-2 h-4 w-4" />
                  Skip — go to QA Loop
                </Button>
              </div>
            }
            tip="Environments are optional. You can always paste a URL directly into QA Loop."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {environments.map((env) => (
            <Card key={env.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{env.name}</h3>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleUseInQALoop(env)}
                    className="p-1.5 rounded hover:bg-green-50 transition-colors"
                    title="Use in QA Loop"
                  >
                    <FiZap className="h-4 w-4 text-green-600" />
                  </button>
                  <a
                    href={env.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                    title="Open URL"
                  >
                    <FiExternalLink className="h-4 w-4 text-gray-500" />
                  </a>
                  <button
                    onClick={() => openEditModal(env)}
                    className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                    title="Edit"
                  >
                    <FiEdit className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(env)}
                    className="p-1.5 rounded hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <FiTrash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-primary-600 mb-2 break-all truncate">{env.url}</p>
              {env.description && (
                <p className="text-xs text-gray-500">{env.description}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEnv ? 'Edit Environment' : 'New Environment'}
        size="sm"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Environment Name
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Production, Staging"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base URL
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>
          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !formData.name || !formData.url}>
              {saving ? 'Saving…' : editingEnv ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Environment"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  );
};
