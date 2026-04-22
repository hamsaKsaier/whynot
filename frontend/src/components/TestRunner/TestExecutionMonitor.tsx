import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { Spinner } from '../common/Spinner';
import { FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi';
import type { ExecutionResult } from '../../types';

interface TestExecutionMonitorProps {
  executionResult: ExecutionResult | null;
  isRunning: boolean;
}

export const TestExecutionMonitor: React.FC<TestExecutionMonitorProps> = ({
  executionResult,
  isRunning,
}) => {
  const { t } = useTranslation('runner');

  if (!isRunning && !executionResult) {
    return null;
  }

  const getStatusIcon = (success: boolean) => {
    if (success) {
      return <FiCheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <FiXCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-600' : 'text-red-600';
  };

  const totalSteps = executionResult?.steps.length || 0;
  const completedSteps = executionResult?.steps.filter(s => s.success !== undefined).length || 0;
  const passedSteps = executionResult?.steps.filter(s => s.success).length || 0;
  const failedSteps = executionResult?.steps.filter(s => !s.success).length || 0;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <Card title={t('runner.execution.title')} className="mb-6">
      {isRunning && (
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Spinner />
            <span className="text-foreground font-medium">{t('runner.execution.running')}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5">
            <div
              className="bg-primary-600 h-2.5 rounded-full transition-colors duration-150"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {t('runner.execution.stepProgress', { completed: completedSteps, total: totalSteps })}
          </p>
        </div>
      )}

      {executionResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted rounded-lg p-3">
              <div className="text-sm text-muted-foreground">{t('runner.execution.stats.status')}</div>
              <div className={`text-lg font-semibold mt-1 capitalize ${getStatusColor(executionResult.status === 'completed')}`}>
                {executionResult.status}
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="text-sm text-muted-foreground">{t('runner.execution.stats.totalSteps')}</div>
              <div className="text-lg font-semibold mt-1">{totalSteps}</div>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="text-sm text-muted-foreground">{t('runner.execution.stats.passed')}</div>
              <div className="text-lg font-semibold mt-1 text-green-600">{passedSteps}</div>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <div className="text-sm text-muted-foreground">{t('runner.execution.stats.failed')}</div>
              <div className="text-lg font-semibold mt-1 text-red-600">{failedSteps}</div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <h4 className="font-medium text-foreground">{t('runner.execution.stepDetails')}</h4>
            {executionResult.steps.map((step, index) => (
              <div
                key={step.step_id}
                className="flex items-start gap-3 p-3 bg-muted rounded-lg border border-border"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {step.success !== undefined ? (
                    getStatusIcon(step.success)
                  ) : (
                    <FiClock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      {t('runner.execution.stepLabel', { number: index + 1 })}: {step.step_id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {step.execution_time_ms}ms
                    </span>
                  </div>
                  {step.error && (
                    <p className="text-sm text-red-600 mt-1">{step.error}</p>
                  )}
                  {step.selector_used && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('runner.execution.selector')}: {step.selector_used.type} ({step.selector_used.value})
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Error Message */}
          {executionResult.error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-400">
                <strong>{t('runner.execution.error')}:</strong> {executionResult.error}
              </p>
            </div>
          )}

          {/* Duration */}
          <div className="text-sm text-muted-foreground">
            {t('runner.execution.totalDuration')}: {executionResult.total_duration_ms}ms
            {executionResult.completed_at && (
              <span className="ms-4">
                {t('runner.execution.completedAt')}: {new Date(executionResult.completed_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};





























