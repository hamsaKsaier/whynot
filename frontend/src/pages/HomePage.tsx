import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TestInputForm } from '../components/TestRunner/TestInputForm';
import { TestGenerationView } from '../components/TestRunner/TestGenerationView';
import { TestExecutionView } from '../components/TestRunner/TestExecutionView';
import { TestAutomationChatbot } from '../components/Chatbot/TestAutomationChatbot';
import { TestModificationConfirmationDialog } from '../components/common/TestModificationConfirmationDialog';
import { Alert } from '../components/common/Alert';
import {
  generateTestsWithContext,
  runTest,
  executeTest,
  deleteTestCase,
  updateTestCase,
} from '../services/api';
import type { TestCase, ExecutionResult, RunTestResponse, TestStep } from '../types';
import type { ChatContext } from '../services/chatbot-api';

interface LocationState {
  testCase?: TestCase;
  execute?: boolean;
  headless?: boolean;
  projectId?: string;
  userStoryId?: string;
  websiteUrl?: string;
}

export const HomePage: React.FC = () => {
  const location = useLocation();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [headless, setHeadless] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [chatbotContext, setChatbotContext] = useState<ChatContext | undefined>();
  const [pendingModification, setPendingModification] = useState<TestCase | null>(null);
  const [modificationTestResult, setModificationTestResult] = useState<ExecutionResult | null>(null);
  const [isTestingModification, setIsTestingModification] = useState(false);
  const [isModificationConfirmationOpen, setIsModificationConfirmationOpen] = useState(false);

  // Initial values from navigation state
  const [initialProjectId, setInitialProjectId] = useState<string | undefined>();
  const [initialUserStoryId, setInitialUserStoryId] = useState<string | undefined>();
  const [initialWebsiteUrl, setInitialWebsiteUrl] = useState<string | undefined>();

  // Handle state passed from other pages
  useEffect(() => {
    const state = location.state as LocationState | null;

    if (state?.testCase && state?.execute) {
      // Execute existing test case
      const testCase = state.testCase;
      const headlessMode = state.headless || false;
      setHeadless(headlessMode);
      handleRunTestCase(testCase, headlessMode);
      window.history.replaceState({}, document.title);
    } else if (state?.projectId || state?.userStoryId) {
      // Pre-fill form with project/user story context
      setInitialProjectId(state.projectId);
      setInitialUserStoryId(state.userStoryId);
      setInitialWebsiteUrl(state.websiteUrl);
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleGenerateTests = async (
    websiteUrl: string,
    userStory: string,
    projectId?: string,
    userStoryId?: string
  ) => {
    setIsGenerating(true);
    setError(null);
    setTestCases([]);
    setExecutionResult(null);

    try {
      const response = await generateTestsWithContext({
        website_url: websiteUrl,
        user_story: userStory,
        project_id: projectId,
        user_story_id: userStoryId,
      });
      setTestCases(response.test_cases);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to generate tests');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunTest = async (
    websiteUrl: string,
    userStory: string,
    headlessMode: boolean,
    _projectId?: string,
    _userStoryId?: string
  ) => {
    setIsRunning(true);
    setError(null);
    setExecutionResult(null);

    try {
      const response: RunTestResponse = await runTest({
        website_url: websiteUrl,
        user_story: userStory,
        headless: headlessMode,
      });

      if (response.success && response.test_case && response.execution_result) {
        setSelectedTestCase(response.test_case);
        setExecutionResult(response.execution_result);
        setTestCases([response.test_case]);
      } else {
        setError(response.error || 'Test execution failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to run test');
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunTestCase = async (testCase: TestCase, headlessMode: boolean = false) => {
    setIsRunning(true);
    setError(null);
    setExecutionResult(null);
    setSelectedTestCase(testCase);
    setHeadless(headlessMode);

    try {
      const response = await executeTest(testCase, headlessMode);

      // For non-headless mode, backend returns executionId immediately
      // The test runs asynchronously, and we'll get updates via WebSocket
      if (!headlessMode && response.status === 'starting' && response.execution_id) {
        // Set a placeholder execution result so WebSocket can connect
        // Initialize steps from testCase so they show in the UI immediately
        setExecutionResult({
          execution_id: response.execution_id,
          test_case_id: testCase.id,
          status: 'running',
          steps: testCase.steps.map((step, index) => ({
            step_id: step.id || `step-${index}`,
            execution_time_ms: 0,
            element_found: false,
          })),
          total_duration_ms: 0,
          screenshots: [],
          started_at: new Date().toISOString(),
        });

        // DON'T poll - WebSocket will provide the final result
        // Polling causes 404 errors because execution isn't in DB until test completes
        // WebSocket sends the final result directly, so polling is unnecessary
      } else {
        // Headless mode or completed result
        // Type guard: check if response is ExecutionResult
        if ('execution_id' in response && 'status' in response && 'steps' in response) {
          setExecutionResult(response as ExecutionResult);
        } else {
          // If it's the other type, we can't use it as ExecutionResult
          setError('Unexpected response format from test execution');
        }
        setIsRunning(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to run test');
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    // Note: Actual stop functionality would need backend support
  };

  const handleDeleteTestCase = async (testCase: TestCase) => {
    try {
      await deleteTestCase(testCase.id);
      setTestCases(testCases.filter((tc) => tc.id !== testCase.id));
      // If the deleted test case was selected, clear selection
      if (selectedTestCase?.id === testCase.id) {
        setSelectedTestCase(null);
        setExecutionResult(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete test case');
    }
  };

  const handleStepFix = (testCase: TestCase, stepIndex: number, step: TestStep) => {
    setChatbotContext({
      test_case_id: testCase.id,
      test_case: testCase,
      execution_result: executionResult || undefined,
      step_index: stepIndex,
      step: step,
      operation: 'fix',
      step_id: step.id,
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
      const updated = await updateTestCase(pendingModification.id, pendingModification);
      setIsModificationConfirmationOpen(false);
      setPendingModification(null);
      setModificationTestResult(null);
      setIsChatbotOpen(false);
      
      // Update local state
      setTestCases(testCases.map(tc => tc.id === updated.id ? updated : tc));
      if (selectedTestCase?.id === updated.id) {
        setSelectedTestCase(updated);
      }
      setError(null);
    } catch (error: any) {
      console.error('Failed to update test case:', error);
      setError(`Failed to update test case: ${error.message || 'Unknown error'}`);
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
      const updated = await updateTestCase(modifiedTestCase.id, modifiedTestCase);
      setTestCases(testCases.map(tc => tc.id === updated.id ? updated : tc));
      if (selectedTestCase?.id === updated.id) {
        setSelectedTestCase(updated);
      }
      setIsChatbotOpen(false);
      setError(null);
    } catch (error: any) {
      console.error('Failed to update test case:', error);
      setError(`Failed to update test case: ${error.message || 'Unknown error'}`);
    }
  };

  // Show execution view when test is running or has results
  const showExecutionView = (isRunning || executionResult) && selectedTestCase;

  return (
    <div className="space-y-6">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {!showExecutionView && (
        <>
          <TestInputForm
            onGenerateTests={handleGenerateTests}
            onRunTest={handleRunTest}
            isLoading={isGenerating || isRunning}
            initialProjectId={initialProjectId}
            initialUserStoryId={initialUserStoryId}
            initialWebsiteUrl={initialWebsiteUrl}
          />

          {isGenerating && (
            <div className="card text-center py-8">
              <p className="text-gray-600">Generating test cases...</p>
            </div>
          )}

          {testCases.length > 0 && !isRunning && (
            <TestGenerationView
              testCases={testCases}
              onRunTest={(testCase) => handleRunTestCase(testCase, headless)}
              onDelete={handleDeleteTestCase}
              onStepFix={handleStepFix}
              isLoading={isRunning}
              headless={headless}
            />
          )}
        </>
      )}

      {showExecutionView && selectedTestCase && (
        <TestExecutionView
          testCase={selectedTestCase}
          executionResult={executionResult}
          isRunning={isRunning}
          headless={headless}
          onHeadlessChange={setHeadless}
          onStop={handleStop}
          onExecutionComplete={(result) => {
            setExecutionResult(result);
            setIsRunning(false);
            // WebSocket provided final result - no polling needed
            if (pollingIntervalRef.current) {
              clearTimeout(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }}
          onTestCaseUpdated={(updated) => {
            setSelectedTestCase(updated);
            setTestCases(testCases.map(tc => tc.id === updated.id ? updated : tc));
          }}
        />
      )}

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
          originalTestCase={chatbotContext?.test_case || selectedTestCase || testCases.find(tc => tc.id === pendingModification.id) || pendingModification}
          modifiedTestCase={pendingModification}
          onAccept={handleAcceptModification}
          onReject={handleRejectModification}
          onTryAgain={handleTryAgain}
        />
      )}
    </div>
  );
};
