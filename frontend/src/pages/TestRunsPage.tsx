import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Play, Activity, Square, Download } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Alert, AlertDescription } from '../components/ui/alert';
import { cn } from '../lib/utils';
import { formatRelativeTime, formatAbsoluteTime } from '../utils/dateFormat';
import { getExecutions, getExecutionById, stopExecution } from '../services/api';
import { useToastContext } from '../contexts/ToastContext';
import type { ExecutionResult } from '../types';

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
};

export const TestRunsContent: React.FC = () => <TestRunsPage embedded />;

export const TestRunsPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();
  const [executions, setExecutions] = useState<ExecutionResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'running'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchExecutions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getExecutions({
        offset,
        limit,
        status: filter !== 'all' ? filter : undefined,
        search: debouncedSearchTerm || undefined,
      });
      setExecutions(response.executions);
      setTotal(response.total);
    } catch (err: any) {
      const raw = err.response?.data?.error || err.message || '';
      // Never expose internal stack traces or function errors to the user
      const isTechnical = raw.includes('is not a function') || raw.includes('TypeError') || raw.includes('Cannot read') || raw.includes('undefined');
      setError(isTechnical ? 'Unable to load test runs. The service may still be starting up — please try again in a moment.' : raw || 'Failed to fetch test runs');
    } finally {
      setLoading(false);
    }
  };

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch when offset, filter, or debounced search changes
  useEffect(() => {
    fetchExecutions();
  }, [offset, filter, debouncedSearchTerm]);

  // Real-time updates for running tests
  useEffect(() => {
    const runningIds = executions
      .filter(e => e.status === 'running')
      .map(e => e.execution_id);

    if (runningIds.length === 0) return;

    const interval = setInterval(() => {
      runningIds.forEach(id => {
        getExecutionById(id)
          .then(updated => {
            setExecutions(prev => prev.map(e =>
              e.execution_id === id ? updated : e
            ));
          })
          .catch(() => {
            // Ignore errors for polling - execution might have completed
          });
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [executions]);

  const handleStopExecution = async (executionId: string) => {
    try {
      await stopExecution(executionId);
      success('Test execution stopped successfully');
      // Update local state optimistically
      setExecutions(prev => prev.map(e =>
        e.execution_id === executionId
          ? { ...e, status: 'cancelled' as const }
          : e
      ));
    } catch (err: any) {
      showError(err.response?.data?.error || err.message || 'Failed to stop execution');
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    const data = executions
      .filter(e => e && e.execution_id)
      .map(e => ({
        execution_id: e.execution_id,
        test_case_id: e.test_case_id || '',
        status: e.status || 'unknown',
        duration_ms: e.total_duration_ms || 0,
        duration_formatted: formatDuration(e.total_duration_ms || 0),
        steps_passed: e.steps?.filter(s => s.success).length || 0,
        steps_total: e.steps?.length || 0,
        started_at: e.started_at || '',
        completed_at: e.completed_at || '',
        error: e.error || '',
      }));

    if (format === 'csv') {
      const headers = Object.keys(data[0] || {});
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
          const value = row[header as keyof typeof row];
          return typeof value === 'string' && value.includes(',')
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `test-runs-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } else {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `test-runs-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
      completed: { variant: 'outline', className: 'border-green-700 bg-green-900/20 text-green-300' },
      failed:    { variant: 'destructive' },
      running:   { variant: 'outline', className: 'border-blue-700 bg-blue-900/20 text-blue-300' },
      timeout:   { variant: 'destructive' },
      cancelled: { variant: 'secondary' },
      pending:   { variant: 'secondary' },
    };
    const info = map[status] || map.pending;
    return (
      <Badge variant={info.variant} className={info.className}>
        {status}
      </Badge>
    );
  };

  const filterButtons: Array<{ value: typeof filter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
  ];

  return (
    <div>
      {!embedded && (
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Test Runs</h1>
            <p className="text-muted-foreground mt-1">View execution history and results</p>
          </div>
          {executions.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                <Download className="h-4 w-4 me-2" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
                <Download className="h-4 w-4 me-2" />
                Export JSON
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Analytics/Metrics */}
      {executions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Total Executions</div>
              <div className="text-2xl font-bold text-foreground">{total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Success Rate</div>
              <div className="text-2xl font-bold text-green-500">
                {total > 0 && executions.length > 0
                  ? `${Math.round((executions.filter(e => e && e.status === 'completed').length / total) * 100)}%`
                  : '0%'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Average Duration</div>
              <div className="text-2xl font-bold text-foreground">
                {(() => {
                  const completed = executions.filter(e => e && e.status !== 'running' && e.total_duration_ms);
                  return completed.length > 0
                    ? formatDuration(completed.reduce((sum, e) => sum + (e.total_duration_ms || 0), 0) / completed.length)
                    : '0ms';
                })()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Running Now</div>
              <div className="text-2xl font-bold text-blue-500">
                {executions.filter(e => e && e.status === 'running').length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filter */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search executions..."
            className="ps-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {filterButtons.map(({ value, label }) => (
            <Button
              key={value}
              variant={filter === value ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && executions.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-6 w-20" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : executions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-foreground mb-1">
              {searchTerm || filter !== 'all' ? 'No test runs match your filters' : 'No test runs yet'}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              {searchTerm || filter !== 'all'
                ? 'Try adjusting your search or filter criteria to see more results.'
                : 'Test runs are created when you execute test cases. Run a test case to see execution history here.'}
            </p>
            {!searchTerm && filter === 'all' && (
              <Button onClick={() => navigate('/test-cases')}>
                <Play className="h-4 w-4 me-2" />
                View Test Cases
              </Button>
            )}
            {!searchTerm && filter === 'all' && (
              <p className="text-xs text-muted-foreground mt-3">
                Tip: Navigate to a test case and click "Run Test" to create your first execution
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {executions
              .filter(execution => execution && execution.execution_id)
              .map((execution) => (
                <Card key={execution.execution_id} className="hover:bg-muted/50 transition-colors duration-150">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getStatusBadge(execution.status)}
                        <div>
                          <div className="font-medium text-foreground">
                            Execution {execution.execution_id?.substring(0, 8) || 'N/A'}
                          </div>
                          <div className="text-sm text-muted-foreground" title={execution.started_at ? formatAbsoluteTime(execution.started_at) : ''}>
                            {execution.started_at ? formatRelativeTime(execution.started_at) : 'Unknown'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="ms-2 font-medium">{formatDuration(execution.total_duration_ms || 0)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Steps:</span>
                          <span className="ms-2 font-medium">
                            {execution.steps?.filter((s) => s.success).length || 0}/{execution.steps?.length || 0} passed
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {execution.status === 'running' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleStopExecution(execution.execution_id)}
                            >
                              <Square className="h-3 w-3 me-1" />
                              Stop
                            </Button>
                          )}
                          <Link
                            to={`/test-runs/${execution.execution_id}`}
                            className="text-primary hover:text-primary/80 text-sm font-medium transition-colors duration-150"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} executions
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};
