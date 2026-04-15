import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiEdit2, FiTrash2, FiFolder, FiGlobe, FiBook, FiCopy } from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Alert } from '../components/common/Alert';
import { SkeletonCard } from '../components/common/SkeletonCard';
import { Modal, ModalFooter } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { QuickActions } from '../components/common/QuickActions';
import { useToastContext } from '../contexts/ToastContext';
import { useClipboard } from '../hooks/useClipboard';
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';
import { useFormAutoSave } from '../hooks/useFormAutoSave';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  ProjectWithStats,
} from '../services/api';

interface ProjectFormData {
  name: string;
  description: string;
  website_url: string;
}

const initialFormData: ProjectFormData = {
  name: '',
  description: '',
  website_url: '',
};

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');
  const { success, error: showError } = useToastContext();
  const { copyToClipboard } = useClipboard();
  const { optimisticCreate, optimisticUpdate, optimisticDelete } = useOptimisticUpdate<ProjectWithStats>();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithStats | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<ProjectFormData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    project: ProjectWithStats | null;
  }>({ isOpen: false, project: null });

  // Auto-save form data
  const { loadDraft, clearDraft, hasDraft } = useFormAutoSave(
    editingProject ? `project-edit-${editingProject.id}` : 'project-create',
    formData,
    {
      enabled: isModalOpen,
      onRestore: (data) => {
        setFormData(data);
      },
    }
  );

  // Check for draft when modal opens
  useEffect(() => {
    if (isModalOpen && hasDraft() && !editingProject) {
    }
  }, [isModalOpen, hasDraft, editingProject]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getProjects();
      setProjects(response.projects);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || t('dashboard.projects.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingProject(null);
    // Try to load draft first
    const draft = loadDraft();
    if (draft) {
      setFormData(draft);
    } else {
      setFormData(initialFormData);
    }
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (project: ProjectWithStats) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      website_url: project.website_url || '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Partial<ProjectFormData> = {};

    if (!formData.name.trim()) {
      errors.name = t('dashboard.projects.nameRequired');
    }

    if (formData.website_url && !isValidUrl(formData.website_url)) {
      errors.website_url = t('dashboard.projects.invalidUrl');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (editingProject) {
        const optimisticProject: ProjectWithStats = {
          ...editingProject,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          website_url: formData.website_url.trim() || undefined,
        };
        
        const updatedProjects = await optimisticUpdate(
          projects,
          optimisticProject,
          () => updateProject(editingProject.id, {
            name: formData.name.trim(),
            description: formData.description.trim() || undefined,
            website_url: formData.website_url.trim() || undefined,
          }).then(res => ({ ...res.project, user_story_count: editingProject.user_story_count })),
          {
            successMessage: t('dashboard.projects.updateSuccess'),
            errorMessage: t('dashboard.projects.updateError'),
          }
        );
        setProjects(updatedProjects);
      } else {
        const tempId = `temp-${Date.now()}`;
        const optimisticProject: ProjectWithStats = {
          id: tempId,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          website_url: formData.website_url.trim() || undefined,
          user_story_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        const updatedProjects = await optimisticCreate(
          projects,
          optimisticProject,
          () => createProject({
            name: formData.name.trim(),
            description: formData.description.trim() || undefined,
            website_url: formData.website_url.trim() || undefined,
          }).then(res => ({ ...res.project, user_story_count: 0 })),
          {
            successMessage: t('dashboard.projects.createSuccess'),
            errorMessage: t('dashboard.projects.createError'),
          }
        );
        setProjects(updatedProjects);
      }
      clearDraft(); // Clear draft on successful submission
      closeModal();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || t('dashboard.projects.saveError');
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.project) return;

    try {
      await deleteProject(deleteConfirm.project.id);
      success(t('dashboard.projects.deleteSuccess'));
      setDeleteConfirm({ isOpen: false, project: null });
      fetchProjects();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || t('dashboard.projects.deleteError');
      setError(errorMessage);
      showError(errorMessage);
      setDeleteConfirm({ isOpen: false, project: null });
    }
  };

  const handleProjectClick = (project: ProjectWithStats) => {
    navigate(`/projects/${project.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SkeletonLoader width="w-48" height="h-8" className="mb-2" />
            <SkeletonLoader width="w-64" height="h-4" />
          </div>
          <SkeletonLoader width="w-32" height="h-10" />
        </div>
        <div className="card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <SkeletonCard count={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">{t('dashboard.projects.title')}</h1>
          <p className="page-subtitle">
            {t('dashboard.projects.subtitle')}
          </p>
        </div>
        <Button onClick={openCreateModal} className="w-full sm:w-auto">
          <FiPlus className="me-2" />
          {t('dashboard.projects.create')}
        </Button>
      </div>

      {error && (
        <Alert
          type="error"
          title={t('dashboard.projects.errorTitle')}
          message={error}
          suggestions={[
            t('dashboard.projects.suggestionNetwork'),
            t('dashboard.projects.suggestionServices'),
            t('dashboard.projects.suggestionRefresh'),
          ]}
          actions={[
            {
              label: t('dashboard.projects.retry'),
              onClick: () => {
                setError(null);
                fetchProjects();
              },
              variant: 'primary',
            },
            {
              label: t('dashboard.projects.dismiss'),
              onClick: () => setError(null),
              variant: 'secondary',
            },
          ]}
          onClose={() => setError(null)}
        />
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FiFolder />}
            title={t('dashboard.projects.empty.title')}
            description={t('dashboard.projects.empty.description')}
            action={
              <Button onClick={openCreateModal}>
                <FiPlus className="me-2" />
                {t('dashboard.projects.empty.action')}
              </Button>
            }
            tip={t('dashboard.projects.empty.tip')}
          />
        </Card>
      ) : (
        <div className="card-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              hoverable
              clickable
              onClick={() => handleProjectClick(project)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-900/30 rounded-lg">
                    <FiFolder className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{project.name}</h3>
                    {project.website_url && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <FiGlobe className="h-3 w-3" />
                        <span className="truncate max-w-[150px] sm:max-w-[200px]">{project.website_url}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <QuickActions
                    actions={[
                      {
                        label: t('dashboard.projects.copyId'),
                        icon: <FiCopy className="h-4 w-4" />,
                        onClick: () => {
                          copyToClipboard(project.id, {
                            successMessage: t('dashboard.projects.idCopied'),
                          });
                        },
                      },
                      {
                        label: t('dashboard.projects.edit'),
                        icon: <FiEdit2 className="h-4 w-4" />,
                        onClick: () => openEditModal(project),
                      },
                      {
                        label: t('dashboard.projects.delete'),
                        icon: <FiTrash2 className="h-4 w-4" />,
                        onClick: () => setDeleteConfirm({ isOpen: true, project }),
                        variant: 'danger',
                      },
                    ]}
                    position="bottom-right"
                  />
                </div>
              </div>

              {project.description && (
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FiBook className="h-4 w-4" />
                  <span>{t('dashboard.projects.userStories', { count: project.user_story_count })}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProject ? t('dashboard.projects.editTitle') : t('dashboard.projects.createTitle')}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label={t('dashboard.projects.form.nameLabel')}
            placeholder={t('dashboard.projects.form.namePlaceholder')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
            required
          />
          <Textarea
            label={t('dashboard.projects.form.descriptionLabel')}
            placeholder={t('dashboard.projects.form.descriptionPlaceholder')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
          <Input
            label={t('dashboard.projects.form.urlLabel')}
            type="url"
            placeholder={t('dashboard.projects.form.urlPlaceholder')}
            value={formData.website_url}
            onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
            error={formErrors.website_url}
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={closeModal} disabled={submitting}>
            {t('dashboard.projects.cancel')}
          </Button>
          <Button onClick={handleSubmit} isLoading={submitting}>
            {editingProject ? t('dashboard.projects.saveChanges') : t('dashboard.projects.createTitle')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={t('dashboard.projects.deleteTitle')}
        message={t('dashboard.projects.deleteConfirm', { name: deleteConfirm.project?.name })}
        confirmText={t('dashboard.projects.delete')}
        cancelText={t('dashboard.projects.cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, project: null })}
      />
    </div>
  );
};





