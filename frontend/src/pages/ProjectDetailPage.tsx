import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiBook,
  FiZap,
  FiGlobe,
  FiFolder,
  FiCopy,
  FiGitBranch,
} from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Alert } from '../components/common/Alert';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { Modal, ModalFooter } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { QuickActions } from '../components/common/QuickActions';
import { useClipboard } from '../hooks/useClipboard';
import { useFormAutoSave } from '../hooks/useFormAutoSave';
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
import { listQALoopSessions, QALoopSession } from '../services/qa-loop-api';

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
  const { copyToClipboard } = useClipboard();

  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [userStories, setUserStories] = useState<UserStoryWithStats[]>([]);
  const [folders, setFolders] = useState<FolderWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qaLoopSessions, setQALoopSessions] = useState<QALoopSession[]>([]);

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
  // Auto-save user story form data
  const { loadDraft, clearDraft, hasDraft } = useFormAutoSave(
    editingUserStory ? `user-story-edit-${editingUserStory.id}` : `user-story-create-${id}`,
    userStoryFormData,
    {
      enabled: isUserStoryModalOpen,
      onRestore: (data: UserStoryFormData) => {
        setUserStoryFormData(data);
      },
    }
  );

  // Check for draft when modal opens
  useEffect(() => {
    if (isUserStoryModalOpen && hasDraft() && !editingUserStory) {
    }
  }, [isUserStoryModalOpen, hasDraft, editingUserStory]);

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
      const [projectResponse, userStoriesResponse, foldersResponse, qaSessionsResponse] = await Promise.all([
        getProject(id),
        getUserStories(id),
        getFolders(id).catch(() => ({ folders: [] })), // Folders may not exist yet
        listQALoopSessions({ projectId: id, limit: 5 }).catch(() => ({ sessions: [], total: 0 })),
      ]);
      setProject(projectResponse.project);
      setUserStories(userStoriesResponse.user_stories);
      setFolders(foldersResponse.folders || []);
      setQALoopSessions(qaSessionsResponse.sessions || []);

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
    // Try to load draft first
    const draft = loadDraft();
    if (draft) {
      setUserStoryFormData(draft);
    } else {
      setUserStoryFormData({
        ...initialUserStoryFormData,
        website_url: project?.website_url || '',
      });
    }
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
      clearDraft(); // Clear draft on successful submission
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

  const handleStartQASession = (userStory?: UserStoryWithStats) => {
    navigate('/qa-loop', {
      state: {
        projectId: id,
        websiteUrl: userStory?.website_url || project?.website_url,
        userStoryContext: userStory?.story,
      },
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader width="w-32" height="h-4" className="mb-4" />
        <Card>
          <div className="flex items-start gap-4">
            <SkeletonLoader width="w-16" height="h-16" circle={true} />
            <div className="flex-1 space-y-3">
              <SkeletonLoader width="w-48" height="h-8" />
              <SkeletonLoader width="w-full" height="h-4" />
              <SkeletonLoader width="w-64" height="h-4" />
            </div>
          </div>
        </Card>
        <div className="page-section">
          <SkeletonLoader width="w-40" height="h-6" className="mb-4" />
          <div className="space-y-3">
            <SkeletonLoader width="w-full" height="h-20" />
            <SkeletonLoader width="w-full" height="h-20" />
          </div>
        </div>
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
      <Breadcrumbs
        items={[
          { label: 'Projects', path: '/projects', icon: <FiFolder className="h-4 w-4" /> },
          { label: project.name },
        ]}
      />

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
            <div className="flex gap-2">
              <Button onClick={() => handleStartQASession()}>
                <FiZap className="mr-1" />
                Start QA Session
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/architecture-flow')}>
                <FiGitBranch className="mr-1" />
                Architecture
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsEditingProject(true)}>
                <FiEdit2 className="mr-1" />
                Edit
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* User Stories Section */}
      <div className="page-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">
            User Stories ({userStories.length})
          </h2>
          <Button size="sm" onClick={openCreateUserStoryModal}>
            <FiPlus className="mr-1" />
            Add User Story
          </Button>
        </div>

        {userStories.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FiBook />}
              title="No user stories yet"
              description="Add user stories to generate test cases for this project"
              action={
                <Button size="sm" onClick={openCreateUserStoryModal}>
                  <FiPlus className="mr-1" />
                  Add User Story
                </Button>
              }
              tip="Tip: User stories describe what users want to accomplish, and WhyNot will generate test cases from them"
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {userStories.map((userStory) => (
              <Card key={userStory.id} hoverable>
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
                    <Button size="sm" onClick={() => handleStartQASession(userStory)}>
                      <FiZap className="mr-1" />
                      Start QA Session
                    </Button>
                    <QuickActions
                      actions={[
                        {
                          label: 'Copy User Story ID',
                          icon: <FiCopy className="h-4 w-4" />,
                          onClick: () => {
                            copyToClipboard(userStory.id, {
                              successMessage: 'User story ID copied to clipboard',
                            });
                          },
                        },
                        {
                          label: 'Edit',
                          icon: <FiEdit2 className="h-4 w-4" />,
                          onClick: () => openEditUserStoryModal(userStory),
                        },
                        {
                          label: 'Delete',
                          icon: <FiTrash2 className="h-4 w-4" />,
                          onClick: () => setDeleteConfirm({ isOpen: true, userStory }),
                          variant: 'danger',
                        },
                      ]}
                      position="bottom-right"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent QA Sessions */}
      {qaLoopSessions.length > 0 && (
        <div className="page-section">
          <h2 className="section-title mb-4">Recent QA Sessions ({qaLoopSessions.length})</h2>
          <div className="space-y-3">
            {qaLoopSessions.map((session) => (
              <Card key={session.id} hoverable clickable onClick={() => navigate('/qa-loop')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FiZap className={`h-5 w-5 ${
                      session.status === 'running' ? 'text-blue-500' :
                      session.status === 'completed' ? 'text-green-500' :
                      session.status === 'paused' ? 'text-yellow-500' :
                      'text-gray-400'
                    }`} />
                    <div>
                      <div className="font-medium text-gray-900 truncate max-w-md">{session.target_url}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {session.pages_explored} pages · {session.tests_generated} tests · {session.bugs_found} bugs
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {session.quality_score > 0 && (
                      <span className="text-sm font-medium text-purple-600">{session.quality_score}%</span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      session.status === 'running' ? 'bg-blue-100 text-blue-700' :
                      session.status === 'completed' ? 'bg-green-100 text-green-700' :
                      session.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{session.status}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

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




