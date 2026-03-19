import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiArrowLeft, FiClock, FiCheckCircle, FiXCircle, FiAlertCircle, FiSquare } from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { Alert } from '../components/common/Alert';
import { TestStepsList } from '../components/TestRunner/TestStepsList';
import { getExecutionById, getTestCases, stopExecution } from '../services/api';
import { useToastContext } from '../contexts/ToastContext';
import { formatRelativeTime, formatAbsoluteTime } from '../utils/dateFormat';
import type { ExecutionResult, TestCase } from '../types';

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
};

export const TestRunDetailPage: React.FC = () => {
  const { executionId } = useParams<{ executionId: string }>();
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleStopExecution = async () => {
    if (!executionId) return;
    try {
      await stopExecution(executionId);
      success('Test execution stopped successfully');
      // Refresh execution data
      const updated = await getExecutionById(executionId);
      setExecution(updated);
    } catch (err: any) {
      showError(err.response?.data?.error || err.message || 'Failed to stop execution');
    }
  };

  useEffect(() => {
    if (!executionId) {
      setError('Execution ID is required');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const executionData = await getExecutionById(executionId);
        setExecution(executionData);

        // Fetch test case if we have test_case_id
        if (executionData.test_case_id) {
          try {
            const testCasesResponse = await getTestCases();
            const foundTestCase = testCasesResponse.test_cases.find(tc => tc.id === executionData.test_case_id);
            if (foundTestCase) {
              setTestCase(foundTestCase);
            }
          } catch (err) {
            // Test case fetch is optional, continue without it
            console.warn('Could not fetch test case:', err);
          }
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Execution not found');
        } else {
          setError(err.response?.data?.error || err.message || 'Failed to fetch execution details');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [executionId]);

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <SkeletonLoader width="w-64" height="h-8" className="mb-2" />
          <SkeletonLoader width="w-96" height="h-4" />
        </div>
        <Card className="p-6">
          <SkeletonLoader width="w-full" height="h-32" />
        </Card>
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div>
        <div className="mb-6">
          <Link
            to="/test-runs"
            className="inline-flex items-center text-primary-600 hover:text-primary-300 mb-4"
          >
            <FiArrowLeft className="mr-2" />
            Back to Test Runs
          </Link>
        </div>
        <Alert
          type="error"
          message={error || 'Execution not found'}
          actions={[
            {
              label: 'Go Back',
              onClick: () => navigate('/test-runs'),
              variant: 'primary',
            },
          ]}
        />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, 'success' | 'error' | 'running' | 'pending'> = {
      completed: 'success',
      failed: 'error',
      running: 'running',
      timeout: 'error',
      paused: 'pending',
      cancelled: 'pending',
    };
    
    const badgeStatus = statusMap[status] || 'pending';
    return (
      <StatusBadge
        status={badgeStatus}
        pulse={status === 'running'}
        size="md"
      />
    );
  };

  const passedSteps = execution.steps.filter(s => s.success).length;
  const failedSteps = execution.steps.filter(s => s.success === false).length;
  const totalSteps = execution.steps.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/test-runs"
          className="inline-flex items-center text-primary-600 hover:text-primary-300 mb-4"
        >
          <FiArrowLeft className="mr-2" />
          Back to Test Runs
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Execution Details</h1>
            <p className="text-slate-400 mt-1">
              {testCase ? testCase.name : `Execution ${execution.execution_id.substring(0, 8)}`}
            </p>
          </div>
          {execution.status === 'running' && (
            <button
              onClick={handleStopExecution}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <FiSquare className="h-4 w-4" />
              <span>Stop Test</span>
            </button>
          )}
        </div>
      </div>

      {/* Execution Metadata */}
      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Status</div>
            <div className="flex items-center gap-2">
              {getStatusBadge(execution.status)}
              <span className="text-lg font-semibold text-white capitalize">{execution.status}</span>
            </div>
          </div>
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Duration</div>
            <div className="text-lg font-semibold text-white">
              {formatDuration(execution.total_duration_ms)}
            </div>
          </div>
          <div className="bg-slate-900 rounded-lg p-4">
            <div className="text-sm text-slate-400 mb-1">Started</div>
            <div className="text-sm font-medium text-white" title={formatAbsoluteTime(execution.started_at)}>
              {formatRelativeTime(execution.started_at)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {formatAbsoluteTime(execution.started_at)}
            </div>
          </div>
          {execution.completed_at && (
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="text-sm text-slate-400 mb-1">Completed</div>
              <div className="text-sm font-medium text-white" title={formatAbsoluteTime(execution.completed_at)}>
                {formatRelativeTime(execution.completed_at)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {formatAbsoluteTime(execution.completed_at)}
              </div>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-900/20 rounded-lg p-4 border border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-green-700 font-medium">Steps Passed</div>
                <div className="text-2xl font-bold text-green-900 mt-1">{passedSteps}</div>
              </div>
              <FiCheckCircle className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </div>
          <div className="bg-red-900/20 rounded-lg p-4 border border-red-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-red-700 font-medium">Steps Failed</div>
                <div className="text-2xl font-bold text-red-900 mt-1">{failedSteps}</div>
              </div>
              <FiXCircle className="h-8 w-8 text-red-600 opacity-50" />
            </div>
          </div>
          <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-blue-700 font-medium">Total Steps</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">{totalSteps}</div>
              </div>
              <FiClock className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {execution.error && (
          <Alert
            type="error"
            title="Execution Error"
            message={execution.error}
            className="mb-0"
          />
        )}
      </Card>

      {/* Test Case Info */}
      {testCase && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Test Case</h2>
          <div>
            <div className="font-medium text-white mb-1">{testCase.name}</div>
            {testCase.description && (
              <div className="text-sm text-slate-400">{testCase.description}</div>
            )}
            {testCase.website_url && (
              <div className="text-sm text-slate-400 mt-2">
                <span className="font-medium">URL:</span> {testCase.website_url}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Step Results */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Step-by-Step Results</h2>
        {execution.steps.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            No steps recorded for this execution
          </div>
        ) : (
          <TestStepsList
            steps={execution.steps}
            testSteps={testCase?.steps}
            onStepClick={() => {}}
          />
        )}
      </Card>
    </div>
  );
};
