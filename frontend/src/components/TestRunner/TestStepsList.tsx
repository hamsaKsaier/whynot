import React from 'react';
import { useTranslation } from 'react-i18next';
import { FiCheckCircle, FiXCircle, FiClock, FiPlay, FiEdit } from 'react-icons/fi';
import type { StepResult, TestStep } from '../../types';

interface SelectorAttempt {
  selector: any;
  attemptNumber: number;
  totalAttempts: number;
  status: 'trying' | 'failed' | 'succeeded';
  timestamp: number;
}

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
  selectorAttempts?: SelectorAttempt[];
  recoveryStart?: {
    reason: string;
    attemptedSelectors: any[];
    timestamp: number;
  };
  recoverySuccess?: {
    successfulSelector: any;
    strategyUsed: string;
    timestamp: number;
  };
}

interface TestStepsListProps {
  steps: StepResult[];
  testSteps?: TestStep[]; // Original test steps with action and description
  stepUpdates?: Map<number, StepUpdate>; // Real-time step updates
  currentStepIndex?: number;
  onStepClick?: (index: number) => void;
  onStepFix?: (index: number, step: TestStep) => void; // Callback when fix icon is clicked
}

export const TestStepsList: React.FC<TestStepsListProps> = ({
  steps,
  testSteps,
  stepUpdates,
  currentStepIndex,
  onStepClick,
  onStepFix,
}) => {
  const { t } = useTranslation('runner');
  const getActionBadgeColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'click':
        return 'bg-blue-900/30 text-blue-400';
      case 'type':
      case 'fill':
        return 'bg-green-900/30 text-green-400';
      case 'navigate':
        return 'bg-sky-900/30 text-sky-400';
      case 'wait':
        return 'bg-yellow-900/30 text-yellow-400';
      case 'assert':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'scroll':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400';
      case 'hover':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getStepIcon = (step: StepResult, index: number, stepUpdate?: StepUpdate) => {
    // Check stepUpdate first for real-time status
    if (stepUpdate?.status === 'running') {
      return <FiPlay className="h-5 w-5 text-blue-500" />;
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
        return <FiPlay className="h-5 w-5 text-blue-500" />;
      }
      return <FiClock className="h-5 w-5 text-muted-foreground" />;
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
    <div className="h-full overflow-y-auto bg-card border-e border-border">
      <div className="p-3 sm:p-4 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm sm:text-base">{t('runner.steps.title')}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {steps.filter(s => s.success === true).length} {t('runner.stepsList.passed')},{' '}
          {steps.filter(s => s.success === false).length} {t('runner.stepsList.failed')}
        </p>
      </div>

      <div className="divide-y divide-border">
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
              className={`p-3 sm:p-4 cursor-pointer transition-colors duration-150 ${isActive
                  ? 'bg-blue-900/20 border-s-4 border-blue-500'
                  : 'hover:bg-muted/50'
                }`}
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon(step, index, stepUpdate)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-xs sm:text-sm font-medium text-foreground">
                      {t('runner.stepsList.step', { step: index + 1 })}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
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
                    <p className="text-xs text-muted-foreground mt-1 mb-1 line-clamp-2">
                      {description}
                    </p>
                  )}

                  {/* Status Badge */}
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${status === 'passed'
                          ? 'bg-green-900/30 text-green-400'
                          : status === 'failed'
                            ? 'bg-red-900/30 text-red-400'
                            : status === 'running'
                              ? 'bg-blue-900/30 text-blue-400'
                              : 'bg-muted text-foreground'
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
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('runner.stepsList.selector')}: {(stepUpdate?.stepResult?.selector_used || step.selector_used)?.type}
                    </p>
                  )}

                  {/* Selector Attempts */}
                  {stepUpdate?.selectorAttempts && stepUpdate.selectorAttempts.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-xs font-medium text-muted-foreground mb-1">{t('runner.stepsList.selectorAttempts')}:</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {stepUpdate.selectorAttempts
                          .sort((a, b) => a.attemptNumber - b.attemptNumber)
                          .map((attempt, idx) => (
                            <div key={idx} className="text-[10px] sm:text-xs flex items-start gap-1">
                              {attempt.status === 'succeeded' ? (
                                <span className="text-green-600 shrink-0">✅</span>
                              ) : attempt.status === 'failed' ? (
                                <span className="text-red-600 shrink-0">❌</span>
                              ) : (
                                <span className="text-blue-600 shrink-0">🔄</span>
                              )}
                              <span className={`break-all ${attempt.status === 'succeeded' ? 'text-green-400 font-medium' : attempt.status === 'failed' ? 'text-red-400' : 'text-blue-400'}`}>
                                {attempt.attemptNumber}/{attempt.totalAttempts}: {attempt.selector.type} = "{attempt.selector.value}"
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Recovery Status */}
                  {stepUpdate?.recoveryStart && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-xs font-medium text-blue-600 mb-1">{t('runner.stepsList.recoveryStarted')}</div>
                      <div className="text-xs text-muted-foreground">{stepUpdate.recoveryStart.reason}</div>
                    </div>
                  )}

                  {stepUpdate?.recoverySuccess && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-xs font-medium text-green-600 mb-1">{t('runner.stepsList.recoverySuccessful')}</div>
                      <div className="text-xs text-foreground">
                        {t('runner.stepsList.using')}: {stepUpdate.recoverySuccess.successfulSelector.type} = "{stepUpdate.recoverySuccess.successfulSelector.value}"
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {t('runner.stepsList.strategy')}: {stepUpdate.recoverySuccess.strategyUsed}
                      </div>
                    </div>
                  )}
                </div>
                {/* Fix/Edit Icon */}
                {testStep && onStepFix && (
                  <div className="flex-shrink-0 ms-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStepFix(index, testStep);
                      }}
                      className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-900/20 rounded transition-colors"
                      title={t('runner.stepsList.fixStep')}
                      aria-label={t('runner.stepsList.fixStep')}
                    >
                      <FiEdit className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};





















