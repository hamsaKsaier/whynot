import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiBook,
  FiPlay,
  FiGlobe,
  FiFolder,
} from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Alert } from '../components/common/Alert';
import { Spinner } from '../components/common/Spinner';
import { Modal, ModalFooter } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import {
  getProject,
  updateProject,
  getUserStories,
  createUserStory,
  updateUserStory,
  deleteUserStory,
  getFolders,
  assignUserStoryToFolder,
  ProjectWithStats,
  UserStoryWithStats,
  FolderWithStats,
} from '../services/api';
import { Select } from '../components/common/Select';

interface UserStoryFormData {
  story: string;
  website_url: string;
  additional_context: string;
}

const initialUserStoryFormData: UserStoryFormData = {
  story: '',
  website_url: '',
  additional_context: '',
};

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [userStories, setUserStories] = useState<UserStoryWithStats[]>([]);
  const [folders, setFolders] = useState<FolderWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Project edit state
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectWebsiteUrl, setProjectWebsiteUrl] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  // User story modal state
  const [isUserStoryModalOpen, setIsUserStoryModalOpen] = useState(false);
  const [editingUserStory, setEditingUserStory] = useState<UserStoryWithStats | null>(null);
  const [userStoryFormData, setUserStoryFormData] = useState<UserStoryFormData>(
    initialUserStoryFormData
  );
  const [userStoryFormErrors, setUserStoryFormErrors] = useState<Partial<UserStoryFormData>>({});
  const [submittingUserStory, setSubmittingUserStory] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    userStory: UserStoryWithStats | null;
  }>({ isOpen: false, userStory: null });

  useEffect(() => {
    if (id) {
      fetchProjectData();
    }
  }, [id]);

  const fetchProjectData = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const [projectResponse, userStoriesResponse, foldersResponse] = await Promise.all([
        getProject(id),
        getUserStories(id),
        getFolders(id).catch(() => ({ folders: [] })), // Folders may not exist yet
      ]);
      setProject(projectResponse.project);
      setUserStories(userStoriesResponse.user_stories);
      setFolders(foldersResponse.folders || []);

      // Initialize edit form
      setProjectName(projectResponse.project.name);
      setProjectDescription(projectResponse.project.description || '');
      setProjectWebsiteUrl(projectResponse.project.website_url || '');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch project');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignFolder = async (userStoryId: string, folderId: string | null) => {
    try {
      await assignUserStoryToFolder(userStoryId, folderId);
      // Refresh user stories to get updated folder_id
      if (id) {
        const userStoriesResponse = await getUserStories(id);
        setUserStories(userStoriesResponse.user_stories);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to assign folder');
    }
  };

  const handleSaveProject = async () => {
    if (!id || !projectName.trim()) return;

    setSavingProject(true);
    try {
      const response = await updateProject(id, {
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
        website_url: projectWebsiteUrl.trim() || undefined,
      });
      setProject({ ...project!, ...response.project });
      setIsEditingProject(false);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update project');
    } finally {
      setSavingProject(false);
    }
  };

  const cancelEditProject = () => {
    if (project) {
      setProjectName(project.name);
      setProjectDescription(project.description || '');
      setProjectWebsiteUrl(project.website_url || '');
    }
    setIsEditingProject(false);
  };

  const openCreateUserStoryModal = () => {
    setEditingUserStory(null);
    setUserStoryFormData({
      ...initialUserStoryFormData,
      website_url: project?.website_url || '',
    });
    setUserStoryFormErrors({});
    setIsUserStoryModalOpen(true);
  };

  const openEditUserStoryModal = (userStory: UserStoryWithStats) => {
    setEditingUserStory(userStory);
    setUserStoryFormData({
      story: userStory.story,
      website_url: userStory.website_url || '',
      additional_context: userStory.additional_context || '',
    });
    setUserStoryFormErrors({});
    setIsUserStoryModalOpen(true);
  };

  const closeUserStoryModal = () => {
    setIsUserStoryModalOpen(false);
    setEditingUserStory(null);
    setUserStoryFormData(initialUserStoryFormData);
    setUserStoryFormErrors({});
  };

  const validateUserStoryForm = (): boolean => {
    const errors: Partial<UserStoryFormData> = {};

    if (!userStoryFormData.story.trim()) {
      errors.story = 'User story is required';
    } else if (userStoryFormData.story.trim().length < 10) {
      errors.story = 'User story must be at least 10 characters';
    }

    if (userStoryFormData.website_url && !isValidUrl(userStoryFormData.website_url)) {
      errors.website_url = 'Please enter a valid URL';
    }

    setUserStoryFormErrors(errors);
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

  const handleSubmitUserStory = async () => {
    if (!id || !validateUserStoryForm()) return;

    setSubmittingUserStory(true);
    try {
      if (editingUserStory) {
        await updateUserStory(editingUserStory.id, {
          story: userStoryFormData.story.trim(),
          website_url: userStoryFormData.website_url.trim() || undefined,
          additional_context: userStoryFormData.additional_context.trim() || undefined,
        });
      } else {
        await createUserStory(id, {
          story: userStoryFormData.story.trim(),
          website_url: userStoryFormData.website_url.trim() || undefined,
          additional_context: userStoryFormData.additional_context.trim() || undefined,
        });
      }
      closeUserStoryModal();
      fetchProjectData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save user story');
    } finally {
      setSubmittingUserStory(false);
    }
  };

  const handleDeleteUserStory = async () => {
    if (!deleteConfirm.userStory) return;

    try {
      await deleteUserStory(deleteConfirm.userStory.id);
      setDeleteConfirm({ isOpen: false, userStory: null });
      fetchProjectData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete user story');
      setDeleteConfirm({ isOpen: false, userStory: null });
    }
  };

  const handleGenerateTests = (userStory: UserStoryWithStats) => {
    // Navigate to home page with pre-selected project and user story
    navigate('/', {
      state: {
        projectId: id,
        userStoryId: userStory.id,
        websiteUrl: userStory.website_url || project?.website_url,
        userStoryText: userStory.story,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Project not found</h2>
        <Button className="mt-4" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
        >
          <FiArrowLeft className="h-4 w-4" />
          Projects
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 font-medium">{project.name}</span>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Project Header */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FiFolder className="h-8 w-8 text-blue-600" />
            </div>
            {isEditingProject ? (
              <div className="space-y-3 flex-1">
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name"
                  className="max-w-md"
                />
                <Textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="max-w-md"
                />
                <Input
                  value={projectWebsiteUrl}
                  onChange={(e) => setProjectWebsiteUrl(e.target.value)}
                  placeholder="Website URL (optional)"
                  type="url"
                  className="max-w-md"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveProject} isLoading={savingProject}>
                    Save
                  </Button>
                  <Button size="sm" variant="secondary" onClick={cancelEditProject}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                {project.description && (
                  <p className="mt-1 text-gray-600">{project.description}</p>
                )}
                {project.website_url && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                    <FiGlobe className="h-4 w-4" />
                    <a
                      href={project.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary-600"
                    >
                      {project.website_url}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
          {!isEditingProject && (
            <Button variant="secondary" size="sm" onClick={() => setIsEditingProject(true)}>
              <FiEdit2 className="mr-1" />
              Edit
            </Button>
          )}
        </div>
      </Card>

      {/* User Stories Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            User Stories ({userStories.length})
          </h2>
          <Button size="sm" onClick={openCreateUserStoryModal}>
            <FiPlus className="mr-1" />
            Add User Story
          </Button>
        </div>

        {userStories.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <FiBook className="mx-auto h-10 w-10 text-gray-400" />
              <h3 className="mt-2 text-md font-medium text-gray-900">No user stories yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add user stories to generate test cases for this project.
              </p>
              <div className="mt-4">
                <Button size="sm" onClick={openCreateUserStoryModal}>
                  <FiPlus className="mr-1" />
                  Add User Story
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {userStories.map((userStory) => (
              <Card key={userStory.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-100 rounded-lg mt-0.5">
                        <FiBook className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900">{userStory.story}</p>
                        {userStory.website_url && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                            <FiGlobe className="h-3 w-3" />
                            <span>{userStory.website_url}</span>
                          </div>
                        )}
                        {userStory.additional_context && (
                          <p className="mt-2 text-sm text-gray-500 italic">
                            {userStory.additional_context}
                          </p>
                        )}
                        <div className="mt-2 text-xs text-gray-400">
                          {userStory.test_case_count} test cases
                        </div>
                        {folders.length > 0 && (
                          <div className="mt-3">
                            <Select
                              label="Folder"
                              value={(userStory as any).folder_id || ''}
                              onChange={(value) => handleAssignFolder(userStory.id, value || null)}
                              options={[
                                { value: '', label: 'No folder' },
                                ...folders.map(f => ({ value: f.id, label: f.name }))
                              ]}
                              className="max-w-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleGenerateTests(userStory)}>
                      <FiPlay className="mr-1" />
                      Generate Tests
                    </Button>
                    <button
                      onClick={() => openEditUserStoryModal(userStory)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ isOpen: true, userStory })}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* User Story Modal */}
      <Modal
        isOpen={isUserStoryModalOpen}
        onClose={closeUserStoryModal}
        title={editingUserStory ? 'Edit User Story' : 'Add User Story'}
        size="lg"
      >
        <div className="space-y-4">
          <Textarea
            label="User Story"
            placeholder="As a user, I want to..."
            value={userStoryFormData.story}
            onChange={(e) =>
              setUserStoryFormData({ ...userStoryFormData, story: e.target.value })
            }
            error={userStoryFormErrors.story}
            rows={4}
            required
          />
          <Input
            label="Website URL"
            type="url"
            placeholder={project?.website_url || 'https://example.com'}
            value={userStoryFormData.website_url}
            onChange={(e) =>
              setUserStoryFormData({ ...userStoryFormData, website_url: e.target.value })
            }
            error={userStoryFormErrors.website_url}
          />
          <Textarea
            label="Additional Context"
            placeholder="Any additional context or requirements (optional)"
            value={userStoryFormData.additional_context}
            onChange={(e) =>
              setUserStoryFormData({
                ...userStoryFormData,
                additional_context: e.target.value,
              })
            }
            rows={2}
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={closeUserStoryModal} disabled={submittingUserStory}>
            Cancel
          </Button>
          <Button onClick={handleSubmitUserStory} isLoading={submittingUserStory}>
            {editingUserStory ? 'Save Changes' : 'Add User Story'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete User Story"
        message="Are you sure you want to delete this user story? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeleteUserStory}
        onCancel={() => setDeleteConfirm({ isOpen: false, userStory: null })}
      />
    </div>
  );
};








