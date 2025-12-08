import React, { useState, useEffect } from 'react';
import { TestStepsList } from './TestStepsList';
import { ExecutionControls } from './ExecutionControls';
import { BrowserPreview } from '../BrowserPreview/BrowserPreview';
import { useBrowserStream } from '../../hooks/useBrowserStream';
import type { TestCase, ExecutionResult, StepResult } from '../../types';

interface TestExecutionViewProps {
  testCase: TestCase;
  executionResult: ExecutionResult | null;
  isRunning: boolean;
  headless: boolean;
  onHeadlessChange?: (headless: boolean) => void;
  onStop?: () => void;
}

export const TestExecutionView: React.FC<TestExecutionViewProps> = ({
  testCase,
  executionResult,
  isRunning,
  headless,
  onHeadlessChange,
  onStop,
  onExecutionComplete,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number | undefined>();
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | undefined>();

  // Connect to browser stream if not headless and execution is running
  // Connect immediately when executionId is available
  const { currentFrame, isConnected, error: streamError, finalResult: wsFinalResult } = useBrowserStream({
    executionId: executionResult?.execution_id,
    enabled: !headless && !!executionResult?.execution_id, // Enable as soon as executionId is available
    wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
  });

  // Update execution result when final result arrives via WebSocket
  useEffect(() => {
    if (wsFinalResult) {
      // Final result received via WebSocket - update parent component
      onExecutionComplete?.(wsFinalResult);
    }
  }, [wsFinalResult, onExecutionComplete]);

  // Update current step index based on execution progress
  useEffect(() => {
    if (executionResult) {
      // Find the first step that hasn't completed yet (success is undefined)
      const runningStepIndex = executionResult.steps.findIndex(
        (s) => s.success === undefined
      );
      if (runningStepIndex !== -1) {
        setCurrentStepIndex(runningStepIndex);
      } else {
        // All steps completed, show last step
        setCurrentStepIndex(executionResult.steps.length - 1);
      }
    }
  }, [executionResult]);

  // Initialize steps from testCase if executionResult has no steps or steps is empty
  const steps: StepResult[] = (executionResult?.steps && executionResult.steps.length > 0) 
    ? executionResult.steps 
    : testCase.steps.map((step, index) => ({
        step_id: step.id || `step-${index}`,
        // success is undefined for pending steps
        execution_time_ms: 0,
        element_found: false,
      }));

  return (
    <div className="h-full flex flex-col">
      {/* Execution Controls */}
      <ExecutionControls
        isRunning={isRunning}
        onStop={onStop}
        headless={headless}
        onHeadlessChange={onHeadlessChange}
      />

      {/* Three-Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Test Steps */}
        <div className="w-80 flex-shrink-0">
          <TestStepsList
            steps={steps}
            currentStepIndex={currentStepIndex}
            onStepClick={setSelectedStepIndex}
          />
        </div>

        {/* Center Pane: Test Details */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {testCase.name}
              </h2>
              <p className="text-gray-600 mb-4">{testCase.description}</p>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>Website: {testCase.website_url}</span>
                <span>•</span>
                <span>{testCase.steps.length} steps</span>
                {executionResult && (
                  <>
                    <span>•</span>
                    <span>
                      Status:{' '}
                      <span className="capitalize font-medium text-gray-900">
                        {executionResult.status}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Execution Summary */}
            {executionResult && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <div className="text-sm text-gray-600">Total Duration</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {executionResult.total_duration_ms}ms
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <div className="text-sm text-gray-600">Steps Passed</div>
                  <div className="text-2xl font-bold text-green-600 mt-1">
                    {executionResult.steps.filter((s) => s.success).length}
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <div className="text-sm text-gray-600">Steps Failed</div>
                  <div className="text-2xl font-bold text-red-600 mt-1">
                    {executionResult.steps.filter((s) => s.success === false).length}
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <div className="text-sm text-gray-600">Screenshots</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {executionResult.screenshots?.length || 0}
                  </div>
                </div>
              </div>
            )}

            {/* Selected Step Details */}
            {selectedStepIndex !== undefined && steps[selectedStepIndex] && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Step {selectedStepIndex + 1} Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className="ml-2">
                      {steps[selectedStepIndex].success === undefined
                        ? 'Pending'
                        : steps[selectedStepIndex].success
                        ? 'Passed'
                        : 'Failed'}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Duration:</span>
                    <span className="ml-2">{steps[selectedStepIndex].execution_time_ms}ms</span>
                  </div>
                  {steps[selectedStepIndex].error && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Error:</span>
                      <p className="mt-1 text-sm text-red-600">
                        {steps[selectedStepIndex].error}
                      </p>
                    </div>
                  )}
                  {steps[selectedStepIndex].selector_used && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Selector:</span>
                      <p className="mt-1 text-sm text-gray-700">
                        {steps[selectedStepIndex].selector_used.type}:{' '}
                        {steps[selectedStepIndex].selector_used.value}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Browser Preview (only when not headless) */}
        {!headless && (
          <div className="w-1/2 flex-shrink-0 border-l border-gray-200">
            <BrowserPreview
              imageUrl={currentFrame?.imageUrl}
              url={currentFrame?.url || testCase.website_url}
              isLoading={!isConnected && !currentFrame && !streamError}
              error={streamError || undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
};

