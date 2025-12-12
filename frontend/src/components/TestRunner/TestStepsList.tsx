import React from 'react';
import { FiCheckCircle, FiXCircle, FiClock, FiPlay } from 'react-icons/fi';
import type { StepResult, TestStep } from '../../types';

interface StepUpdate {
  stepIndex: number;
  step?: {
    id: string;
    action: string;
    description: string;
  };
  stepResult?: {
    step_id: string;
    success: boolean;
    error?: string;
    execution_time_ms: number;
    element_found?: boolean;
    selector_used?: any;
  };
  status: 'pending' | 'running' | 'completed';
  timestamp: number;
}

interface TestStepsListProps {
  steps: StepResult[];
  testSteps?: TestStep[]; // Original test steps with action and description
  stepUpdates?: Map<number, StepUpdate>; // Real-time step updates
  currentStepIndex?: number;
  onStepClick?: (index: number) => void;
}

export const TestStepsList: React.FC<TestStepsListProps> = ({
  steps,
  testSteps,
  stepUpdates,
  currentStepIndex,
  onStepClick,
}) => {
  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'click':
        return 'bg-blue-100 text-blue-800';
      case 'type':
      case 'fill':
        return 'bg-green-100 text-green-800';
      case 'navigate':
        return 'bg-purple-100 text-purple-800';
      case 'wait':
        return 'bg-yellow-100 text-yellow-800';
      case 'assert':
        return 'bg-indigo-100 text-indigo-800';
      case 'scroll':
        return 'bg-pink-100 text-pink-800';
      case 'hover':
        return 'bg-cyan-100 text-cyan-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStepIcon = (step: StepResult, index: number, stepUpdate?: StepUpdate) => {
    // Check stepUpdate first for real-time status
    if (stepUpdate?.status === 'running') {
      return <FiPlay className="h-5 w-5 text-blue-500 animate-pulse" />;
    }

    if (stepUpdate?.status === 'completed' && stepUpdate.stepResult) {
      return stepUpdate.stepResult.success ? (
        <FiCheckCircle className="h-5 w-5 text-green-500" />
      ) : (
        <FiXCircle className="h-5 w-5 text-red-500" />
      );
    }

    // Fallback to step result
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

  const getStepStatus = (step: StepResult, index: number, stepUpdate?: StepUpdate) => {
    // Check stepUpdate first for real-time status
    if (stepUpdate?.status === 'running') {
      return 'running';
    }
    if (stepUpdate?.status === 'completed' && stepUpdate.stepResult) {
      return stepUpdate.stepResult.success ? 'passed' : 'failed';
    }

    // Fallback to step result
    if (step.success === undefined) {
      if (index === currentStepIndex) {
        return 'running';
      }
      return 'pending';
    }
    return step.success ? 'passed' : 'failed';
  };

  const getStepExecutionTime = (step: StepResult, stepUpdate?: StepUpdate) => {
    if (stepUpdate?.stepResult?.execution_time_ms !== undefined) {
      return stepUpdate.stepResult.execution_time_ms;
    }
    return step.execution_time_ms;
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
          const stepUpdate = stepUpdates?.get(index);
          const testStep = testSteps?.[index];
          const status = getStepStatus(step, index, stepUpdate);
          const isActive = index === currentStepIndex || stepUpdate?.status === 'running';
          const executionTime = getStepExecutionTime(step, stepUpdate);

          // Get action and description from stepUpdate or testStep
          const action = stepUpdate?.step?.action || testStep?.action || 'unknown';
          const description = stepUpdate?.step?.description || testStep?.description || '';
          const error = stepUpdate?.stepResult?.error || step.error;

          return (
            <div
              key={step.step_id}
              onClick={() => onStepClick?.(index)}
              className={`p-4 cursor-pointer transition-colors ${isActive
                  ? 'bg-blue-50 border-l-4 border-blue-500'
                  : 'hover:bg-gray-50'
                }`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon(step, index, stepUpdate)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      Step {index + 1}
                    </span>
                    <span className="text-xs text-gray-500">
                      {executionTime}ms
                    </span>
                  </div>

                  {/* Action Badge */}
                  {action && action !== 'unknown' && (
                    <div className="mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${getActionBadgeColor(action)}`}
                      >
                        {action}
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  {description && (
                    <p className="text-xs text-gray-600 mt-1 mb-1 line-clamp-2">
                      {description}
                    </p>
                  )}

                  {/* Status Badge */}
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${status === 'passed'
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

                  {/* Error Message */}
                  {error && (
                    <p className="text-xs text-red-600 mt-2">{error}</p>
                  )}

                  {/* Selector Used */}
                  {(stepUpdate?.stepResult?.selector_used || step.selector_used) && (
                    <p className="text-xs text-gray-500 mt-1">
                      Selector: {(stepUpdate?.stepResult?.selector_used || step.selector_used)?.type}
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














