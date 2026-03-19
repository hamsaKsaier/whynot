import React from 'react';
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
    <Card title="Test Execution" className="mb-6">
      {isRunning && (
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Spinner />
            <span className="text-slate-200 font-medium">Test is running...</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2.5">
            <div
              className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            Step {completedSteps} of {totalSteps}
          </p>
        </div>
      )}

      {executionResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-sm text-slate-400">Status</div>
              <div className={`text-lg font-semibold mt-1 capitalize ${getStatusColor(executionResult.status === 'completed')}`}>
                {executionResult.status}
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-sm text-slate-400">Total Steps</div>
              <div className="text-lg font-semibold mt-1">{totalSteps}</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-sm text-slate-400">Passed</div>
              <div className="text-lg font-semibold mt-1 text-green-600">{passedSteps}</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-sm text-slate-400">Failed</div>
              <div className="text-lg font-semibold mt-1 text-red-600">{failedSteps}</div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <h4 className="font-medium text-white">Step Details</h4>
            {executionResult.steps.map((step, index) => (
              <div
                key={step.step_id}
                className="flex items-start gap-3 p-3 bg-slate-900 rounded-lg border border-slate-700"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {step.success !== undefined ? (
                    getStatusIcon(step.success)
                  ) : (
                    <FiClock className="h-5 w-5 text-slate-500 animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">
                      Step {index + 1}: {step.step_id}
                    </span>
                    <span className="text-xs text-slate-400">
                      {step.execution_time_ms}ms
                    </span>
                  </div>
                  {step.error && (
                    <p className="text-sm text-red-600 mt-1">{step.error}</p>
                  )}
                  {step.selector_used && (
                    <p className="text-xs text-slate-400 mt-1">
                      Selector: {step.selector_used.type} ({step.selector_used.value})
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Error Message */}
          {executionResult.error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-300">
                <strong>Error:</strong> {executionResult.error}
              </p>
            </div>
          )}

          {/* Duration */}
          <div className="text-sm text-slate-400">
            Total duration: {executionResult.total_duration_ms}ms
            {executionResult.completed_at && (
              <span className="ml-4">
                Completed at: {new Date(executionResult.completed_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};





























