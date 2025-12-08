import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TestInputForm } from '../components/TestRunner/TestInputForm';
import { TestGenerationView } from '../components/TestRunner/TestGenerationView';
import { TestExecutionView } from '../components/TestRunner/TestExecutionView';
import { Alert } from '../components/common/Alert';
import { generateTests, runTest, executeTest, deleteTestCase } from '../services/api';
import type { TestCase, ExecutionResult, RunTestResponse } from '../types';

export const HomePage: React.FC = () => {
  const location = useLocation();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [headless, setHeadless] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle test case passed from TestCasesPage
  useEffect(() => {
    const state = location.state as { testCase?: TestCase; execute?: boolean; headless?: boolean } | null;
    if (state?.testCase && state?.execute) {
      const testCase = state.testCase;
      const headlessMode = state.headless || false;
      setHeadless(headlessMode);
      handleRunTestCase(testCase, headlessMode);
      // Clear the state to prevent re-execution on re-render
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleGenerateTests = async (websiteUrl: string, userStory: string) => {
    setIsGenerating(true);
    setError(null);
    setTestCases([]);
    setExecutionResult(null);

    try {
      const response = await generateTests({
        website_url: websiteUrl,
        user_story: userStory,
      });
      setTestCases(response.test_cases);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to generate tests');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunTest = async (websiteUrl: string, userStory: string, headless: boolean) => {
    setIsRunning(true);
    setError(null);
    setExecutionResult(null);

    try {
      const response: RunTestResponse = await runTest({
        website_url: websiteUrl,
        user_story: userStory,
        headless,
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
          started_at: new Date().toISOString()
        });
        
        // DON'T poll - WebSocket will provide the final result
        // Polling causes 404 errors because execution isn't in DB until test completes
        // WebSocket sends the final result directly, so polling is unnecessary
      } else {
        // Headless mode or completed result
        setExecutionResult(response);
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
      setTestCases(testCases.filter(tc => tc.id !== testCase.id));
      // If the deleted test case was selected, clear selection
      if (selectedTestCase?.id === testCase.id) {
        setSelectedTestCase(null);
        setExecutionResult(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete test case');
    }
  };

  // Show execution view when test is running or has results
  const showExecutionView = (isRunning || executionResult) && selectedTestCase;

  return (
    <div className="space-y-6">
      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {!showExecutionView && (
        <>
          <TestInputForm
            onGenerateTests={handleGenerateTests}
            onRunTest={handleRunTest}
            isLoading={isGenerating || isRunning}
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
        />
      )}
    </div>
  );
};





