import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiFolder, FiGlobe, FiBook } from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Alert } from '../components/common/Alert';
import { Spinner } from '../components/common/Spinner';
import { Modal, ModalFooter } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
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
      setError(err.response?.data?.error || err.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setFormData(initialFormData);
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
      errors.name = 'Project name is required';
    }

    if (formData.website_url && !isValidUrl(formData.website_url)) {
      errors.website_url = 'Please enter a valid URL';
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
        await updateProject(editingProject.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          website_url: formData.website_url.trim() || undefined,
        });
      } else {
        await createProject({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          website_url: formData.website_url.trim() || undefined,
        });
      }
      closeModal();
      fetchProjects();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.project) return;

    try {
      await deleteProject(deleteConfirm.project.id);
      setDeleteConfirm({ isOpen: false, project: null });
      fetchProjects();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete project');
      setDeleteConfirm({ isOpen: false, project: null });
    }
  };

  const handleProjectClick = (project: ProjectWithStats) => {
    navigate(`/projects/${project.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your testing projects and user stories
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <FiPlus className="mr-2" />
          New Project
        </Button>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} />
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FiFolder className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">No projects yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first project.
            </p>
            <div className="mt-6">
              <Button onClick={openCreateModal}>
                <FiPlus className="mr-2" />
                New Project
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleProjectClick(project)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FiFolder className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{project.name}</h3>
                    {project.website_url && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <FiGlobe className="h-3 w-3" />
                        <span className="truncate max-w-[200px]">{project.website_url}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(project);
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <FiEdit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ isOpen: true, project });
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {project.description && (
                <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                  {project.description}
                </p>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <FiBook className="h-4 w-4" />
                  <span>{project.user_story_count} user stories</span>
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
        title={editingProject ? 'Edit Project' : 'Create Project'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Project Name"
            placeholder="Enter project name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
            required
          />
          <Textarea
            label="Description"
            placeholder="Describe your project (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
          <Input
            label="Website URL"
            type="url"
            placeholder="https://example.com (optional)"
            value={formData.website_url}
            onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
            error={formErrors.website_url}
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={closeModal} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={submitting}>
            {editingProject ? 'Save Changes' : 'Create Project'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Project"
        message={`Are you sure you want to delete "${deleteConfirm.project?.name}"? This will also delete all user stories and test cases associated with this project. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, project: null })}
      />
    </div>
  );
};








