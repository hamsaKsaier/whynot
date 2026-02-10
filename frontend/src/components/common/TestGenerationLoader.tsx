import React, { useState, useEffect } from 'react';
import { FiZap, FiCode, FiCheckCircle, FiLoader } from 'react-icons/fi';
import { Card } from './Card';

interface TestGenerationLoaderProps {
  message?: string;
}

const steps = [
  { icon: FiZap, label: 'Analyzing user story', duration: 3000 },
  { icon: FiCode, label: 'Generating test cases', duration: 8000 },
  { icon: FiCheckCircle, label: 'Validating tests', duration: 3000 },
];

export const TestGenerationLoader: React.FC<TestGenerationLoaderProps> = ({
  message = 'Generating your test cases...',
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let stepProgress = 0;
    const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 100;
      
      // Calculate which step we're on
      let stepElapsed = 0;
      let stepIndex = 0;
      for (let i = 0; i < steps.length; i++) {
        if (elapsed < stepElapsed + steps[i].duration) {
          stepIndex = i;
          break;
        }
        stepElapsed += steps[i].duration;
      }
      
      setCurrentStep(stepIndex);
      
      // Calculate progress within current step
      const currentStepElapsed = elapsed - stepElapsed;
      stepProgress = Math.min((currentStepElapsed / steps[stepIndex].duration) * 100, 100);
      
      // Calculate overall progress
      const overallProgress = ((elapsed / totalDuration) * 100);
      setProgress(Math.min(overallProgress, 95)); // Cap at 95% until actually done
      
      if (elapsed >= totalDuration) {
        clearInterval(interval);
        setProgress(100);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const CurrentIcon = steps[currentStep]?.icon || FiLoader;

  return (
    <Card className="mb-6 animate-slide-in">
      <div className="text-center py-12 px-6">
        {/* Animated Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary-100 rounded-full animate-ping opacity-75"></div>
            <div className="relative bg-primary-50 rounded-full p-6">
              <CurrentIcon className="h-12 w-12 text-primary-600 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Main Message */}
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{message}</h3>
        <p className="text-sm text-gray-600 mb-6">
          This usually takes 10-20 seconds. Please wait...
        </p>

        {/* Progress Bar */}
        <div className="max-w-md mx-auto mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">{Math.round(progress)}% complete</p>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center gap-4 max-w-md mx-auto">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <div
                key={index}
                className={`flex flex-col items-center gap-2 transition-all duration-300 ${
                  isActive ? 'scale-110' : 'scale-100'
                }`}
              >
                <div
                  className={`p-2 rounded-lg transition-all duration-300 ${
                    isCompleted
                      ? 'bg-green-100 text-green-600'
                      : isActive
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <StepIcon className="h-5 w-5" />
                </div>
                <span
                  className={`text-xs font-medium transition-colors duration-300 ${
                    isActive
                      ? 'text-primary-600'
                      : isCompleted
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Animated Dots */}
        <div className="flex justify-center gap-1 mt-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1s',
              }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
};
