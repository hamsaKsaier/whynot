import React from 'react';
import { Button } from '../common/Button';

interface OnboardingStepProps {
  title: string;
  description: string;
  content: React.ReactNode;
  onNext?: () => void;
  onSkip?: () => void;
  onGetStarted?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  showSkip?: boolean;
}

export const OnboardingStep: React.FC<OnboardingStepProps> = ({
  title,
  description,
  content,
  onNext,
  onSkip,
  onGetStarted,
  isFirst = false,
  isLast = false,
  showSkip = true,
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400">{description}</p>
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        {content}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        {showSkip && (
          <Button variant="secondary" onClick={onSkip}>
            Skip
          </Button>
        )}
        {!showSkip && <div />}
        
        <div className="flex gap-3 ml-auto">
          {isLast ? (
            <Button onClick={onGetStarted}>
              Get Started
            </Button>
          ) : (
            <Button onClick={onNext}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
