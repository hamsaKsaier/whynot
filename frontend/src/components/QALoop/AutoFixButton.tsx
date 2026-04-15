import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Progress } from '../ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  GitPullRequest,
  Check,
  X,
  Loader2,
  ExternalLink,
  Code,
  RefreshCw,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiClient } from '../../services/api';

interface GitHubRepo {
  id: string;
  owner: string;
  repo: string;
  default_branch: string;
}

interface AutoFixAttempt {
  id: string;
  status: 'pending' | 'analyzing' | 'generating' | 'pr_created' | 'retesting' | 'verified' | 'failed' | 'needs_review';
  branch_name: string | null;
  pr_number: number | null;
  pr_url: string | null;
  relevant_files: string[];
  generated_diff: string | null;
  claude_reasoning: string | null;
  verification_status: string | null;
  verification_session_id: string | null;
  iteration_count: number;
  max_iterations: number;
  quality_score_before: number | null;
  quality_score_after: number | null;
  error_message: string | null;
  created_at: string;
}

interface AutoFixButtonProps {
  bugId: string;
  bugTitle: string;
  className?: string;
}

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  pending: { label: 'Starting...', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  analyzing: { label: 'Analyzing code...', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  generating: { label: 'Generating fix...', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  pr_created: { label: 'PR Created', icon: <GitPullRequest className="h-3 w-3" /> },
  merging: { label: 'Merging PR...', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  retesting: { label: 'Retesting...', icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
  verified: { label: 'Verified', icon: <Check className="h-3 w-3" /> },
  needs_review: { label: 'Needs Review', icon: <AlertTriangle className="h-3 w-3" /> },
  failed: { label: 'Failed', icon: <X className="h-3 w-3" /> },
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: '',
  analyzing: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  generating: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
  pr_created: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  merging: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  retesting: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  verified: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  needs_review: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  failed: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
};

const LOOP_STEPS = ['analyzing', 'generating', 'pr_created', 'merging', 'retesting', 'verified'];
const LOOP_STEP_LABELS = ['Analyze', 'Generate', 'PR', 'Merge', 'Retest', 'Verified'];

const SIMPLE_STEPS = ['analyzing', 'generating', 'pr_created'];
const SIMPLE_STEP_LABELS = ['Analyze', 'Generate', 'PR'];

export const AutoFixButton: React.FC<AutoFixButtonProps> = ({ bugId, bugTitle, className = '' }) => {
  const [showModal, setShowModal] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [attempts, setAttempts] = useState<AutoFixAttempt[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<AutoFixAttempt | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [mode, setMode] = useState<'simple' | 'loop'>('loop');
  const [autoMerge, setAutoMerge] = useState(false);
  const [maxIterations, setMaxIterations] = useState(3);
  const [qualityThreshold, setQualityThreshold] = useState(80);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const workspaceId = localStorage.getItem('active_workspace_id') || '';

  const loadData = async () => {
    setLoading(true);
    try {
      const [repoRes, attemptsRes] = await Promise.all([
        apiClient.get(`/github-repos?workspace_id=${workspaceId}`),
        apiClient.get(`/bugs/${bugId}/auto-fix`),
      ]);
      setRepos(repoRes.data);
      setAttempts(attemptsRes.data);
      if (repoRes.data.length > 0 && !selectedRepo) {
        setSelectedRepo(repoRes.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load auto-fix data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setShowModal(true);
    setCurrentAttempt(null);
    loadData();
  };

  const handleClose = () => {
    setShowModal(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleStart = async () => {
    if (!selectedRepo) return;
    try {
      setStarting(true);

      let res;
      if (mode === 'loop') {
        res = await apiClient.post(`/bugs/${bugId}/auto-fix-loop`, {
          github_repo_id: selectedRepo,
          max_iterations: maxIterations,
          quality_threshold: qualityThreshold,
          auto_merge: autoMerge,
        });
      } else {
        res = await apiClient.post(`/bugs/${bugId}/auto-fix`, {
          github_repo_id: selectedRepo,
        });
      }

      setCurrentAttempt(res.data);
      startPolling(res.data.id);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to start auto-fix');
    } finally {
      setStarting(false);
    }
  };

  const startPolling = (attemptId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await apiClient.get(`/auto-fix/${attemptId}`);
        setCurrentAttempt(res.data);

        // Stop polling when done
        if (['verified', 'failed', 'needs_review'].includes(res.data.status)) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
        // Also stop for simple mode when PR is created
        if (mode === 'simple' && res.data.status === 'pr_created') {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const isInProgress = currentAttempt && ['pending', 'analyzing', 'generating', 'merging', 'retesting'].includes(currentAttempt.status);
  const isLoopMode = mode === 'loop';
  const steps = isLoopMode ? LOOP_STEPS : SIMPLE_STEPS;
  const stepLabels = isLoopMode ? LOOP_STEP_LABELS : SIMPLE_STEP_LABELS;

  const getStepIndex = (status: string): number => {
    const idx = steps.indexOf(status);
    if (status === 'pending') return -1;
    if (status === 'needs_review') return steps.indexOf('retesting');
    if (status === 'failed') return -1;
    return idx;
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className={cn('gap-1 text-xs h-7 px-2 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300', className)}
        title="Auto-fix: Generate a PR to fix this bug"
      >
        <GitPullRequest className="h-3 w-3" />
        <span>Auto-Fix</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 leading-none">
          Experimental
        </Badge>
      </Button>

      <Dialog open={showModal} onOpenChange={open => { if (!open) handleClose(); }}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitPullRequest className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              Auto-Fix Bug
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
                Experimental
              </Badge>
            </DialogTitle>
            <DialogDescription className="truncate">{bugTitle}</DialogDescription>
          </DialogHeader>

          {/* Body */}
          <div className="overflow-y-auto flex-1 space-y-4">
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : repos.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-3">No GitHub repositories connected</p>
                <a
                  href="/github-repos"
                  className="text-primary hover:text-primary/80 text-sm font-medium"
                >
                  Go to GitHub Repos to connect your repository
                </a>
              </div>
            ) : (
              <>
                {/* Previous attempts */}
                {attempts.length > 0 && !currentAttempt && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-2">Previous Attempts</div>
                    <div className="space-y-2">
                      {attempts.slice(0, 5).map((attempt) => {
                        const statusInfo = STATUS_LABELS[attempt.status] || STATUS_LABELS.pending;
                        return (
                          <div key={attempt.id} className="p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {statusInfo.icon}
                                <Badge variant="outline" className={cn('text-xs', STATUS_BADGE_CLASS[attempt.status])}>
                                  {statusInfo.label}
                                </Badge>
                                {attempt.iteration_count > 1 && (
                                  <span className="text-xs text-muted-foreground">
                                    (iter {attempt.iteration_count}/{attempt.max_iterations})
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{new Date(attempt.created_at).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              {attempt.pr_url && (
                                <a
                                  href={attempt.pr_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                                >
                                  <ExternalLink className="h-3 w-3 rtl:scale-x-[-1]" />
                                  PR #{attempt.pr_number}
                                </a>
                              )}
                              {attempt.quality_score_after !== null && (
                                <span className="text-xs text-muted-foreground">
                                  Quality: {attempt.quality_score_before ?? '?'} &rarr; {attempt.quality_score_after}
                                </span>
                              )}
                            </div>
                            {attempt.error_message && (
                              <p className="text-xs text-destructive mt-1">{attempt.error_message}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Current attempt progress */}
                {currentAttempt ? (
                  <div className="space-y-4">
                    {/* Progress steps */}
                    <div className="text-center py-2">
                      <div className="mb-4">
                        <div className="flex items-center justify-center gap-1">
                          {steps.map((step, i) => {
                            const currentIdx = getStepIndex(currentAttempt.status);
                            const stepIdx = i;
                            const isActive = stepIdx <= currentIdx;
                            const isCurrent = step === currentAttempt.status || (currentAttempt.status === 'pending' && step === 'analyzing');
                            return (
                              <React.Fragment key={step}>
                                {i > 0 && <div className={cn('h-0.5 w-6', isActive ? 'bg-primary' : 'bg-muted')} />}
                                <div className={cn(
                                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                                  isCurrent && 'ring-2 ring-primary/50'
                                )}>
                                  {i + 1}
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </div>
                        <div className="flex justify-center mt-2" style={{ gap: isLoopMode ? '0.5rem' : '1rem' }}>
                          {stepLabels.map((label) => (
                            <span key={label} className="text-xs text-muted-foreground">{label}</span>
                          ))}
                        </div>
                      </div>

                      {/* Iteration indicator for loop mode */}
                      {currentAttempt.iteration_count > 0 && currentAttempt.max_iterations > 1 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                            <RefreshCw className="h-3 w-3" />
                            Iteration {currentAttempt.iteration_count} of {currentAttempt.max_iterations}
                          </div>
                          <Progress
                            value={(currentAttempt.iteration_count / currentAttempt.max_iterations) * 100}
                            className="w-48 mx-auto mt-1.5 h-1.5"
                          />
                        </div>
                      )}

                      {isInProgress && (
                        <div className="flex items-center justify-center gap-2 text-primary">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span className="font-medium">{STATUS_LABELS[currentAttempt.status]?.label}</span>
                        </div>
                      )}
                    </div>

                    {/* Verified state */}
                    {currentAttempt.status === 'verified' && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold mb-2">
                          <Check className="h-5 w-5" />
                          Bug Verified Fixed!
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {currentAttempt.quality_score_before !== null && (
                            <div className="text-center p-2 bg-green-100/50 dark:bg-green-900/30 rounded-lg">
                              <div className="text-xs text-green-600 dark:text-green-400">Before</div>
                              <div className="text-lg font-bold text-green-700 dark:text-green-300">{currentAttempt.quality_score_before}</div>
                            </div>
                          )}
                          {currentAttempt.quality_score_after !== null && (
                            <div className="text-center p-2 bg-green-100/50 dark:bg-green-900/30 rounded-lg">
                              <div className="text-xs text-green-600 dark:text-green-400">After</div>
                              <div className="text-lg font-bold text-green-700 dark:text-green-300">{currentAttempt.quality_score_after}</div>
                            </div>
                          )}
                        </div>
                        {currentAttempt.pr_url && (
                          <Button asChild variant="default" className="bg-green-600 hover:bg-green-700 text-white">
                            <a href={currentAttempt.pr_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 me-2 rtl:scale-x-[-1]" />
                              View PR #{currentAttempt.pr_number} on GitHub
                            </a>
                          </Button>
                        )}
                        {currentAttempt.claude_reasoning && (
                          <div className="mt-3">
                            <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Fix Explanation:</div>
                            <p className="text-sm text-green-600 dark:text-green-300">{currentAttempt.claude_reasoning}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PR Created (simple mode) */}
                    {currentAttempt.status === 'pr_created' && mode === 'simple' && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-2">
                          <Check className="h-5 w-5" />
                          Pull Request Created!
                        </div>
                        {currentAttempt.pr_url && (
                          <Button asChild variant="default" className="bg-green-600 hover:bg-green-700 text-white">
                            <a href={currentAttempt.pr_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 me-2 rtl:scale-x-[-1]" />
                              View PR #{currentAttempt.pr_number} on GitHub
                            </a>
                          </Button>
                        )}
                        {currentAttempt.claude_reasoning && (
                          <div className="mt-3">
                            <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Fix Explanation:</div>
                            <p className="text-sm text-green-600 dark:text-green-300">{currentAttempt.claude_reasoning}</p>
                          </div>
                        )}
                        {currentAttempt.relevant_files && currentAttempt.relevant_files.length > 0 && (
                          <div className="mt-3">
                            <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Files Modified:</div>
                            <div className="space-y-1">
                              {(Array.isArray(currentAttempt.relevant_files) ? currentAttempt.relevant_files : []).map((f: string) => (
                                <div key={f} className="text-xs font-mono bg-green-100/50 dark:bg-green-900/30 px-2 py-1 rounded-md text-green-700 dark:text-green-300">{f}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Needs Review state */}
                    {currentAttempt.status === 'needs_review' && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-semibold mb-2">
                          <AlertTriangle className="h-5 w-5" />
                          Manual Review Needed
                        </div>
                        <p className="text-sm text-yellow-600 dark:text-yellow-300 mb-3">
                          {currentAttempt.verification_status === 'regression'
                            ? 'The fix may have introduced new issues. Quality score decreased.'
                            : `Auto-fix reached ${currentAttempt.iteration_count}/${currentAttempt.max_iterations} iterations without fully resolving the bug.`}
                        </p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {currentAttempt.quality_score_before !== null && (
                            <div className="text-center p-2 bg-yellow-100/50 dark:bg-yellow-900/30 rounded-lg">
                              <div className="text-xs text-yellow-600 dark:text-yellow-400">Before</div>
                              <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{currentAttempt.quality_score_before}</div>
                            </div>
                          )}
                          {currentAttempt.quality_score_after !== null && (
                            <div className="text-center p-2 bg-yellow-100/50 dark:bg-yellow-900/30 rounded-lg">
                              <div className="text-xs text-yellow-600 dark:text-yellow-400">After</div>
                              <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{currentAttempt.quality_score_after}</div>
                            </div>
                          )}
                        </div>
                        {currentAttempt.pr_url && (
                          <Button asChild variant="default" className="bg-yellow-600 hover:bg-yellow-700 text-white">
                            <a href={currentAttempt.pr_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 me-2 rtl:scale-x-[-1]" />
                              Review PR #{currentAttempt.pr_number} on GitHub
                            </a>
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Failed state */}
                    {currentAttempt.status === 'failed' && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-1">
                          <X className="h-5 w-5" />
                          Auto-Fix Failed
                        </div>
                        <p className="text-sm text-red-600 dark:text-red-300">{currentAttempt.error_message || 'An unknown error occurred'}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Start new attempt */
                  <div className="space-y-4">
                    {/* Repo selector */}
                    <div className="space-y-1.5">
                      <Label>Target Repository</Label>
                      <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {repos.map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.owner}/{r.repo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Mode selector */}
                    <div className="space-y-2">
                      <Label>Fix Mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMode('loop')}
                          className={cn(
                            'p-3 rounded-lg border-2 text-start transition-colors duration-150',
                            mode === 'loop'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/50'
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className={cn('h-4 w-4', mode === 'loop' ? 'text-primary' : 'text-muted-foreground')} />
                            <span className={cn('text-sm font-semibold', mode === 'loop' ? 'text-primary' : 'text-foreground')}>
                              Fix + Merge + Verify
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Fix &rarr; PR &rarr; Merge &rarr; Retest &rarr; Iterate until quality met
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode('simple')}
                          className={cn(
                            'p-3 rounded-lg border-2 text-start transition-colors duration-150',
                            mode === 'simple'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/50'
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Code className={cn('h-4 w-4', mode === 'simple' ? 'text-primary' : 'text-muted-foreground')} />
                            <span className={cn('text-sm font-semibold', mode === 'simple' ? 'text-primary' : 'text-foreground')}>
                              PR Only
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Generate fix and create PR (no retest)
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Loop options */}
                    {mode === 'loop' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg min-h-[44px]">
                          <div>
                            <div className="text-sm font-medium text-foreground">Auto-merge PRs</div>
                            <div className="text-xs text-muted-foreground">Automatically merge PRs into the default branch</div>
                          </div>
                          <Switch
                            checked={autoMerge}
                            onCheckedChange={setAutoMerge}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Max Iterations</Label>
                            <Select value={String(maxIterations)} onValueChange={v => setMaxIterations(Number(v))}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3 (recommended)</SelectItem>
                                <SelectItem value="5">5</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Quality Target</Label>
                            <Select value={String(qualityThreshold)} onValueChange={v => setQualityThreshold(Number(v))}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="60">60% (lenient)</SelectItem>
                                <SelectItem value="70">70%</SelectItem>
                                <SelectItem value="80">80% (recommended)</SelectItem>
                                <SelectItem value="90">90% (strict)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* How it works */}
                    <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 p-4 rounded-lg text-sm text-sky-700 dark:text-sky-300">
                      <p className="font-medium mb-1">How it works:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>AI analyzes the bug report and finds relevant source files</li>
                        <li>Claude generates a code fix based on the bug context</li>
                        <li>A pull request is created on a new branch</li>
                        {mode === 'loop' && (
                          <>
                            {autoMerge && <li>PR is auto-merged into the default branch</li>}
                            <li>QA Loop retests the live app to verify the fix</li>
                            <li>If not fixed, Claude iterates with improved fix until quality target met</li>
                          </>
                        )}
                      </ol>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            {repos.length > 0 && !currentAttempt && (
              <Button
                onClick={handleStart}
                disabled={starting || !selectedRepo}
              >
                {starting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : mode === 'loop' ? (
                  <>
                    <Zap className="h-4 w-4" />
                    Fix + Merge + Verify
                  </>
                ) : (
                  <>
                    <Code className="h-4 w-4" />
                    Generate Fix
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
