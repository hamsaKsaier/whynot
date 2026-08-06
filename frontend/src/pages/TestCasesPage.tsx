import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Play, Pencil, Trash2, Save, X, Globe, Search, Filter, SlidersHorizontal, Zap } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../components/ui/sheet';
import { Alert, AlertDescription } from '../components/ui/alert';
import { cn } from '../lib/utils';
import { useToastContext } from '../contexts/ToastContext';
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';
import { getTestCases, updateTestCase, deleteTestCase, executeTest } from '../services/api';
import type { TestCase } from '../types';

/**
 * Sentinel for the "all domains" option. Radix rejects `<SelectItem value="">`
 * (an empty value is reserved for clearing the selection), and throwing inside
 * render crashes the whole page — so the empty domainFilter state is mapped to
 * this sentinel at the boundary instead.
 */
const ALL_DOMAINS = '__all__';

export const TestCasesContent: React.FC = () => <TestCasesPage embedded />;

export const TestCasesPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { t } = useTranslation('results');
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
      setError(err.response?.data?.error || err.message || t('results.testCases.fetchError'));
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
          successMessage: t('results.testCases.updated'),
          errorMessage: t('results.testCases.updateError'),
        }
      );
      setTestCases(updatedTestCases);
      setEditingId(null);
      setEditName('');
      setEditDescription('');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || t('results.testCases.updateError');
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
          successMessage: t('results.testCases.deleted'),
          errorMessage: t('results.testCases.deleteError'),
        }
      );
      setTestCases(updatedTestCases);
      setDeleteConfirm({ isOpen: false, testCase: null });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || t('results.testCases.deleteError');
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
      showError(err.response?.data?.error || err.message || t('results.testCases.runError'));
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{t('results.testCases.title')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">{t('results.testCases.subtitle')}</p>
          </div>
          <Button onClick={() => navigate('/qa-loop')} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 me-2" />
            {t('results.testCases.new')}
          </Button>
        </div>
      )}

      {/* Filter bar -- only shown when there are test cases */}
      {testCases.length > 0 && (
        <>
          {/* Desktop: inline filter bar */}
          <div className="hidden md:flex flex-wrap items-center gap-3 mb-4 p-3 bg-muted rounded-lg border border-border">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('results.testCases.searchPlaceholder')}
                className="ps-9"
              />
            </div>
            {uniqueDomains.length > 0 && (
              <Select
                value={domainFilter || ALL_DOMAINS}
                onValueChange={(v) => setDomainFilter(v === ALL_DOMAINS ? '' : v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('results.testCases.allDomains')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DOMAINS}>{t('results.testCases.allDomains')}</SelectItem>
                  {uniqueDomains.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('results.testCases.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('results.testCases.allStatuses')}</SelectItem>
                <SelectItem value="passed">{t('results.passed')}</SelectItem>
                <SelectItem value="failed">{t('results.failed')}</SelectItem>
                <SelectItem value="not_run">{t('results.testCases.notRun')}</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearchQuery(''); setDomainFilter(''); setStatusFilter('all'); }}
              >
                <X className="h-3 w-3 me-1" />
                {t('results.testCases.clear')}
              </Button>
            )}
            <span className="text-xs text-muted-foreground ms-auto">
              {filteredTestCases.length} of {testCases.length}
            </span>
          </div>

          {/* Mobile: search + filter drawer */}
          <div className="md:hidden mb-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  inputMode="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('results.testCases.searchPlaceholder')}
                  className="ps-9"
                />
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 relative">
                    <SlidersHorizontal className="h-4 w-4" />
                    {hasActiveFilters && (
                      <span className="absolute -top-1 -end-1 w-2.5 h-2.5 bg-primary rounded-full" />
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-lg">
                  <SheetHeader>
                    <SheetTitle>{t('results.testCases.filters', { defaultValue: 'Filters' })}</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 py-4">
                    {uniqueDomains.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                          {t('results.testCases.allDomains')}
                        </label>
                        <Select
                          value={domainFilter || ALL_DOMAINS}
                          onValueChange={(v) => setDomainFilter(v === ALL_DOMAINS ? '' : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('results.testCases.allDomains')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_DOMAINS}>{t('results.testCases.allDomains')}</SelectItem>
                            {uniqueDomains.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">
                        {t('results.testCases.allStatuses')}
                      </label>
                      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('results.testCases.allStatuses')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('results.testCases.allStatuses')}</SelectItem>
                          <SelectItem value="passed">{t('results.passed')}</SelectItem>
                          <SelectItem value="failed">{t('results.failed')}</SelectItem>
                          <SelectItem value="not_run">{t('results.testCases.notRun')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => { setSearchQuery(''); setDomainFilter(''); setStatusFilter('all'); }}
                      >
                        <X className="h-3 w-3 me-1" />
                        {t('results.testCases.clear')}
                      </Button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {filteredTestCases.length} of {testCases.length}
              </span>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => { setSearchQuery(''); setDomainFilter(''); setStatusFilter('all'); }}
                >
                  {t('results.testCases.clearFilters')}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setError(null); fetchTestCases(); }}>
                {t('results.testCases.retry')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                {t('results.testCases.dismiss')}
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
            <h3 className="font-semibold text-foreground mb-1">{t('results.testCases.emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              {t('results.testCases.emptyDescription')}
            </p>
            <Button onClick={() => navigate('/qa-loop')}>
              <Plus className="h-4 w-4 me-2" />
              {t('results.testCases.createFirst')}
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              {t('results.testCases.emptyTip')}
            </p>
          </CardContent>
        </Card>
      ) : filteredTestCases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm mb-2">{t('results.testCases.noMatch')}</p>
            <Button
              variant="link"
              size="sm"
              onClick={() => { setSearchQuery(''); setDomainFilter(''); setStatusFilter('all'); }}
            >
              {t('results.testCases.clearFilters')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTestCases.map((testCase) => {
            const isEditing = editingId === testCase.id;
            const isRunning = runningTestId === testCase.id;
            // Produced by a QA Loop scan (stored in qa_loop_test_cases), not by
            // the test_cases CRUD flow — see listWithScanResults on the gateway.
            const isFromScan = testCase.metadata?.source === 'qa_loop';

            return (
              <Card key={testCase.id} className="hover:bg-muted/50 transition-colors duration-150">
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t('results.testCases.namePlaceholder')}
                      />
                      <Textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={3}
                        placeholder={t('results.testCases.descriptionPlaceholder')}
                        className="resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(testCase.id)}
                          className="flex-1"
                        >
                          <Save className="h-4 w-4 me-1" />
                          {t('results.testCases.save')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleCancelEdit}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 me-1" />
                          {t('results.testCases.cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-foreground">{testCase.name}</h3>
                        {isFromScan && (
                          <Badge variant="outline" className="flex-shrink-0 gap-1">
                            <Zap className="h-3 w-3" />
                            {t('results.testCases.fromScan')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {testCase.description || t('results.testCases.noDescription')}
                      </p>
                      <div className="flex items-center text-xs text-muted-foreground mb-3">
                        <Globe className="h-3 w-3 me-1" />
                        <span className="truncate">{testCase.website_url}</span>
                      </div>
                      <Separator className="mb-3" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {t('results.testCases.stepsCount', { count: testCase.steps.length })}
                        </span>
                        {/* Scan-generated cases live in a different table with a
                            different step format, so the run/edit/delete
                            endpoints (which own `test_cases`) don't apply to
                            them. Show them read-only rather than offering
                            buttons that would 404. */}
                        {isFromScan ? (
                          <span className="text-xs text-muted-foreground">
                            {t('results.testCases.viewInScan')}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleRunTest(testCase)}
                              disabled={isRunning}
                              title={t('results.testCases.runTest')}
                            >
                              <Play className={cn('h-4 w-4', isRunning ? 'text-muted-foreground' : 'text-primary')} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(testCase)}
                              title={t('results.testCases.edit')}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteClick(testCase)}
                              title={t('results.testCases.delete')}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
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
            <DialogTitle>{t('results.testCases.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('results.testCases.deleteConfirm', { name: deleteConfirm.testCase?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteConfirm({ isOpen: false, testCase: null })}
            >
              {t('results.testCases.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              {t('results.testCases.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};
