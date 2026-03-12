import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiPlay, FiEdit, FiTrash2, FiSave, FiX, FiGlobe, FiSearch, FiFilter } from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Alert } from '../components/common/Alert';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { TestAutomationChatbot } from '../components/Chatbot/TestAutomationChatbot';
import { EmptyState } from '../components/common/EmptyState';
import { SkeletonCard } from '../components/common/SkeletonCard';
import { QuickActions } from '../components/common/QuickActions';
import { useToastContext } from '../contexts/ToastContext';
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';
import { getTestCases, updateTestCase, deleteTestCase, executeTest } from '../services/api';
import type { TestCase } from '../types';

export const TestCasesPage: React.FC = () => {
  const { success, error: showError } = useToastContext();
  const { optimisticUpdate, optimisticDelete } = useOptimisticUpdate<TestCase>();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; testCase: TestCase | null }>({
    isOpen: false,
    testCase: null,
  });
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed' | 'not_run'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTestCases();
  }, []);

  const fetchTestCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTestCases();
      setTestCases(response.test_cases);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch test cases');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (testCase: TestCase) => {
    setEditingId(testCase.id);
    setEditName(testCase.name);
    setEditDescription(testCase.description || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const testCase = testCases.find(tc => tc.id === id);
      if (!testCase) return;

      const optimisticTestCase: TestCase = {
        ...testCase,
        name: editName,
        description: editDescription,
      };

      const updatedTestCases = await optimisticUpdate(
        testCases,
        optimisticTestCase,
        () => updateTestCase(id, {
          name: editName,
          description: editDescription,
        }),
        {
          successMessage: 'Test case updated successfully',
          errorMessage: 'Failed to update test case',
        }
      );
      setTestCases(updatedTestCases);
      setEditingId(null);
      setEditName('');
      setEditDescription('');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update test case';
      setError(errorMessage);
    }
  };

  const handleDeleteClick = (testCase: TestCase) => {
    setDeleteConfirm({ isOpen: true, testCase });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.testCase) return;

    try {
      const updatedTestCases = await optimisticDelete(
        testCases,
        deleteConfirm.testCase.id,
        () => deleteTestCase(deleteConfirm.testCase!.id),
        {
          successMessage: 'Test case deleted successfully',
          errorMessage: 'Failed to delete test case',
        }
      );
      setTestCases(updatedTestCases);
      setDeleteConfirm({ isOpen: false, testCase: null });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete test case';
      setError(errorMessage);
      setDeleteConfirm({ isOpen: false, testCase: null });
    }
  };

  const handleRunTest = async (testCase: TestCase) => {
    setRunningTestId(testCase.id);
    setError(null);
    try {
      const result = await executeTest(testCase, false);
      if ('execution_id' in result) {
        navigate(`/test-runs/${result.execution_id}`);
      }
    } catch (err: any) {
      showError(err.response?.data?.error || err.message || 'Failed to run test');
      setRunningTestId(null);
    }
  };

  // Derive unique domains for filter dropdown
  const uniqueDomains = useMemo(() => {
    const domains = new Set<string>();
    testCases.forEach((tc) => {
      try { domains.add(new URL(tc.website_url).hostname); } catch { /* skip invalid URLs */ }
    });
    return Array.from(domains).sort();
  }, [testCases]);

  // Apply filters
  const filteredTestCases = useMemo(() => {
    return testCases.filter((tc) => {
      const q = searchQuery.toLowerCase();
      if (q && !tc.name.toLowerCase().includes(q) && !tc.website_url.toLowerCase().includes(q) && !(tc.description || '').toLowerCase().includes(q)) return false;
      if (domainFilter) {
        try { if (new URL(tc.website_url).hostname !== domainFilter) return false; } catch { return false; }
      }
      const lastStatus = (tc as any).last_run_status as string | undefined;
      if (statusFilter === 'passed' && lastStatus !== 'passed') return false;
      if (statusFilter === 'failed' && lastStatus !== 'failed') return false;
      if (statusFilter === 'not_run' && lastStatus) return false;
      return true;
    });
  }, [testCases, searchQuery, domainFilter, statusFilter]);

  const hasActiveFilters = searchQuery || domainFilter || statusFilter !== 'all';

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Test Cases</h1>
          <p className="page-subtitle">Manage and execute your saved test cases</p>
        </div>
        <Button
          className="flex items-center space-x-2"
          onClick={() => navigate('/qa-loop')}
        >
          <FiPlus className="h-4 w-4" />
          <span>New Test Case</span>
        </Button>
      </div>

      {/* Filter bar — only shown when there are test cases */}
      {testCases.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or URL…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          {/* Domain filter */}
          {uniqueDomains.length > 0 && (
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 text-gray-700"
            >
              <option value="">All domains</option>
              {uniqueDomains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 text-gray-700"
          >
            <option value="all">All statuses</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="not_run">Not run</option>
          </select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={() => { setSearchQuery(''); setDomainFilter(''); setStatusFilter('all'); }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              <FiX className="h-3 w-3" /> Clear
            </button>
          )}

          {/* Result count */}
          <span className="text-xs text-gray-400 ml-auto">
            {filteredTestCases.length} of {testCases.length}
          </span>
        </div>
      )}

      {error && (
        <Alert
          type="error"
          title="Error"
          message={error}
          suggestions={[
            'Check your network connection',
            'Verify that the test case still exists',
            'Try refreshing the page',
          ]}
          actions={[
            {
              label: 'Retry',
              onClick: () => {
                setError(null);
                fetchTestCases();
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

      {loading && testCases.length === 0 ? (
        <div className="card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard count={3} />
        </div>
      ) : testCases.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FiPlay />}
            title="No test cases yet"
            description="Test cases are generated from user stories. Create a project and add user stories to get started"
            action={
              <Button onClick={() => navigate('/qa-loop')}>
                <FiPlus className="mr-2" />
                Create Your First Test Case
              </Button>
            }
            tip="Tip: Navigate to a project, add a user story, then generate test cases"
          />
        </Card>
      ) : filteredTestCases.length === 0 ? (
        <Card className="text-center py-12">
          <FiFilter className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-2">No test cases match your filters</p>
          <button
            onClick={() => { setSearchQuery(''); setDomainFilter(''); setStatusFilter('all'); }}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Clear filters
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTestCases.map((testCase) => {
            const isEditing = editingId === testCase.id;
            const isRunning = runningTestId === testCase.id;

            return (
              <Card key={testCase.id} className="p-4" hoverable>
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Test case name"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      rows={3}
                      placeholder="Description"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(testCase.id)}
                        className="flex-1"
                      >
                        <FiSave className="mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleCancelEdit}
                        className="flex-1"
                      >
                        <FiX className="mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold text-gray-900 mb-2">{testCase.name}</h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {testCase.description || 'No description'}
                    </p>
                    <div className="flex items-center text-xs text-gray-500 mb-3">
                      <FiGlobe className="h-3 w-3 mr-1" />
                      <span className="truncate">{testCase.website_url}</span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <span className="text-xs text-gray-500">
                        {testCase.steps.length} step{testCase.steps.length !== 1 ? 's' : ''}
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleRunTest(testCase)}
                          disabled={isRunning}
                          className="p-2 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
                          title="Run test"
                        >
                          <FiPlay className={`h-4 w-4 ${isRunning ? 'text-gray-400' : 'text-primary-600'}`} />
                        </button>
                        <button
                          onClick={() => handleEdit(testCase)}
                          className="p-2 rounded hover:bg-gray-100 transition-colors"
                          title="Edit"
                        >
                          <FiEdit className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(testCase)}
                          className="p-2 rounded hover:bg-gray-100 transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Test Case"
        message={`Are you sure you want to delete "${deleteConfirm.testCase?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ isOpen: false, testCase: null })}
      />

      <TestAutomationChatbot
        context={{}}
        onTestGenerated={(testCase) => {
          navigate('/qa-loop');
        }}
      />
    </div>
  );
};
