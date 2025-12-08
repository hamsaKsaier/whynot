import React from 'react';
import { FiCheckCircle, FiXCircle, FiClock, FiPlay } from 'react-icons/fi';
import type { StepResult } from '../../types';

interface TestStepsListProps {
  steps: StepResult[];
  currentStepIndex?: number;
  onStepClick?: (index: number) => void;
}

export const TestStepsList: React.FC<TestStepsListProps> = ({
  steps,
  currentStepIndex,
  onStepClick,
}) => {
  const getStepIcon = (step: StepResult, index: number) => {
    if (step.success === undefined) {
      if (index === currentStepIndex) {
        return <FiPlay className="h-5 w-5 text-blue-500 animate-pulse" />;
      }
      return <FiClock className="h-5 w-5 text-gray-400" />;
    }
    return step.success ? (
      <FiCheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <FiXCircle className="h-5 w-5 text-red-500" />
    );
  };

  const getStepStatus = (step: StepResult, index: number) => {
    if (step.success === undefined) {
      if (index === currentStepIndex) {
        return 'running';
      }
      return 'pending';
    }
    return step.success ? 'passed' : 'failed';
  };

  return (
    <div className="h-full overflow-y-auto bg-white border-r border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Test Steps</h3>
        <p className="text-sm text-gray-500 mt-1">
          {steps.filter(s => s.success === true).length} passed,{' '}
          {steps.filter(s => s.success === false).length} failed
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {steps.map((step, index) => {
          const status = getStepStatus(step, index);
          const isActive = index === currentStepIndex;

          return (
            <div
              key={step.step_id}
              onClick={() => onStepClick?.(index)}
              className={`p-4 cursor-pointer transition-colors ${
                isActive
                  ? 'bg-blue-50 border-l-4 border-blue-500'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon(step, index)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      Step {index + 1}
                    </span>
                    <span className="text-xs text-gray-500">
                      {step.execution_time_ms}ms
                    </span>
                  </div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        status === 'passed'
                          ? 'bg-green-100 text-green-800'
                          : status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : status === 'running'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  {step.error && (
                    <p className="text-xs text-red-600 mt-2">{step.error}</p>
                  )}
                  {step.selector_used && (
                    <p className="text-xs text-gray-500 mt-1">
                      Selector: {step.selector_used.type}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};









