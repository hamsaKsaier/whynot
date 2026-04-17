import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('results');
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
      success(t('results.testRuns.stopped'));
      // Refresh execution data
      const updated = await getExecutionById(executionId);
      setExecution(updated);
    } catch (err: any) {
      showError(err.response?.data?.error || err.message || t('results.testRuns.stopError'));
    }
  };

  useEffect(() => {
    if (!executionId) {
      setError(t('results.testRunDetail.executionIdRequired'));
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
          setError(t('results.testRunDetail.notFound'));
        } else {
          setError(err.response?.data?.error || err.message || t('results.testRunDetail.fetchError'));
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
            {t('results.testRunDetail.backToTestRuns')}
          </Link>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('results.testRunDetail.error')}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error || t('results.testRunDetail.notFound')}</span>
            <Button variant="outline" size="sm" onClick={() => navigate('/test-runs')}>
              {t('results.testRunDetail.goBack')}
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
      <div className="mb-4 sm:mb-6">
        <Link
          to="/test-runs"
          className="inline-flex items-center text-primary hover:text-primary/80 mb-3 sm:mb-4 transition-colors duration-150 text-sm"
        >
          <ArrowLeft className="me-1.5 sm:me-2 h-4 w-4 rtl:scale-x-[-1]" />
          {t('results.testRunDetail.backToTestRuns')}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{t('results.testRunDetail.title')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 truncate">
              {testCase ? testCase.name : t('results.testRuns.execution', { id: execution.execution_id.substring(0, 8) })}
            </p>
          </div>
          {execution.status === 'running' && (
            <Button variant="destructive" onClick={handleStopExecution} className="w-full sm:w-auto shrink-0">
              <Square className="h-4 w-4 me-2" />
              {t('results.testRunDetail.stopTest')}
            </Button>
          )}
        </div>
      </div>

      {/* Execution Metadata */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-muted rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-muted-foreground mb-1">{t('results.testRunDetail.status')}</div>
              <div className="flex items-center gap-2">
                {getStatusBadge(execution.status)}
                <span className="text-base sm:text-lg font-semibold text-foreground capitalize hidden sm:inline">{execution.status}</span>
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-muted-foreground mb-1">{t('results.duration')}</div>
              <div className="text-base sm:text-lg font-semibold text-foreground">
                {formatDuration(execution.total_duration_ms)}
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3 sm:p-4">
              <div className="text-xs sm:text-sm text-muted-foreground mb-1">{t('results.startedAt')}</div>
              <div className="text-xs sm:text-sm font-medium text-foreground" title={formatAbsoluteTime(execution.started_at)}>
                {formatRelativeTime(execution.started_at)}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">
                {formatAbsoluteTime(execution.started_at)}
              </div>
            </div>
            {execution.completed_at && (
              <div className="bg-muted rounded-lg p-3 sm:p-4">
                <div className="text-xs sm:text-sm text-muted-foreground mb-1">{t('results.completedAt')}</div>
                <div className="text-xs sm:text-sm font-medium text-foreground" title={formatAbsoluteTime(execution.completed_at)}>
                  {formatRelativeTime(execution.completed_at)}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">
                  {formatAbsoluteTime(execution.completed_at)}
                </div>
              </div>
            )}
          </div>

          <Separator className="mb-4 sm:mb-6" />

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <Card className="border-green-800/50 bg-green-900/10">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-sm text-green-400 font-medium truncate">{t('results.testRunDetail.stepsPassed')}</div>
                    <div className="text-lg sm:text-2xl font-bold text-green-300 mt-1">{passedSteps}</div>
                  </div>
                  <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 opacity-50 hidden sm:block shrink-0" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-destructive/50 bg-destructive/10">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-sm text-red-400 font-medium truncate">{t('results.testRunDetail.stepsFailed')}</div>
                    <div className="text-lg sm:text-2xl font-bold text-red-300 mt-1">{failedSteps}</div>
                  </div>
                  <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 opacity-50 hidden sm:block shrink-0" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-800/50 bg-blue-900/10">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-sm text-blue-400 font-medium truncate">{t('results.testRunDetail.totalSteps')}</div>
                    <div className="text-lg sm:text-2xl font-bold text-blue-300 mt-1">{totalSteps}</div>
                  </div>
                  <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 opacity-50 hidden sm:block shrink-0" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Message */}
          {execution.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('results.testRunDetail.executionError')}</AlertTitle>
              <AlertDescription>{execution.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Test Case Info */}
      {testCase && (
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg">{t('results.testRunDetail.testCase')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <div className="font-medium text-foreground mb-1 text-sm sm:text-base break-words">{testCase.name}</div>
              {testCase.description && (
                <div className="text-xs sm:text-sm text-muted-foreground break-words">{testCase.description}</div>
              )}
              {testCase.website_url && (
                <div className="text-xs sm:text-sm text-muted-foreground mt-2 break-all">
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
          <CardTitle className="text-lg">{t('results.testRunDetail.stepByStepResults')}</CardTitle>
        </CardHeader>
        <CardContent>
          {execution.steps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('results.testRunDetail.noSteps')}
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
