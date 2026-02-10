import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TestInputForm } from '../components/TestRunner/TestInputForm';
import { TestGenerationView } from '../components/TestRunner/TestGenerationView';
import { TestExecutionView } from '../components/TestRunner/TestExecutionView';
import { TestAutomationChatbot } from '../components/Chatbot/TestAutomationChatbot';
import { TestModificationConfirmationDialog } from '../components/common/TestModificationConfirmationDialog';
import { Alert } from '../components/common/Alert';
import { OnboardingFlow } from '../components/Onboarding/OnboardingFlow';
import { useOnboarding } from '../hooks/useOnboarding';
import { useToastContext } from '../contexts/ToastContext';
import { TestGenerationLoader } from '../components/common/TestGenerationLoader';
import { StatsCard } from '../components/common/StatsCard';
import { SuccessAnimation } from '../components/common/SuccessAnimation';
import {
  generateTestsWithContext,
  runTest,
  executeTest,
  deleteTestCase,
  updateTestCase,
  getTestCases,
} from '../services/api';
import { FiCheckCircle, FiPlay, FiTrendingUp, FiActivity } from 'react-icons/fi';
import type { TestCase, ExecutionResult, RunTestResponse, TestStep, ValidationSummary, ValidationResult } from '../types';
import type { ChatContext } from '../services/chatbot-api';
import type { PrerequisiteStep } from '../utils/createEditFlow';

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
  const { isCompleted, isLoading: onboardingLoading } = useOnboarding();
  const { success, error: showError, info } = useToastContext();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | undefined>();
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
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
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Statistics state
  const [stats, setStats] = useState({
    totalTestCases: 0,
    totalTestRuns: 0,
    successRate: 0,
    recentActivity: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Initial values from navigation state
  const [initialProjectId, setInitialProjectId] = useState<string | undefined>();
  const [initialUserStoryId, setInitialUserStoryId] = useState<string | undefined>();
  const [initialWebsiteUrl, setInitialWebsiteUrl] = useState<string | undefined>();

  // Fetch statistics
  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    setLoadingStats(true);
    try {
      const testCasesResponse = await getTestCases();
      const totalTestCases = testCasesResponse.test_cases.length;

      // Calculate success rate from test cases (simplified - in real app, would fetch from executions)
      const successfulTests = testCasesResponse.test_cases.filter(
        (tc) => (tc as TestCase & { validation_summary?: { overall_status?: string } }).validation_summary?.overall_status === 'passed'
      ).length;
      const successRate = totalTestCases > 0 ? (successfulTests / totalTestCases) * 100 : 0;

      setStats({
        totalTestCases,
        totalTestRuns: 0, // Would fetch from executions API
        successRate: Math.round(successRate),
        recentActivity: 0, // Would calculate from recent executions
      });
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Show onboarding for first-time users
  useEffect(() => {
    if (!onboardingLoading && !isCompleted) {
      setShowOnboarding(true);
    }
  }, [onboardingLoading, isCompleted]);

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
    userStoryId?: string,
    prerequisiteSteps?: PrerequisiteStep[],
    quickMode?: boolean
  ) => {
    setIsGenerating(true);
    setError(null);
    setTestCases([]);
    setExecutionResult(null);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/af9684ef-fcb7-4ff5-bebb-77681f86059c', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'HomePage.tsx:handleGenerateTests', message: 'Quick mode value before API call', data: { quickMode, quickModeType: typeof quickMode, booleanQuickMode: Boolean(quickMode) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
    // #endregion
    try {
      const response = await generateTestsWithContext({
        website_url: websiteUrl,
        user_story: userStory,
        project_id: projectId,
        user_story_id: userStoryId,
        prerequisite_steps: prerequisiteSteps && prerequisiteSteps.length > 0 ? prerequisiteSteps : undefined,
        quick_mode: Boolean(quickMode),
      });
      setTestCases(response.test_cases);

      // Show validation feedback
      if (response.validation_summary) {
        const { valid, invalid, warnings } = response.validation_summary;
        if (invalid > 0) {
          const errorMsg = `${invalid} test case(s) have validation errors. Please review and fix them.`;
          setError(errorMsg);
          showError(errorMsg);
        } else if (warnings > 0) {
          info(`${warnings} validation warning(s) found`);
        } else if (valid > 0) {
          success(`Successfully generated ${valid} test case(s)`);
        }
      } else {
        success(`Successfully generated ${response.test_cases.length} test case(s)`);
      }
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
      setModificationTestResult(
        testResult && 'steps' in testResult && Array.isArray(testResult.steps)
          ? (testResult as ExecutionResult)
          : null
      );
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
      success('Test case updated successfully');
    } catch (error: any) {
      console.error('Failed to update test case:', error);
      const errorMsg = `Failed to update test case: ${error.message || 'Unknown error'}`;
      setError(errorMsg);
      showError(errorMsg);
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
      {/* Success Animation */}
      {showSuccessAnimation && (
        <SuccessAnimation
          message={successMessage}
          onComplete={() => {
            setShowSuccessAnimation(false);
            setSuccessMessage('');
          }}
        />
      )}

      {/* Statistics Dashboard */}
      {!showOnboarding && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Test Cases"
              value={loadingStats ? '...' : stats.totalTestCases}
              icon={<FiCheckCircle className="h-6 w-6" />}
              onClick={() => window.location.href = '/test-cases'}
            />
            <StatsCard
              title="Test Runs"
              value={loadingStats ? '...' : stats.totalTestRuns}
              icon={<FiPlay className="h-6 w-6" />}
              onClick={() => window.location.href = '/test-runs'}
            />
            <StatsCard
              title="Success Rate"
              value={loadingStats ? '...' : `${stats.successRate}%`}
              icon={<FiTrendingUp className="h-6 w-6" />}
              trend={stats.successRate >= 80 ? 'up' : stats.successRate >= 50 ? 'neutral' : 'down'}
            />
            <StatsCard
              title="Recent Activity"
              value={loadingStats ? '...' : stats.recentActivity}
              icon={<FiActivity className="h-6 w-6" />}
            />
          </div>
        </div>
      )}

      {/* Onboarding Flow */}
      {showOnboarding && (
        <OnboardingFlow
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      {error && (
        <Alert
          type="error"
          title="Error"
          message={error}
          suggestions={
            error.includes('generate') || error.includes('test case')
              ? [
                'Your user story might be too vague or unclear',
                'The website URL might be inaccessible or invalid',
                'There might be a network connectivity issue',
                'Check that your API keys are configured correctly',
              ]
              : error.includes('execute') || error.includes('run')
                ? [
                  'The website might be temporarily unavailable',
                  'The test case might have invalid selectors',
                  'Check your browser console for more details',
                  'Try running the test in headless mode',
                ]
                : []
          }
          actions={[
            {
              label: 'Try Again',
              onClick: () => {
                setError(null);
                // Retry last action if possible
                if (isGenerating) {
                  // Could store last params and retry
                }
              },
              variant: 'primary',
            },
            {
              label: 'Dismiss',
              onClick: () => setError(null),
              variant: 'secondary',
            },
          ]}
          onClose={() => setError(null)}
        />
      )}

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
            <TestGenerationLoader
              message="Creating intelligent test cases from your user story..."
            />
          )}

          {testCases.length > 0 && !isRunning && (
            <TestGenerationView
              testCases={testCases}
              validationSummary={validationSummary}
              validationResults={validationResults}
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
