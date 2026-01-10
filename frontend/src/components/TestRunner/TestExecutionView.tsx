import React, { useState, useEffect, useMemo } from 'react';
import { TestStepsList } from './TestStepsList';
import { ExecutionControls } from './ExecutionControls';
import { BrowserPreview } from '../BrowserPreview/BrowserPreview';
import { TestAutomationChatbot } from '../Chatbot/TestAutomationChatbot';
import { TestModificationConfirmationDialog } from '../common/TestModificationConfirmationDialog';
import { AgentActivityPanel } from './AgentActivityPanel';
import { useBrowserStream } from '../../hooks/useBrowserStream';
import { updateTestCase, executeTest } from '../../services/api';
import type { TestCase, ExecutionResult, StepResult, TestStep } from '../../types';
import type { ChatContext } from '../../services/chatbot-api';

interface TestExecutionViewProps {
  testCase: TestCase;
  executionResult: ExecutionResult | null;
  isRunning: boolean;
  headless: boolean;
  onHeadlessChange?: (headless: boolean) => void;
  onStop?: () => void;
  onExecutionComplete?: (result: ExecutionResult) => void;
  onTestCaseUpdated?: (testCase: TestCase) => void; // Callback when test case is updated
}

export const TestExecutionView: React.FC<TestExecutionViewProps> = ({
  testCase,
  executionResult,
  isRunning,
  headless,
  onHeadlessChange,
  onStop,
  onExecutionComplete,
  onTestCaseUpdated,
}) => {
  const [localCurrentStepIndex, setLocalCurrentStepIndex] = useState<number | undefined>();
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | undefined>();
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [chatbotContext, setChatbotContext] = useState<ChatContext | undefined>();
  const [pendingModification, setPendingModification] = useState<TestCase | null>(null);
  const [modificationTestResult, setModificationTestResult] = useState<ExecutionResult | null>(null);
  const [isTestingModification, setIsTestingModification] = useState(false);
  const [isModificationConfirmationOpen, setIsModificationConfirmationOpen] = useState(false);

  // Connect to browser stream if not headless and execution is running
  // Connect immediately when executionId is available
  const wsEnabled = !headless && !!executionResult?.execution_id;
  const executionIdForWs = executionResult?.execution_id;
  
  // Memoize executionId to prevent unnecessary reconnections
  const memoizedExecutionId = useMemo(() => executionIdForWs, [executionIdForWs]);
  const memoizedWsEnabled = useMemo(() => wsEnabled, [wsEnabled]);
  
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TestExecutionView.tsx:44',message:'WebSocket hook params changed',data:{executionId:memoizedExecutionId,headless,wsEnabled:memoizedWsEnabled,hasExecutionResult:!!executionResult,prevExecutionId:executionIdForWs},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
  }, [memoizedExecutionId, memoizedWsEnabled, headless, executionResult]);
  // #endregion
  
  const { 
    currentFrame, 
    isConnected, 
    error: streamError, 
    finalResult: wsFinalResult, 
    stepUpdates, 
    agentMessages,
    frameHistory,
    currentStepIndex,
    currentFrameIndex,
    goToStep,
    goToNextFrame,
    goToPrevFrame,
    goToFirstFrame,
    goToLastFrame,
    getTotalFrames,
    getCurrentFramePosition,
  } = useBrowserStream({
    executionId: memoizedExecutionId,
    enabled: memoizedWsEnabled, // Enable as soon as executionId is available
    wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3011',
  });
  // #region agent log
  useEffect(() => {
    if (streamError) {
      fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TestExecutionView.tsx:54',message:'streamError state changed',data:{streamError,isConnected,hasCurrentFrame:!!currentFrame},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,D,E'})}).catch(()=>{});
    }
  }, [streamError, isConnected, currentFrame]);
  // #endregion

  // Update execution result when final result arrives via WebSocket
  useEffect(() => {
    if (wsFinalResult) {
      // Final result received via WebSocket - update parent component
      onExecutionComplete?.(wsFinalResult);
    }
  }, [wsFinalResult, onExecutionComplete]);

  // Update current step index based on execution progress and real-time updates
  useEffect(() => {
    // First check for real-time step updates (step_start events)
    if (stepUpdates && stepUpdates.size > 0) {
      // Find the most recent running step
      let latestRunningIndex: number | undefined;
      stepUpdates.forEach((update: any, index: number) => {
        if (update.status === 'running') {
          latestRunningIndex = index;
        }
      });
      if (latestRunningIndex !== undefined) {
        setLocalCurrentStepIndex(latestRunningIndex);
        return;
      }
    }

    // Fallback to execution result
    if (executionResult) {
      // Find the first step that hasn't completed yet (success is undefined)
      const runningStepIndex = executionResult.steps.findIndex(
        (s: StepResult) => s.success === undefined
      );
      if (runningStepIndex !== -1) {
        setLocalCurrentStepIndex(runningStepIndex);
      } else {
        // All steps completed, show last step
        setLocalCurrentStepIndex(executionResult.steps.length - 1);
      }
    }
  }, [executionResult, stepUpdates]);

  // Initialize steps from testCase if executionResult has no steps or steps is empty
  const steps: StepResult[] = (executionResult?.steps && executionResult.steps.length > 0)
    ? executionResult.steps
    : testCase.steps.map((step, index) => ({
      step_id: step.id || `step-${index}`,
      // success is undefined for pending steps
      execution_time_ms: 0,
      element_found: false,
    }));

  // Handle step fix - open chatbot with step context
  const handleStepFix = (stepIndex: number, step: TestStep) => {
    const stepResult = steps[stepIndex];
    setChatbotContext({
      test_case_id: testCase.id,
      test_case: testCase,
      execution_result: executionResult || undefined,
      step_index: stepIndex,
      step: step,
      operation: 'fix',
      step_id: step.id,
      failure_analysis: stepResult?.failure_analysis,
      page_state: stepResult?.page_state,
      step_result: stepResult, // Include full step result
      error_message: stepResult?.error,
      attempted_selectors: stepResult?.attempted_selectors,
    });
    setIsChatbotOpen(true);
  };

  // Handle test modification request from chatbot - test before saving
  const handleTestModificationRequested = async (modifiedTestCase: TestCase) => {
    setPendingModification(modifiedTestCase);
    setIsTestingModification(true);
    
    try {
      // Test the modified test case (execute in headless mode for quick test)
      const testResult = await executeTest(modifiedTestCase, true); // headless=true
      setModificationTestResult(testResult);
      setIsModificationConfirmationOpen(true);
    } catch (error: any) {
      console.error('Failed to test modified test case:', error);
      // Show error in dialog
      setModificationTestResult({
        execution_id: '',
        test_case_id: modifiedTestCase.id,
        status: 'failed',
        steps: [],
        total_duration_ms: 0,
        screenshots: [],
        started_at: new Date().toISOString(),
        error: error.message || 'Failed to execute test'
      });
      setIsModificationConfirmationOpen(true);
    } finally {
      setIsTestingModification(false);
    }
  };

  // Handle accepting modification after successful test
  const handleAcceptModification = async () => {
    if (!pendingModification) return;
    
    try {
      const updated = await updateTestCase(testCase.id, pendingModification);
      setIsModificationConfirmationOpen(false);
      setPendingModification(null);
      setModificationTestResult(null);
      setIsChatbotOpen(false);
      
      // Notify parent component of update
      if (onTestCaseUpdated) {
        onTestCaseUpdated(updated);
      } else {
        // Fallback: reload page if no callback provided
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Failed to update test case:', error);
      alert(`Failed to update test case: ${error.message}`);
    }
  };

  // Handle rejecting modification
  const handleRejectModification = () => {
    setPendingModification(null);
    setModificationTestResult(null);
    setIsModificationConfirmationOpen(false);
    // Keep chatbot open so user can try again
  };

  // Handle try again - allow user to modify further
  const handleTryAgain = () => {
    setModificationTestResult(null);
    setIsModificationConfirmationOpen(false);
    // Keep chatbot open and pending modification so user can modify further
  };

  // Legacy handler for non-testing modifications (backwards compatibility)
  const handleTestModified = async (modifiedTestCase: TestCase) => {
    // This is for non-testing flows - just apply directly
    try {
      const updated = await updateTestCase(testCase.id, modifiedTestCase);
      setIsChatbotOpen(false);
      if (onTestCaseUpdated) {
        onTestCaseUpdated(updated);
      } else {
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Failed to update test case:', error);
      alert(`Failed to update test case: ${error.message}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Execution Controls */}
      <ExecutionControls
        isRunning={isRunning}
        onStop={onStop}
        headless={headless}
        onHeadlessChange={onHeadlessChange}
      />

      {/* Main Layout */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Three-Pane Layout */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Pane: Test Steps */}
          <div className="w-full lg:w-80 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200">
            <TestStepsList
              steps={steps}
              testSteps={testCase.steps}
              stepUpdates={stepUpdates}
              currentStepIndex={currentStepIndex ?? localCurrentStepIndex}
              onStepClick={setSelectedStepIndex}
              onStepFix={handleStepFix}
            />
          </div>

          {/* Center Pane: Test Details */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-3 sm:p-4 md:p-6">
          <div className={!headless ? "w-full" : "max-w-4xl mx-auto"}>
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 break-words">
                {testCase.name}
              </h2>
              <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4 break-words">{testCase.description}</p>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                <span className="break-all">Website: {testCase.website_url}</span>
                <span className="hidden sm:inline">•</span>
                <span>{testCase.steps.length} steps</span>
                {executionResult && (
                  <>
                    <span className="hidden sm:inline">•</span>
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
              <div className={`grid gap-3 sm:gap-4 mb-4 sm:mb-6 ${!headless ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
                <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-gray-600">Total Duration</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mt-1 break-words">
                    {executionResult.total_duration_ms}ms
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-gray-600">Steps Passed</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600 mt-1">
                    {executionResult.steps.filter((s) => s.success).length}
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-gray-600">Steps Failed</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 mt-1">
                    {executionResult.steps.filter((s) => s.success === false).length}
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-gray-600">Screenshots</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mt-1">
                    {executionResult.screenshots?.length || 0}
                  </div>
                </div>
              </div>
            )}

            {/* Selected Step Details */}
            {selectedStepIndex !== undefined && steps[selectedStepIndex] && (
              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
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
                    <div className="mb-4">
                      <span className="text-xs sm:text-sm font-medium text-gray-600">Selector Used:</span>
                      <div className="mt-1 text-xs sm:text-sm p-2 rounded bg-green-50 border border-green-200">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-green-600 font-bold flex-shrink-0">✅</span>
                          <span className="text-green-700 font-medium break-all">
                            {steps[selectedStepIndex].selector_used.type} = "{steps[selectedStepIndex].selector_used.value}"
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Selector Attempts History */}
                  {steps[selectedStepIndex].attempted_selectors && steps[selectedStepIndex].attempted_selectors.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-xs sm:text-sm font-medium text-gray-600 mb-2">Selector Attempts:</div>
                      <div className="space-y-2">
                        {(() => {
                          // Deduplicate selectors by type and value
                          const uniqueSelectors = new Map<string, any>();
                          steps[selectedStepIndex].attempted_selectors?.forEach((selector: any) => {
                            const key = `${selector.type}:${selector.value}`;
                            if (!uniqueSelectors.has(key)) {
                              uniqueSelectors.set(key, selector);
                            } else {
                              // Keep the one with higher stability score if available
                              const existing = uniqueSelectors.get(key);
                              if (selector.stability_score && (!existing.stability_score || selector.stability_score > existing.stability_score)) {
                                uniqueSelectors.set(key, selector);
                              }
                            }
                          });

                          // Convert to array and sort: used first, then by stability score (highest first)
                          const sortedSelectors = Array.from(uniqueSelectors.values()).sort((a, b) => {
                            const isAUsed = steps[selectedStepIndex].selector_used?.type === a.type && 
                                           steps[selectedStepIndex].selector_used?.value === a.value;
                            const isBUsed = steps[selectedStepIndex].selector_used?.type === b.type && 
                                           steps[selectedStepIndex].selector_used?.value === b.value;
                            
                            // Used selectors come first
                            if (isAUsed && !isBUsed) return -1;
                            if (!isAUsed && isBUsed) return 1;
                            
                            // Then sort by stability score (highest first)
                            const scoreA = a.stability_score || 0;
                            const scoreB = b.stability_score || 0;
                            return scoreB - scoreA;
                          });

                          return sortedSelectors.map((selector: any, idx: number) => {
                            const isUsed = steps[selectedStepIndex].selector_used?.type === selector.type && 
                                           steps[selectedStepIndex].selector_used?.value === selector.value;
                            return (
                              <div key={`${selector.type}-${selector.value}-${idx}`} className={`text-xs p-2 rounded ${isUsed ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="flex-shrink-0">
                                    {isUsed ? (
                                      <span className="text-green-600 font-bold">✅</span>
                                    ) : (
                                      <span className="text-gray-400">○</span>
                                    )}
                                  </span>
                                  <span className={`flex-1 min-w-0 ${isUsed ? 'text-green-700 font-medium' : 'text-gray-700'}`}>
                                    {idx + 1}. {selector.type} = "<span className="break-all">{selector.value}</span>"
                                  </span>
                                  {selector.stability_score && (
                                    <span className="text-xs text-gray-500 flex-shrink-0">
                                      Stability: {(selector.stability_score * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Recovery Information */}
                  {stepUpdates?.get(selectedStepIndex)?.recoveryStart && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-xs sm:text-sm font-medium text-blue-600 mb-2">🔄 Recovery Information:</div>
                      <div className="space-y-2 text-xs sm:text-sm text-gray-700">
                        <div className="break-words">
                          <span className="font-medium">Reason:</span> {stepUpdates.get(selectedStepIndex)!.recoveryStart!.reason}
                        </div>
                        {stepUpdates.get(selectedStepIndex)!.recoveryStart!.attemptedSelectors.length > 0 && (
                          <div>
                            <span className="font-medium">Attempted Selectors:</span> {stepUpdates.get(selectedStepIndex)!.recoveryStart!.attemptedSelectors.length}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {stepUpdates?.get(selectedStepIndex)?.recoverySuccess && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-xs sm:text-sm font-medium text-green-600 mb-2">✅ Recovery Success:</div>
                      <div className="space-y-2 text-xs sm:text-sm text-gray-700">
                        <div className="break-words">
                          <span className="font-medium">Successful Selector:</span>{' '}
                          {stepUpdates.get(selectedStepIndex)!.recoverySuccess!.successfulSelector.type} = "<span className="break-all">{stepUpdates.get(selectedStepIndex)!.recoverySuccess!.successfulSelector.value}</span>"
                        </div>
                        <div className="break-words">
                          <span className="font-medium">Strategy:</span> {stepUpdates.get(selectedStepIndex)!.recoverySuccess!.strategyUsed}
                        </div>
                      </div>
                    </div>
                  )}

                  {steps[selectedStepIndex].failure_analysis && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-xs sm:text-sm font-medium text-gray-600 mb-2">Failure Analysis:</div>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs font-medium text-gray-500">Category:</span>
                          <span className="ml-2 text-xs sm:text-sm text-gray-700 capitalize break-words">
                            {steps[selectedStepIndex].failure_analysis.category.replace('_', ' ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500">Type:</span>
                          <span className={`ml-2 text-xs sm:text-sm font-medium break-words ${
                            steps[selectedStepIndex].failure_analysis.isSystemFailure
                              ? 'text-blue-600'
                              : 'text-red-600'
                          }`}>
                            {steps[selectedStepIndex].failure_analysis.isSystemFailure
                              ? 'System Failure (our fault)'
                              : 'Application Bug (developer fix needed)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500">Confidence:</span>
                          <span className="ml-2 text-xs sm:text-sm text-gray-700">
                            {(steps[selectedStepIndex].failure_analysis.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-gray-500">Reason:</span>
                          <p className="mt-1 text-xs sm:text-sm text-gray-700 break-words">
                            {steps[selectedStepIndex].failure_analysis.reason}
                          </p>
                        </div>
                        {steps[selectedStepIndex].failure_analysis.suggestedActions && 
                         steps[selectedStepIndex].failure_analysis.suggestedActions.length > 0 && (
                          <div>
                            <span className="text-xs font-medium text-gray-500">Suggested Actions:</span>
                            <ul className="mt-1 text-sm text-gray-700 list-disc list-inside">
                              {steps[selectedStepIndex].failure_analysis.suggestedActions.map((action: string, idx: number) => (
                                <li key={idx}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {steps[selectedStepIndex].failure_analysis.recoveryAttempted && (
                          <div>
                            <span className="text-xs font-medium text-gray-500">Recovery:</span>
                            <span className={`ml-2 text-sm font-medium ${
                              steps[selectedStepIndex].failure_analysis.recoverySuccess
                                ? 'text-green-600'
                                : 'text-orange-600'
                            }`}>
                              {steps[selectedStepIndex].failure_analysis.recoverySuccess
                                ? 'Recovery attempted and succeeded'
                                : 'Recovery attempted but failed'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

          {/* Right Pane: Browser Preview (only when not headless) */}
          {!headless && (
            <div className="w-full lg:w-1/2 flex-shrink-0 border-l border-gray-200 min-w-0">
              <BrowserPreview
                imageUrl={currentFrame?.imageUrl}
                url={currentFrame?.url || testCase.website_url}
                isLoading={!isConnected && !currentFrame && !streamError}
                error={streamError || undefined}
                frameHistory={frameHistory}
                currentStepIndex={currentStepIndex}
                currentFrameIndex={currentFrameIndex}
                onGoToStep={goToStep}
                onGoToNextFrame={goToNextFrame}
                onGoToPrevFrame={goToPrevFrame}
                onGoToFirstFrame={goToFirstFrame}
                onGoToLastFrame={goToLastFrame}
                getTotalFrames={getTotalFrames}
                getCurrentFramePosition={getCurrentFramePosition}
              />
            </div>
          )}
        </div>
        
        {/* Bottom Pane: Agent Activity Panel */}
        <div className="h-64 flex-shrink-0 border-t border-gray-200">
          <AgentActivityPanel
            messages={agentMessages}
            currentStepIndex={currentStepIndex ?? localCurrentStepIndex}
          />
        </div>
      </div>

      {/* Chatbot for step fixes */}
      {isChatbotOpen && chatbotContext && (
        <TestAutomationChatbot
          isOpen={isChatbotOpen}
          onClose={() => setIsChatbotOpen(false)}
          context={chatbotContext}
          onTestModified={handleTestModified}
          onTestModificationRequested={handleTestModificationRequested}
        />
      )}

      {/* Test Modification Confirmation Dialog */}
      {pendingModification && (
        <TestModificationConfirmationDialog
          isOpen={isModificationConfirmationOpen}
          testResult={modificationTestResult}
          originalTestCase={testCase}
          modifiedTestCase={pendingModification}
          onAccept={handleAcceptModification}
          onReject={handleRejectModification}
          onTryAgain={handleTryAgain}
        />
      )}

      {/* Chatbot for debugging - auto-open on failures or ambiguous failures */}
      {!isChatbotOpen && executionResult && (
        (() => {
          const failedStep = executionResult.steps.find((s: StepResult) => s.success === false);
          const failureAnalysis = failedStep?.failure_analysis;
          const shouldAutoOpen = executionResult.status === 'failed' && 
            failureAnalysis && 
            failureAnalysis.confidence < 0.7; // Auto-open on ambiguous failures
          
          return (
            <TestAutomationChatbot
              autoOpen={shouldAutoOpen}
              context={{
                test_case_id: testCase.id,
                execution_id: executionResult.execution_id,
                test_case: testCase,
                execution_result: executionResult,
                failure_analysis: failureAnalysis,
                step: failedStep ? testCase.steps.find(s => s.id === failedStep.step_id) : undefined,
                page_state: failedStep?.page_state
              }}
            />
          );
        })()
      )}
      
      {/* Always available chatbot button when no execution or execution not failed and not fixing step */}
      {!isChatbotOpen && (!executionResult || executionResult.status !== 'failed') && (
        <TestAutomationChatbot
          context={{
            test_case_id: testCase.id,
            execution_id: executionResult?.execution_id,
            test_case: testCase,
            execution_result: executionResult
          }}
        />
      )}
    </div>
  );
};

