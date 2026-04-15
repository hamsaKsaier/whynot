import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Pencil, Trash2, Save, X, Globe, Search, Filter } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Alert, AlertDescription } from '../components/ui/alert';
import { cn } from '../lib/utils';
import { useToastContext } from '../contexts/ToastContext';
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';
import { getTestCases, updateTestCase, deleteTestCase, executeTest } from '../services/api';
import type { TestCase } from '../types';

export const TestCasesContent: React.FC = () => <TestCasesPage embedded />;

export const TestCasesPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
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
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Test Cases</h1>
            <p className="text-muted-foreground mt-1">Manage and execute your saved test cases</p>
          </div>
          <Button onClick={() => navigate('/qa-loop')}>
            <Plus className="h-4 w-4 me-2" />
            New Test Case
          </Button>
        </div>
      )}

      {/* Filter bar -- only shown when there are test cases */}
      {testCases.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-muted rounded-lg border border-border">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or URL..."
              className="ps-9"
            />
          </div>

          {/* Domain filter */}
          {uniqueDomains.length > 0 && (
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All domains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All domains</SelectItem>
                {uniqueDomains.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="not_run">Not run</SelectItem>
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearchQuery(''); setDomainFilter(''); setStatusFilter('all'); }}
            >
              <X className="h-3 w-3 me-1" />
              Clear
            </Button>
          )}

          {/* Result count */}
          <span className="text-xs text-muted-foreground ms-auto">
            {filteredTestCases.length} of {testCases.length}
          </span>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setError(null); fetchTestCases(); }}>
                Retry
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {loading && testCases.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
                <Separator />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : testCases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Play className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-foreground mb-1">No test cases yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Test cases are generated from user stories. Create a project and add user stories to get started
            </p>
            <Button onClick={() => navigate('/qa-loop')}>
              <Plus className="h-4 w-4 me-2" />
              Create Your First Test Case
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Tip: Navigate to a project, add a user story, then generate test cases
            </p>
          </CardContent>
        </Card>
      ) : filteredTestCases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm mb-2">No test cases match your filters</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => { setSearchQuery(''); setDomainFilter(''); setStatusFilter('all'); }}
            >
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTestCases.map((testCase) => {
            const isEditing = editingId === testCase.id;
            const isRunning = runningTestId === testCase.id;

            return (
              <Card key={testCase.id} className="hover:bg-muted/50 transition-colors duration-150">
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Test case name"
                      />
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={3}
                        placeholder="Description"
                        className="resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(testCase.id)}
                          className="flex-1"
                        >
                          <Save className="h-4 w-4 me-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleCancelEdit}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 me-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-semibold text-foreground mb-2">{testCase.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {testCase.description || 'No description'}
                      </p>
                      <div className="flex items-center text-xs text-muted-foreground mb-3">
                        <Globe className="h-3 w-3 me-1" />
                        <span className="truncate">{testCase.website_url}</span>
                      </div>
                      <Separator className="mb-3" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {testCase.steps.length} step{testCase.steps.length !== 1 ? 's' : ''}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRunTest(testCase)}
                            disabled={isRunning}
                            title="Run test"
                          >
                            <Play className={cn('h-4 w-4', isRunning ? 'text-muted-foreground' : 'text-primary')} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(testCase)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeleteClick(testCase)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirm.isOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm({ isOpen: false, testCase: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Test Case</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm.testCase?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteConfirm({ isOpen: false, testCase: null })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};
