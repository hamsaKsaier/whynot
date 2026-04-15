import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, Square } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import { Separator } from '../components/ui/separator';
import { cn } from '../lib/utils';
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
          <Skeleton className="w-64 h-8 mb-2" />
          <Skeleton className="w-96 h-4" />
        </div>
        <Card className="p-6">
          <Skeleton className="w-full h-32" />
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
            className="inline-flex items-center text-primary hover:text-primary/80 mb-4 transition-colors duration-150"
          >
            <ArrowLeft className="me-2 h-4 w-4 rtl:scale-x-[-1]" />
            Back to Test Runs
          </Link>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error || 'Execution not found'}</span>
            <Button variant="outline" size="sm" onClick={() => navigate('/test-runs')}>
              Go Back
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
      completed: { variant: 'outline', className: 'border-green-700 bg-green-900/20 text-green-300' },
      failed:    { variant: 'destructive' },
      running:   { variant: 'outline', className: 'border-blue-700 bg-blue-900/20 text-blue-300' },
      timeout:   { variant: 'destructive' },
      paused:    { variant: 'secondary' },
      cancelled: { variant: 'secondary' },
    };
    const info = map[status] || map.cancelled;
    return (
      <Badge variant={info.variant} className={info.className}>
        {status}
      </Badge>
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
          className="inline-flex items-center text-primary hover:text-primary/80 mb-4 transition-colors duration-150"
        >
          <ArrowLeft className="me-2 h-4 w-4 rtl:scale-x-[-1]" />
          Back to Test Runs
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Execution Details</h1>
            <p className="text-muted-foreground mt-1">
              {testCase ? testCase.name : `Execution ${execution.execution_id.substring(0, 8)}`}
            </p>
          </div>
          {execution.status === 'running' && (
            <Button variant="destructive" onClick={handleStopExecution}>
              <Square className="h-4 w-4 me-2" />
              Stop Test
            </Button>
          )}
        </div>
      </div>

      {/* Execution Metadata */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <div className="flex items-center gap-2">
                {getStatusBadge(execution.status)}
                <span className="text-lg font-semibold text-foreground capitalize">{execution.status}</span>
              </div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Duration</div>
              <div className="text-lg font-semibold text-foreground">
                {formatDuration(execution.total_duration_ms)}
              </div>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">Started</div>
              <div className="text-sm font-medium text-foreground" title={formatAbsoluteTime(execution.started_at)}>
                {formatRelativeTime(execution.started_at)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatAbsoluteTime(execution.started_at)}
              </div>
            </div>
            {execution.completed_at && (
              <div className="bg-muted rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Completed</div>
                <div className="text-sm font-medium text-foreground" title={formatAbsoluteTime(execution.completed_at)}>
                  {formatRelativeTime(execution.completed_at)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatAbsoluteTime(execution.completed_at)}
                </div>
              </div>
            )}
          </div>

          <Separator className="mb-6" />

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-green-800/50 bg-green-900/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-green-400 font-medium">Steps Passed</div>
                    <div className="text-2xl font-bold text-green-300 mt-1">{passedSteps}</div>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-destructive/50 bg-destructive/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-red-400 font-medium">Steps Failed</div>
                    <div className="text-2xl font-bold text-red-300 mt-1">{failedSteps}</div>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-800/50 bg-blue-900/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-blue-400 font-medium">Total Steps</div>
                    <div className="text-2xl font-bold text-blue-300 mt-1">{totalSteps}</div>
                  </div>
                  <Clock className="h-8 w-8 text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Message */}
          {execution.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Execution Error</AlertTitle>
              <AlertDescription>{execution.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Test Case Info */}
      {testCase && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Test Case</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <div className="font-medium text-foreground mb-1">{testCase.name}</div>
              {testCase.description && (
                <div className="text-sm text-muted-foreground">{testCase.description}</div>
              )}
              {testCase.website_url && (
                <div className="text-sm text-muted-foreground mt-2">
                  <span className="font-medium">URL:</span> {testCase.website_url}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step-by-Step Results</CardTitle>
        </CardHeader>
        <CardContent>
          {execution.steps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No steps recorded for this execution
            </div>
          ) : (
            <TestStepsList
              steps={execution.steps}
              testSteps={testCase?.steps}
              onStepClick={() => {}}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
