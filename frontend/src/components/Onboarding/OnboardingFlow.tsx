import React, { useState } from 'react';
import { FiX, FiZap, FiFolder, FiBook, FiPlay } from 'react-icons/fi';
import { Modal } from '../common/Modal';
import { OnboardingStep } from './OnboardingStep';
import { useOnboarding } from '../../hooks/useOnboarding';

interface OnboardingFlowProps {
  onComplete?: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { completeOnboarding } = useOnboarding();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to WhyNot',
      description: 'AI-powered test automation that converts user stories into executable test cases',
      content: (
        <div className="space-y-4 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary-100 rounded-full">
              <FiZap className="h-12 w-12 text-primary-600" />
            </div>
          </div>
          <div className="space-y-2 text-left">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold text-sm">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Create Projects</h3>
                <p className="text-sm text-gray-600">Organize your test cases by application or feature</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold text-sm">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Add User Stories</h3>
                <p className="text-sm text-gray-600">Describe what users want to accomplish</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold text-sm">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Generate & Run Tests</h3>
                <p className="text-sm text-gray-600">AI automatically creates and executes test cases</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Create Your First Project',
      description: 'Projects help you organize test cases by application or feature',
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <FiFolder className="h-8 w-8 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900">Example: E-commerce Website</h3>
              <p className="text-sm text-gray-600 mt-1">
                A project for testing your online store functionality
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-600 space-y-2">
            <p>• Click "Projects" in the sidebar to get started</p>
            <p>• Give your project a name and optional description</p>
            <p>• Add a website URL if you have one</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Add User Stories',
      description: 'User stories describe what users want to accomplish',
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
            <FiBook className="h-8 w-8 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Example User Story</h3>
              <p className="text-sm text-gray-700 italic">
                "As a user, I want to login to the website so that I can access my account"
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-600 space-y-2">
            <p>• Navigate to your project and click "Add User Story"</p>
            <p>• Write in natural language what the user wants to do</p>
            <p>• Add additional context if needed</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Generate & Run Tests',
      description: 'WhyNot automatically creates test cases from your user stories',
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-sky-50 rounded-lg border border-sky-200">
            <FiPlay className="h-8 w-8 text-sky-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900">AI-Powered Test Generation</h3>
              <p className="text-sm text-gray-600 mt-1">
                WhyNot analyzes your user story and creates executable test cases
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-600 space-y-2">
            <p>• Select a project and user story</p>
            <p>• Click "Generate Tests" to create test cases</p>
            <p>• Or click "Run Test" to generate and execute immediately</p>
            <p>• Watch the live browser preview as tests execute</p>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    onComplete?.();
  };

  const handleGetStarted = () => {
    completeOnboarding();
    onComplete?.();
  };

  const currentStepData = steps[currentStep];

  return (
    <Modal
      isOpen={true}
      onClose={handleSkip}
      title=""
      size="lg"
      showCloseButton={true}
    >
      <div className="relative">
        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(((currentStep + 1) / steps.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <OnboardingStep
          title={currentStepData.title}
          description={currentStepData.description}
          content={currentStepData.content}
          onNext={handleNext}
          onSkip={handleSkip}
          onGetStarted={handleGetStarted}
          isFirst={currentStep === 0}
          isLast={currentStep === steps.length - 1}
          showSkip={true}
        />
      </div>
    </Modal>
  );
};
