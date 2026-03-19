import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { StepIndicator } from '../common/StepIndicator';
import { TestInputFormStep1 } from './TestInputFormStep1';
import { TestInputFormStep2 } from './TestInputFormStep2';
import { TestInputFormStep3 } from './TestInputFormStep3';
import { useFormAutoSave } from '../../hooks/useFormAutoSave';
import { Modal } from '../common/Modal';
import {
  getProjects,
  getUserStories,
  createUserStory,
  ProjectWithStats,
  UserStoryWithStats,
} from '../../services/api';
import type { PrerequisiteStep } from '../../utils/createEditFlow';

interface TestInputFormProps {
  onGenerateTests: (
    websiteUrl: string,
    userStory: string,
    projectId?: string,
    userStoryId?: string,
    prerequisiteSteps?: PrerequisiteStep[],
    quickMode?: boolean
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

const STEPS = ['Select Project', 'Select User Story', 'Review & Execute'];

export const TestInputForm: React.FC<TestInputFormProps> = ({
  onGenerateTests,
  onRunTest,
  isLoading = false,
  initialProjectId,
  initialUserStoryId,
  initialWebsiteUrl,
}) => {
  const navigate = useNavigate();

  // Step management
  const [currentStep, setCurrentStep] = useState(0);

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
  const [prerequisiteSteps, setPrerequisiteSteps] = useState<PrerequisiteStep[]>([]);
  const [quickMode, setQuickMode] = useState(true);
  const [errors, setErrors] = useState<{
    project?: string;
    userStory?: string;
    websiteUrl?: string;
  }>({});
  const [showDraftRestore, setShowDraftRestore] = useState(false);

  // Auto-save form data
  const formData = {
    selectedProjectId,
    selectedUserStoryId,
    websiteUrl,
    headless,
    currentStep,
  };

  const { loadDraft, clearDraft, hasDraft } = useFormAutoSave('test-input-form', formData, {
    onRestore: (data) => {
      if (data.selectedProjectId) setSelectedProjectId(data.selectedProjectId);
      if (data.selectedUserStoryId) setSelectedUserStoryId(data.selectedUserStoryId);
      if (data.websiteUrl) setWebsiteUrl(data.websiteUrl);
      if (data.headless !== undefined) setHeadless(data.headless);
      if (data.currentStep !== undefined) setCurrentStep(data.currentStep);
    },
  });

  // Check for draft on mount
  useEffect(() => {
    if (hasDraft() && !initialProjectId && !initialUserStoryId) {
      setShowDraftRestore(true);
    }
  }, [hasDraft, initialProjectId, initialUserStoryId]);

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

  const validateStep = (step: number): boolean => {
    const newErrors: { project?: string; userStory?: string; websiteUrl?: string } = {};

    if (step === 0) {
      if (!selectedProjectId) {
        newErrors.project = 'Please select a project';
      }
    } else if (step === 1) {
      if (!selectedProjectId) {
        newErrors.project = 'Please select a project';
      }
      if (!selectedUserStoryId) {
        newErrors.userStory = 'Please select a user story';
      }
    } else if (step === 2) {
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

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(Math.min(currentStep + 1, STEPS.length - 1));
      // Clear errors when moving forward
      setErrors({});
    }
  };

  const handlePrevious = () => {
    setCurrentStep(Math.max(currentStep - 1, 0));
    setErrors({});
  };

  const getSelectedUserStoryText = (): string => {
    const userStory = userStories.find((us) => us.id === selectedUserStoryId);
    return userStory?.story || '';
  };

  const handleGenerateTests = () => {
    if (validateStep(2)) {
      clearDraft(); // Clear draft on successful submission
      onGenerateTests(
        websiteUrl.trim(),
        getSelectedUserStoryText(),
        selectedProjectId,
        selectedUserStoryId,
        prerequisiteSteps,
        quickMode
      );
    }
  };

  const handleRunTest = () => {
    if (validateStep(2)) {
      clearDraft(); // Clear draft on successful submission
      onRunTest(
        websiteUrl.trim(),
        getSelectedUserStoryText(),
        headless,
        selectedProjectId,
        selectedUserStoryId
      );
    }
  };

  const handleRestoreDraft = () => {
    const draft = loadDraft();
    if (draft) {
      setShowDraftRestore(false);
    }
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowDraftRestore(false);
  };

  const handleCreateUserStory = async (story: string, context?: string) => {
    if (!selectedProjectId) return;

    const response = await createUserStory(selectedProjectId, {
      story: story.trim(),
      website_url: websiteUrl.trim() || undefined,
      additional_context: context,
    });

    // Refresh user stories and select the new one
    await fetchUserStories(selectedProjectId);
    setSelectedUserStoryId(response.user_story.id);
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedUserStory = userStories.find((us) => us.id === selectedUserStoryId);

  return (
    <>
      {/* Draft Restore Modal */}
      <Modal
        isOpen={showDraftRestore}
        onClose={handleDiscardDraft}
        title="Restore Draft?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            We found a saved draft of your test form. Would you like to restore it?
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleDiscardDraft}
              className="flex-1"
            >
              Discard
            </Button>
            <Button
              onClick={handleRestoreDraft}
              className="flex-1"
            >
              Restore Draft
            </Button>
          </div>
        </div>
      </Modal>

      <Card title="Create Test" className="mb-6">
        {/* Step Indicator */}
        <div className="mb-6">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {currentStep === 0 && (
            <TestInputFormStep1
              projects={projects}
              selectedProjectId={selectedProjectId}
              loadingProjects={loadingProjects}
              error={errors.project}
              onProjectChange={(projectId) => {
                setSelectedProjectId(projectId);
                setSelectedUserStoryId('');
                setErrors({});
              }}
              disabled={isLoading}
            />
          )}

          {currentStep === 1 && (
            <TestInputFormStep2
              userStories={userStories}
              selectedUserStoryId={selectedUserStoryId}
              loadingUserStories={loadingUserStories}
              error={errors.userStory}
              onUserStoryChange={(userStoryId) => {
                setSelectedUserStoryId(userStoryId);
                setErrors({});
              }}
              onCreateUserStory={handleCreateUserStory}
              disabled={isLoading || !selectedProjectId}
            />
          )}

          {currentStep === 2 && (
            <TestInputFormStep3
              project={selectedProject}
              userStory={selectedUserStory}
              websiteUrl={websiteUrl}
              headless={headless}
              error={errors.websiteUrl}
              onWebsiteUrlChange={(url) => {
                setWebsiteUrl(url);
                setErrors({});
              }}
              onHeadlessChange={setHeadless}
              onGenerateTests={handleGenerateTests}
              onRunTest={handleRunTest}
              prerequisiteSteps={prerequisiteSteps}
              onPrerequisiteStepsChange={setPrerequisiteSteps}
              quickMode={quickMode}
              onQuickModeChange={setQuickMode}
              isLoading={isLoading}
              disabled={!selectedProjectId || !selectedUserStoryId}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700 mt-6">
          <Button
            variant="secondary"
            onClick={handlePrevious}
            disabled={currentStep === 0 || isLoading}
          >
            <FiChevronLeft className="mr-1" />
            Previous
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={isLoading}>
              Next
              <FiChevronRight className="ml-1" />
            </Button>
          ) : (
            <div className="flex gap-3">
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
          )}
        </div>
      </Card>
    </>
  );
};
