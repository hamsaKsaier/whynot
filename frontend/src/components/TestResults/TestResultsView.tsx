import React from 'react';
import { Card } from '../common/Card';
import { FiCheckCircle, FiXCircle, FiClock, FiImage } from 'react-icons/fi';
import type { ExecutionResult, TestCase } from '../../types';

interface TestResultsViewProps {
  testCase: TestCase | null;
  executionResult: ExecutionResult | null;
  onViewScreenshots: () => void;
}

export const TestResultsView: React.FC<TestResultsViewProps> = ({
  testCase,
  executionResult,
  onViewScreenshots,
}) => {
  if (!executionResult) {
    return null;
  }

  const totalSteps = executionResult.steps.length;
  const passedSteps = executionResult.steps.filter(s => s.success).length;
  const failedSteps = executionResult.steps.filter(s => !s.success).length;
  const successRate = totalSteps > 0 ? (passedSteps / totalSteps) * 100 : 0;

  const getStatusBadge = () => {
    const status = executionResult.status;
    const colors = {
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      running: 'bg-blue-100 text-blue-800',
      timeout: 'bg-yellow-100 text-yellow-800',
    };
    
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status] || colors.completed}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <Card title="Test Results" className="mb-6">
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-700 font-medium">Test Name</p>
                <p className="text-lg font-bold text-primary-900 mt-1">
                  {testCase?.name || 'N/A'}
                </p>
              </div>
              <FiCheckCircle className="h-8 w-8 text-primary-600 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Success Rate</p>
                <p className="text-lg font-bold text-green-900 mt-1">
                  {successRate.toFixed(0)}%
                </p>
              </div>
              <FiCheckCircle className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Total Steps</p>
                <p className="text-lg font-bold text-blue-900 mt-1">
                  {totalSteps}
                </p>
              </div>
              <FiClock className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700 font-medium">Duration</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {(executionResult.total_duration_ms / 1000).toFixed(2)}s
                </p>
              </div>
              <FiClock className="h-8 w-8 text-gray-600 opacity-50" />
            </div>
          </div>
        </div>

        {/* Status and Actions */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Status:</span>
            {getStatusBadge()}
            <span className="text-sm text-gray-600">
              {passedSteps} passed, {failedSteps} failed
            </span>
          </div>
          {executionResult.screenshots.length > 0 && (
            <button
              onClick={onViewScreenshots}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiImage className="h-4 w-4" />
              <span className="text-sm font-medium">View Screenshots ({executionResult.screenshots.length})</span>
            </button>
          )}
        </div>

        {/* Step-by-Step Results */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Step-by-Step Results</h4>
          <div className="space-y-2">
            {executionResult.steps.map((step, index) => {
              const correspondingStep = testCase?.steps.find(s => s.id === step.step_id);
              
              return (
                <div
                  key={step.step_id}
                  className={`p-4 rounded-lg border-2 ${
                    step.success
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {step.success ? (
                        <FiCheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <FiXCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">
                          Step {index + 1}: {correspondingStep?.description || step.step_id}
                        </span>
                        <span className="text-xs text-gray-500">
                          {step.execution_time_ms}ms
                        </span>
                      </div>
                      {correspondingStep && (
                        <p className="text-sm text-gray-600 mb-2">
                          Action: <span className="font-medium capitalize">{correspondingStep.action}</span>
                        </p>
                      )}
                      {step.error && (
                        <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-800">
                          <strong>Error:</strong> {step.error}
                        </div>
                      )}
                      {step.selector_used && (
                        <div className="mt-2 text-xs text-gray-500">
                          <span className="font-medium">Selector used:</span> {step.selector_used.type} - {step.selector_used.value}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Summary */}
        {executionResult.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-semibold text-red-900 mb-2">Execution Error</h4>
            <p className="text-sm text-red-800">{executionResult.error}</p>
          </div>
        )}
      </div>
    </Card>
  );
};


















