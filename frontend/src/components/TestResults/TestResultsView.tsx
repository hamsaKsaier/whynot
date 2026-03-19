import React, { useState } from 'react';
import { Card } from '../common/Card';
import { FiCheckCircle, FiXCircle, FiClock, FiImage, FiEdit, FiEye } from 'react-icons/fi';
import type { ExecutionResult, TestCase, TestStep } from '../../types';
import { VisualComparisonViewer } from '../VisualRegression/VisualComparisonViewer';
import { getExecutionVisualComparisons } from '../../services/api';

interface TestResultsViewProps {
  testCase: TestCase | null;
  executionResult: ExecutionResult | null;
  onViewScreenshots: () => void;
  onStepFix?: (testCase: TestCase, stepIndex: number, step: TestStep) => void;
}

export const TestResultsView: React.FC<TestResultsViewProps> = ({
  testCase,
  executionResult,
  onViewScreenshots,
  onStepFix,
}) => {
  const [selectedComparison, setSelectedComparison] = useState<any>(null);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [visualComparisons, setVisualComparisons] = useState<Record<string, any>>({});

  // Load visual comparisons when execution result is available
  React.useEffect(() => {
    if (executionResult?.execution_id) {
      loadVisualComparisons();
    }
  }, [executionResult?.execution_id]);

  const loadVisualComparisons = async () => {
    if (!executionResult?.execution_id) return;
    try {
      const response = await getExecutionVisualComparisons(executionResult.execution_id);
      const comparisonMap: Record<string, any> = {};
      response.comparisons.forEach((comp: any) => {
        comparisonMap[comp.step_id] = comp;
      });
      setVisualComparisons(comparisonMap);
    } catch (error) {
      console.error('Failed to load visual comparisons:', error);
    }
  };

  const handleViewVisualComparison = (stepId: string) => {
    const comparison = visualComparisons[stepId];
    if (comparison) {
      setSelectedComparison(comparison);
      setComparisonModalOpen(true);
    }
  };

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
      completed: 'bg-green-900/30 text-green-300',
      failed: 'bg-red-900/30 text-red-300',
      running: 'bg-blue-900/30 text-blue-300',
      timeout: 'bg-yellow-900/30 text-yellow-300',
      paused: 'bg-slate-800 text-slate-200',
      cancelled: 'bg-slate-800 text-slate-400',
    };
    const statusColors: Record<string, string> = colors;

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[status] || colors.completed}`}>
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
                <p className="text-sm text-primary-300 font-medium">Test Name</p>
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
                <p className="text-sm text-slate-200 font-medium">Duration</p>
                <p className="text-lg font-bold text-white mt-1">
                  {(executionResult.total_duration_ms / 1000).toFixed(2)}s
                </p>
              </div>
              <FiClock className="h-8 w-8 text-slate-400 opacity-50" />
            </div>
          </div>
        </div>

        {/* Status and Actions */}
        <div className="flex items-center justify-between p-4 bg-slate-900 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Status:</span>
            {getStatusBadge()}
            <span className="text-sm text-slate-400">
              {passedSteps} passed, {failedSteps} failed
            </span>
          </div>
          {executionResult.screenshots.length > 0 && (
            <button
              onClick={onViewScreenshots}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg hover:bg-slate-900 transition-colors"
            >
              <FiImage className="h-4 w-4" />
              <span className="text-sm font-medium">View Screenshots ({executionResult.screenshots.length})</span>
            </button>
          )}
        </div>

        {/* Step-by-Step Results */}
        <div>
          <h4 className="font-semibold text-white mb-3">Step-by-Step Results</h4>
          <div className="space-y-2">
            {executionResult.steps.map((step, index) => {
              const correspondingStep = testCase?.steps.find(s => s.id === step.step_id);

              return (
                <div
                  key={step.step_id}
                  className={`p-4 rounded-lg border-2 ${step.success
                      ? 'bg-green-900/20 border-green-800'
                      : 'bg-red-900/20 border-red-800'
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
                        <span className="font-medium text-white">
                          Step {index + 1}: {correspondingStep?.description || step.step_id}
                        </span>
                        <span className="text-xs text-slate-400">
                          {step.execution_time_ms}ms
                        </span>
                      </div>
                      {correspondingStep && (
                        <p className="text-sm text-slate-400 mb-2">
                          Action: <span className="font-medium capitalize">{correspondingStep.action}</span>
                        </p>
                      )}
                      {step.error && (
                        <div className="mt-2 p-2 bg-red-900/30 rounded text-sm text-red-300">
                          <strong>Error:</strong> {step.error}
                        </div>
                      )}
                      {step.selector_used && (
                        <div className="mt-2 text-xs text-slate-400">
                          <span className="font-medium">Selector used:</span> {step.selector_used.type} - {step.selector_used.value}
                        </div>
                      )}
                      {/* Visual Regression Indicator */}
                      {(step.visual_comparison || visualComparisons[step.step_id]) && (() => {
                        const comparison = step.visual_comparison || visualComparisons[step.step_id];
                        const severity = comparison?.severity || comparison?.regression_severity || 'medium';
                        const severityColors = {
                          low: 'bg-green-900/30 text-green-300 border-green-700',
                          medium: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
                          high: 'bg-orange-900/30 text-orange-300 border-orange-700',
                          critical: 'bg-red-900/30 text-red-300 border-red-700',
                        };
                        const severityMap: Record<string, string> = severityColors;
                        const isRegression = comparison?.isRegression || comparison?.is_regression;

                        if (isRegression) {
                          return (
                            <div className={`mt-2 p-2 rounded border ${severityMap[String(severity)] ?? severityColors.medium}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FiEye className="h-4 w-4" />
                                  <span className="text-sm font-medium">
                                    Visual Regression ({severity.toUpperCase()})
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleViewVisualComparison(step.step_id)}
                                  className="text-xs underline hover:no-underline"
                                >
                                  View Details
                                </button>
                              </div>
                              {comparison?.differences && comparison.differences.length > 0 && (
                                <p className="text-xs mt-1">
                                  {comparison.differences[0]}
                                </p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {/* Fix/Edit Icon */}
                    {testCase && correspondingStep && onStepFix && (
                      <div className="flex-shrink-0 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStepFix(testCase, index, correspondingStep);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-900/20 rounded transition-colors"
                          title="Fix or modify this step"
                          aria-label="Fix or modify this step"
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

        {/* Visual Comparison Viewer Modal */}
        {selectedComparison && (
          <VisualComparisonViewer
            isOpen={comparisonModalOpen}
            onClose={() => {
              setComparisonModalOpen(false);
              setSelectedComparison(null);
            }}
            comparison={selectedComparison}
            baselineScreenshotPath={selectedComparison.baseline_id ? undefined : undefined}
            currentScreenshotPath={selectedComparison.current_screenshot_path}
            diffImagePath={selectedComparison.diff_image_path}
            onUpdate={loadVisualComparisons}
          />
        )}

        {/* Error Summary */}
        {executionResult.error && (
          <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
            <h4 className="font-semibold text-red-900 mb-2">Execution Error</h4>
            <p className="text-sm text-red-300">{executionResult.error}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

























