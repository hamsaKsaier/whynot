import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiFilter, FiSearch, FiPlay, FiActivity, FiSquare, FiDownload } from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { AdvancedSearch } from '../components/common/AdvancedSearch';
import { StatusBadge } from '../components/common/StatusBadge';
import { TestAutomationChatbot } from '../components/Chatbot/TestAutomationChatbot';
import { formatRelativeTime, formatAbsoluteTime } from '../utils/dateFormat';
import { getExecutions, getExecutionById, stopExecution } from '../services/api';
import { useToastContext } from '../contexts/ToastContext';
import { SkeletonCard } from '../components/common/SkeletonCard';
import { Alert } from '../components/common/Alert';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/common/Button';
import { useNavigate } from 'react-router-dom';
import { debounce } from '../utils/debounce';
import type { ExecutionResult } from '../types';

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
};

export const TestRunsPage: React.FC = () => {
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
      setError(err.response?.data?.error || err.message || 'Failed to fetch executions');
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
    const statusMap: Record<string, 'success' | 'error' | 'running' | 'pending'> = {
      completed: 'success',
      failed: 'error',
      running: 'running',
      timeout: 'error',
      cancelled: 'pending',
      pending: 'pending',
    };
    
    const badgeStatus = statusMap[status] || 'pending';
    return (
      <StatusBadge
        status={badgeStatus}
        pulse={status === 'running'}
        size="sm"
      />
    );
  };

  // No need for client-side filtering since API handles it
  const filteredExecutions = useMemo(() => executions, [executions]);

  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; value: string }> = [];
    if (filter !== 'all') {
      filters.push({ key: 'status', label: 'Status', value: filter });
    }
    return filters;
  }, [filter]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Test Runs</h1>
          <p className="text-gray-600 mt-1">View execution history and results</p>
        </div>
        {executions.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FiDownload className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FiDownload className="h-4 w-4" />
              <span>Export JSON</span>
            </button>
          </div>
        )}
      </div>

      {/* Analytics/Metrics */}
      {executions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-1">Total Executions</div>
            <div className="text-2xl font-bold text-gray-900">{total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-1">Success Rate</div>
            <div className="text-2xl font-bold text-green-600">
              {total > 0 && executions.length > 0
                ? `${Math.round((executions.filter(e => e && e.status === 'completed').length / executions.length) * 100)}%`
                : '0%'}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-1">Average Duration</div>
            <div className="text-2xl font-bold text-gray-900">
              {executions.length > 0
                ? formatDuration(
                    executions
                      .filter(e => e && e.total_duration_ms !== undefined)
                      .reduce((sum, e) => sum + (e.total_duration_ms || 0), 0) / executions.length
                  )
                : '0ms'}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600 mb-1">Running Now</div>
            <div className="text-2xl font-bold text-blue-600">
              {executions.filter(e => e && e.status === 'running').length}
            </div>
          </Card>
        </div>
      )}

      {/* Advanced Search */}
      <div className="mb-6">
        <AdvancedSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search executions..."
          filters={activeFilters}
          onFilterRemove={(key) => {
            if (key === 'status') setFilter('all');
          }}
          onClearAll={() => {
            setSearchTerm('');
            setFilter('all');
          }}
        />
        <div className="flex items-center space-x-2 mt-3">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'completed'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'failed'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Failed
          </button>
        </div>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} />
      )}

      {loading && executions.length === 0 ? (
        <div className="card-grid grid grid-cols-1">
          <SkeletonCard count={3} />
        </div>
      ) : filteredExecutions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FiActivity />}
            title={searchTerm || filter !== 'all' ? 'No test runs match your filters' : 'No test runs yet'}
            description={
              searchTerm || filter !== 'all'
                ? 'Try adjusting your search or filter criteria to see more results.'
                : 'Test runs are created when you execute test cases. Run a test case to see execution history here.'
            }
            action={
              !searchTerm && filter === 'all' ? (
                <Button onClick={() => navigate('/test-cases')}>
                  <FiPlay className="mr-2" />
                  View Test Cases
                </Button>
              ) : undefined
            }
            tip={searchTerm || filter !== 'all' ? undefined : 'Tip: Navigate to a test case and click "Run Test" to create your first execution'}
          />
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {filteredExecutions
              .filter(execution => execution && execution.execution_id)
              .map((execution) => (
                <Card key={execution.execution_id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getStatusBadge(execution.status)}
                      <div>
                        <div className="font-medium text-gray-900">
                          Execution {execution.execution_id?.substring(0, 8) || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500" title={execution.started_at ? formatAbsoluteTime(execution.started_at) : ''}>
                          {execution.started_at ? formatRelativeTime(execution.started_at) : 'Unknown'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-sm">
                        <span className="text-gray-600">Duration:</span>
                        <span className="ml-2 font-medium">{formatDuration(execution.total_duration_ms || 0)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Steps:</span>
                        <span className="ml-2 font-medium">
                          {execution.steps?.filter((s) => s.success).length || 0}/{execution.steps?.length || 0} passed
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        {execution.status === 'running' && (
                          <button
                            onClick={() => handleStopExecution(execution.execution_id)}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                          >
                            <FiSquare className="h-3 w-3" />
                            <span>Stop</span>
                          </button>
                        )}
                        <Link
                          to={`/test-runs/${execution.execution_id}`}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} executions
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    offset === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    offset + limit >= total
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <TestAutomationChatbot
        context={{}}
      />
    </div>
  );
};




















