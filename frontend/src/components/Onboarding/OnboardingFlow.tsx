import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX, FiZap, FiFolder, FiBook, FiPlay } from 'react-icons/fi';
import { Modal } from '../common/Modal';
import { OnboardingStep } from './OnboardingStep';
import { useOnboarding } from '../../hooks/useOnboarding';

interface OnboardingFlowProps {
  onComplete?: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { t } = useTranslation('common');
  const { completeOnboarding } = useOnboarding();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: t('common.onboarding.welcomeTitle'),
      description: t('common.onboarding.welcomeDescription'),
      content: (
        <div className="space-y-4 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary-900/30 rounded-full">
              <FiZap className="h-12 w-12 text-primary-600" />
            </div>
          </div>
          <div className="space-y-2 text-start">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 font-semibold text-sm">
                1
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t('common.onboarding.createProjects')}</h3>
                <p className="text-sm text-muted-foreground">{t('common.onboarding.createProjectsDesc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 font-semibold text-sm">
                2
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t('common.onboarding.addUserStories')}</h3>
                <p className="text-sm text-muted-foreground">{t('common.onboarding.addUserStoriesDesc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 font-semibold text-sm">
                3
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t('common.onboarding.generateRunTests')}</h3>
                <p className="text-sm text-muted-foreground">{t('common.onboarding.generateRunTestsDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: t('common.onboarding.firstProjectTitle'),
      description: t('common.onboarding.firstProjectDescription'),
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-blue-900/20 rounded-lg border border-blue-700">
            <FiFolder className="h-8 w-8 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground">{t('common.onboarding.exampleProject')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('common.onboarding.exampleProjectDesc')}
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>{t('common.onboarding.projectTip1')}</p>
            <p>{t('common.onboarding.projectTip2')}</p>
            <p>{t('common.onboarding.projectTip3')}</p>
          </div>
        </div>
      ),
    },
    {
      title: t('common.onboarding.userStoriesTitle'),
      description: t('common.onboarding.userStoriesDescription'),
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-green-900/20 rounded-lg border border-green-700">
            <FiBook className="h-8 w-8 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-foreground mb-1">{t('common.onboarding.exampleUserStory')}</h3>
              <p className="text-sm text-muted-foreground italic">
                {t('common.onboarding.exampleUserStoryText')}
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>{t('common.onboarding.storyTip1')}</p>
            <p>{t('common.onboarding.storyTip2')}</p>
            <p>{t('common.onboarding.storyTip3')}</p>
          </div>
        </div>
      ),
    },
    {
      title: t('common.onboarding.generateTestsTitle'),
      description: t('common.onboarding.generateTestsDescription'),
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-sky-900/20 rounded-lg border border-sky-700">
            <FiPlay className="h-8 w-8 text-sky-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground">{t('common.onboarding.aiTestGeneration')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('common.onboarding.aiTestGenerationDesc')}
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>{t('common.onboarding.testTip1')}</p>
            <p>{t('common.onboarding.testTip2')}</p>
            <p>{t('common.onboarding.testTip3')}</p>
            <p>{t('common.onboarding.testTip4')}</p>
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
            <span className="text-sm font-medium text-muted-foreground">
              {t('common.onboarding.stepOf', { current: currentStep + 1, total: steps.length })}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(((currentStep + 1) / steps.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-colors duration-150"
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
