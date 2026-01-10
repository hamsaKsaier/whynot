import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiFolder, FiBook } from 'react-icons/fi';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Select } from '../common/Select';
import { Modal, ModalFooter } from '../common/Modal';
import {
  getProjects,
  getUserStories,
  createUserStory,
  ProjectWithStats,
  UserStoryWithStats,
} from '../../services/api';

interface TestInputFormProps {
  onGenerateTests: (
    websiteUrl: string,
    userStory: string,
    projectId?: string,
    userStoryId?: string
  ) => void;
  onRunTest: (
    websiteUrl: string,
    userStory: string,
    headless: boolean,
    projectId?: string,
    userStoryId?: string
  ) => void;
  isLoading?: boolean;
  initialProjectId?: string;
  initialUserStoryId?: string;
  initialWebsiteUrl?: string;
}

export const TestInputForm: React.FC<TestInputFormProps> = ({
  onGenerateTests,
  onRunTest,
  isLoading = false,
  initialProjectId,
  initialUserStoryId,
  initialWebsiteUrl,
}) => {
  const navigate = useNavigate();

  // Project and user story state
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [userStories, setUserStories] = useState<UserStoryWithStats[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '');
  const [selectedUserStoryId, setSelectedUserStoryId] = useState(initialUserStoryId || '');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingUserStories, setLoadingUserStories] = useState(false);

  // Form state
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl || '');
  const [headless, setHeadless] = useState(false);
  const [errors, setErrors] = useState<{
    project?: string;
    userStory?: string;
    websiteUrl?: string;
  }>({});

  // New user story modal
  const [isNewUserStoryModalOpen, setIsNewUserStoryModalOpen] = useState(false);
  const [newUserStoryText, setNewUserStoryText] = useState('');
  const [newUserStoryContext, setNewUserStoryContext] = useState('');
  const [creatingUserStory, setCreatingUserStory] = useState(false);

  // Load projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Load user stories when project changes
  useEffect(() => {
    if (selectedProjectId) {
      fetchUserStories(selectedProjectId);
    } else {
      setUserStories([]);
      setSelectedUserStoryId('');
    }
  }, [selectedProjectId]);

  // Set initial values when provided
  useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
    }
    if (initialUserStoryId) {
      setSelectedUserStoryId(initialUserStoryId);
    }
    if (initialWebsiteUrl) {
      setWebsiteUrl(initialWebsiteUrl);
    }
  }, [initialProjectId, initialUserStoryId, initialWebsiteUrl]);

  // Update website URL when user story changes
  useEffect(() => {
    if (selectedUserStoryId) {
      const userStory = userStories.find((us) => us.id === selectedUserStoryId);
      if (userStory?.website_url) {
        setWebsiteUrl(userStory.website_url);
      } else if (selectedProjectId) {
        const project = projects.find((p) => p.id === selectedProjectId);
        if (project?.website_url) {
          setWebsiteUrl(project.website_url);
        }
      }
    }
  }, [selectedUserStoryId, userStories, selectedProjectId, projects]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await getProjects();
      setProjects(response.projects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchUserStories = async (projectId: string) => {
    setLoadingUserStories(true);
    try {
      const response = await getUserStories(projectId);
      setUserStories(response.user_stories);
    } catch (error) {
      console.error('Failed to fetch user stories:', error);
    } finally {
      setLoadingUserStories(false);
    }
  };

  const validate = () => {
    const newErrors: { project?: string; userStory?: string; websiteUrl?: string } = {};

    if (!selectedProjectId) {
      newErrors.project = 'Please select a project';
    }

    if (!selectedUserStoryId) {
      newErrors.userStory = 'Please select a user story';
    }

    if (!websiteUrl.trim()) {
      newErrors.websiteUrl = 'Website URL is required';
    } else if (!isValidUrl(websiteUrl)) {
      newErrors.websiteUrl = 'Please enter a valid URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const getSelectedUserStoryText = (): string => {
    const userStory = userStories.find((us) => us.id === selectedUserStoryId);
    return userStory?.story || '';
  };

  const handleGenerateTests = () => {
    if (validate()) {
      onGenerateTests(
        websiteUrl.trim(),
        getSelectedUserStoryText(),
        selectedProjectId,
        selectedUserStoryId
      );
    }
  };

  const handleRunTest = () => {
    if (validate()) {
      onRunTest(
        websiteUrl.trim(),
        getSelectedUserStoryText(),
        headless,
        selectedProjectId,
        selectedUserStoryId
      );
    }
  };

  const handleCreateUserStory = async () => {
    if (!selectedProjectId || !newUserStoryText.trim()) return;

    setCreatingUserStory(true);
    try {
      const response = await createUserStory(selectedProjectId, {
        story: newUserStoryText.trim(),
        website_url: websiteUrl.trim() || undefined,
        additional_context: newUserStoryContext.trim() || undefined,
      });

      // Refresh user stories and select the new one
      await fetchUserStories(selectedProjectId);
      setSelectedUserStoryId(response.user_story.id);

      // Close modal and reset form
      setIsNewUserStoryModalOpen(false);
      setNewUserStoryText('');
      setNewUserStoryContext('');
    } catch (error) {
      console.error('Failed to create user story:', error);
    } finally {
      setCreatingUserStory(false);
    }
  };

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: `${p.name}${p.user_story_count ? ` (${p.user_story_count} stories)` : ''}`,
  }));

  const userStoryOptions = userStories.map((us) => ({
    value: us.id,
    label: us.story.length > 80 ? `${us.story.substring(0, 80)}...` : us.story,
  }));

  return (
    <>
      <Card title="Create Test" className="mb-6">
        <div className="space-y-4">
          {/* Project Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Project <span className="text-red-500">*</span>
              </label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/projects')}
                className="text-xs"
              >
                <FiFolder className="mr-1 h-3 w-3" />
                Manage Projects
              </Button>
            </div>
            <Select
              options={projectOptions}
              value={selectedProjectId}
              onChange={(value) => {
                setSelectedProjectId(value);
                setSelectedUserStoryId('');
              }}
              placeholder={loadingProjects ? 'Loading projects...' : 'Select a project'}
              error={errors.project}
              disabled={isLoading || loadingProjects}
            />
            {projects.length === 0 && !loadingProjects && (
              <p className="mt-1 text-sm text-gray-500">
                No projects found.{' '}
                <button
                  onClick={() => navigate('/projects')}
                  className="text-primary-600 hover:underline"
                >
                  Create one
                </button>
              </p>
            )}
          </div>

          {/* User Story Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                User Story <span className="text-red-500">*</span>
              </label>
              {selectedProjectId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsNewUserStoryModalOpen(true)}
                  className="text-xs"
                  disabled={!selectedProjectId}
                >
                  <FiPlus className="mr-1 h-3 w-3" />
                  New Story
                </Button>
              )}
            </div>
            <Select
              options={userStoryOptions}
              value={selectedUserStoryId}
              onChange={setSelectedUserStoryId}
              placeholder={
                !selectedProjectId
                  ? 'Select a project first'
                  : loadingUserStories
                    ? 'Loading user stories...'
                    : 'Select a user story'
              }
              error={errors.userStory}
              disabled={isLoading || !selectedProjectId || loadingUserStories}
            />
            {selectedProjectId && userStories.length === 0 && !loadingUserStories && (
              <p className="mt-1 text-sm text-gray-500">
                No user stories in this project.{' '}
                <button
                  onClick={() => setIsNewUserStoryModalOpen(true)}
                  className="text-primary-600 hover:underline"
                >
                  Add one
                </button>
              </p>
            )}
          </div>

          {/* Selected User Story Preview */}
          {selectedUserStoryId && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-2">
                <FiBook className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-green-800">{getSelectedUserStoryText()}</p>
              </div>
            </div>
          )}

          {/* Website URL */}
          <Input
            label="Website URL"
            type="url"
            placeholder="https://example.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            error={errors.websiteUrl}
            disabled={isLoading}
            required
          />

          {/* Headless Mode */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="headless"
              checked={headless}
              onChange={(e) => setHeadless(e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="headless" className="ml-2 text-sm text-gray-700">
              Run in headless mode (no live preview)
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleGenerateTests}
              disabled={isLoading}
              variant="secondary"
            >
              Generate Tests
            </Button>
            <Button onClick={handleRunTest} disabled={isLoading} isLoading={isLoading}>
              Run Test
            </Button>
          </div>
        </div>
      </Card>

      {/* New User Story Modal */}
      <Modal
        isOpen={isNewUserStoryModalOpen}
        onClose={() => setIsNewUserStoryModalOpen(false)}
        title="Add User Story"
        size="lg"
      >
        <div className="space-y-4">
          <Textarea
            label="User Story"
            placeholder="As a user, I want to..."
            value={newUserStoryText}
            onChange={(e) => setNewUserStoryText(e.target.value)}
            rows={4}
            required
          />
          <Textarea
            label="Additional Context"
            placeholder="Any additional requirements or context (optional)"
            value={newUserStoryContext}
            onChange={(e) => setNewUserStoryContext(e.target.value)}
            rows={2}
          />
        </div>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setIsNewUserStoryModalOpen(false)}
            disabled={creatingUserStory}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateUserStory}
            isLoading={creatingUserStory}
            disabled={!newUserStoryText.trim()}
          >
            Add User Story
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};
