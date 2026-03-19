import React from 'react';
import { FiCheck } from 'react-icons/fi';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isPending = index > currentStep;

        return (
          <React.Fragment key={index}>
            {/* Step Circle */}
            <div className="flex flex-col items-center flex-1">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  isCompleted
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : isCurrent
                    ? 'bg-primary-900/20 border-primary-600 text-primary-600'
                    : 'bg-slate-800 border-slate-600 text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <FiCheck className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium text-center ${
                  isCurrent ? 'text-primary-600' : isCompleted ? 'text-slate-200' : 'text-slate-500'
                }`}
              >
                {step}
              </span>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  isCompleted ? 'bg-primary-600' : 'bg-slate-600'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
