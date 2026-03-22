import React, { useState, useEffect, useRef } from 'react';
import { FiGitPullRequest, FiCheck, FiX, FiLoader, FiExternalLink, FiCode, FiRefreshCw, FiAlertTriangle, FiZap } from 'react-icons/fi';
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

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Starting...', color: 'text-slate-400', icon: <FiLoader className="h-3 w-3 animate-spin" /> },
  analyzing: { label: 'Analyzing code...', color: 'text-blue-500', icon: <FiLoader className="h-3 w-3 animate-spin" /> },
  generating: { label: 'Generating fix...', color: 'text-sky-500', icon: <FiLoader className="h-3 w-3 animate-spin" /> },
  pr_created: { label: 'PR Created', color: 'text-green-600', icon: <FiGitPullRequest className="h-3 w-3" /> },
  merging: { label: 'Merging PR...', color: 'text-blue-600', icon: <FiLoader className="h-3 w-3 animate-spin" /> },
  retesting: { label: 'Retesting...', color: 'text-orange-500', icon: <FiRefreshCw className="h-3 w-3 animate-spin" /> },
  verified: { label: 'Verified ✓', color: 'text-green-600', icon: <FiCheck className="h-3 w-3" /> },
  needs_review: { label: 'Needs Review', color: 'text-yellow-600', icon: <FiAlertTriangle className="h-3 w-3" /> },
  failed: { label: 'Failed', color: 'text-red-500', icon: <FiX className="h-3 w-3" /> },
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
  const [mode, setMode] = useState<'simple' | 'loop'>('loop'); // Default to loop mode
  const [autoMerge, setAutoMerge] = useState(false); // Disabled by default
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
      <button
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-sky-900/20 text-sky-600 hover:bg-sky-900/40 transition-colors ${className}`}
        title="Auto-fix: Generate a PR to fix this bug"
      >
        <FiGitPullRequest className="h-3 w-3" />
        <span>Auto-Fix</span>
        <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-700 rounded font-medium leading-none">Experimental</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
          <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-xl mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FiGitPullRequest className="h-5 w-5 text-sky-600" />
                Auto-Fix Bug
                <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">Experimental</span>
              </h3>
              <p className="text-sm text-slate-400 mt-1 truncate">{bugTitle}</p>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1">
              {loading ? (
                <div className="text-center py-4 text-slate-400">Loading...</div>
              ) : repos.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-slate-400 mb-3">No GitHub repositories connected</p>
                  <a
                    href="/github-repos"
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Go to GitHub Repos to connect your repository
                  </a>
                </div>
              ) : (
                <>
                  {/* Previous attempts */}
                  {attempts.length > 0 && !currentAttempt && (
                    <div className="mb-4">
                      <div className="text-xs font-medium text-slate-400 uppercase mb-2">Previous Attempts</div>
                      <div className="space-y-2">
                        {attempts.slice(0, 5).map((attempt) => {
                          const statusInfo = STATUS_LABELS[attempt.status] || STATUS_LABELS.pending;
                          return (
                            <div key={attempt.id} className="p-3 bg-slate-900 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {statusInfo.icon}
                                  <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                                  {attempt.iteration_count > 1 && (
                                    <span className="text-xs text-slate-500">
                                      (iter {attempt.iteration_count}/{attempt.max_iterations})
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-slate-500">{new Date(attempt.created_at).toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                {attempt.pr_url && (
                                  <a
                                    href={attempt.pr_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                                  >
                                    <FiExternalLink className="h-3 w-3" />
                                    PR #{attempt.pr_number}
                                  </a>
                                )}
                                {attempt.quality_score_after !== null && (
                                  <span className="text-xs text-slate-400">
                                    Quality: {attempt.quality_score_before ?? '?'} → {attempt.quality_score_after}
                                  </span>
                                )}
                              </div>
                              {attempt.error_message && (
                                <p className="text-xs text-red-500 mt-1">{attempt.error_message}</p>
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
                                  {i > 0 && <div className={`h-0.5 w-6 ${isActive ? 'bg-sky-900/200' : 'bg-slate-700'}`} />}
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                                    ${isActive ? 'bg-sky-900/200 text-white' : 'bg-slate-700 text-slate-400'}
                                    ${isCurrent ? 'ring-2 ring-sky-300' : ''}`}>
                                    {i + 1}
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          </div>
                          <div className="flex justify-center mt-2" style={{ gap: isLoopMode ? '0.5rem' : '1rem' }}>
                            {stepLabels.map((label) => (
                              <span key={label} className="text-xs text-slate-400">{label}</span>
                            ))}
                          </div>
                        </div>

                        {/* Iteration indicator for loop mode */}
                        {currentAttempt.iteration_count > 0 && currentAttempt.max_iterations > 1 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                              <FiRefreshCw className="h-3 w-3" />
                              Iteration {currentAttempt.iteration_count} of {currentAttempt.max_iterations}
                            </div>
                            {/* Iteration progress bar */}
                            <div className="w-48 mx-auto mt-1.5 bg-slate-900 rounded-full h-1.5">
                              <div
                                className="bg-sky-900/200 h-1.5 rounded-full transition-all"
                                style={{ width: `${(currentAttempt.iteration_count / currentAttempt.max_iterations) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {isInProgress && (
                          <div className="flex items-center justify-center gap-2 text-sky-600">
                            <FiLoader className="h-5 w-5 animate-spin" />
                            <span className="font-medium">{STATUS_LABELS[currentAttempt.status]?.label}</span>
                          </div>
                        )}
                      </div>

                      {/* Verified state */}
                      {currentAttempt.status === 'verified' && (
                        <div className="bg-green-900/20 border border-green-800 p-4 rounded-lg">
                          <div className="flex items-center gap-2 text-green-400 font-semibold mb-2">
                            <FiCheck className="h-5 w-5" />
                            Bug Verified Fixed!
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            {currentAttempt.quality_score_before !== null && (
                              <div className="text-center p-2 bg-green-900/30 rounded">
                                <div className="text-xs text-green-600">Before</div>
                                <div className="text-lg font-bold text-green-400">{currentAttempt.quality_score_before}</div>
                              </div>
                            )}
                            {currentAttempt.quality_score_after !== null && (
                              <div className="text-center p-2 bg-green-900/30 rounded">
                                <div className="text-xs text-green-600">After</div>
                                <div className="text-lg font-bold text-green-400">{currentAttempt.quality_score_after}</div>
                              </div>
                            )}
                          </div>
                          {currentAttempt.pr_url && (
                            <a
                              href={currentAttempt.pr_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <FiExternalLink className="h-4 w-4" />
                              View PR #{currentAttempt.pr_number} on GitHub
                            </a>
                          )}
                          {currentAttempt.claude_reasoning && (
                            <div className="mt-3">
                              <div className="text-sm font-medium text-green-400 mb-1">Fix Explanation:</div>
                              <p className="text-sm text-green-400">{currentAttempt.claude_reasoning}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* PR Created (simple mode) */}
                      {currentAttempt.status === 'pr_created' && mode === 'simple' && (
                        <div className="bg-green-900/20 p-4 rounded-lg">
                          <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
                            <FiCheck className="h-5 w-5" />
                            Pull Request Created!
                          </div>
                          {currentAttempt.pr_url && (
                            <a
                              href={currentAttempt.pr_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <FiExternalLink className="h-4 w-4" />
                              View PR #{currentAttempt.pr_number} on GitHub
                            </a>
                          )}
                          {currentAttempt.claude_reasoning && (
                            <div className="mt-3">
                              <div className="text-sm font-medium text-green-400 mb-1">Fix Explanation:</div>
                              <p className="text-sm text-green-400">{currentAttempt.claude_reasoning}</p>
                            </div>
                          )}
                          {currentAttempt.relevant_files && currentAttempt.relevant_files.length > 0 && (
                            <div className="mt-3">
                              <div className="text-sm font-medium text-green-400 mb-1">Files Modified:</div>
                              <div className="space-y-1">
                                {(Array.isArray(currentAttempt.relevant_files) ? currentAttempt.relevant_files : []).map((f: string) => (
                                  <div key={f} className="text-xs text-green-400 font-mono bg-green-900/30 px-2 py-1 rounded">{f}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Needs Review state */}
                      {currentAttempt.status === 'needs_review' && (
                        <div className="bg-yellow-900/20 border border-yellow-800 p-4 rounded-lg">
                          <div className="flex items-center gap-2 text-yellow-400 font-semibold mb-2">
                            <FiAlertTriangle className="h-5 w-5" />
                            Manual Review Needed
                          </div>
                          <p className="text-sm text-yellow-400 mb-3">
                            {currentAttempt.verification_status === 'regression'
                              ? 'The fix may have introduced new issues. Quality score decreased.'
                              : `Auto-fix reached ${currentAttempt.iteration_count}/${currentAttempt.max_iterations} iterations without fully resolving the bug.`}
                          </p>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            {currentAttempt.quality_score_before !== null && (
                              <div className="text-center p-2 bg-yellow-900/30 rounded">
                                <div className="text-xs text-yellow-600">Before</div>
                                <div className="text-lg font-bold text-yellow-400">{currentAttempt.quality_score_before}</div>
                              </div>
                            )}
                            {currentAttempt.quality_score_after !== null && (
                              <div className="text-center p-2 bg-yellow-900/30 rounded">
                                <div className="text-xs text-yellow-600">After</div>
                                <div className="text-lg font-bold text-yellow-400">{currentAttempt.quality_score_after}</div>
                              </div>
                            )}
                          </div>
                          {currentAttempt.pr_url && (
                            <a
                              href={currentAttempt.pr_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                            >
                              <FiExternalLink className="h-4 w-4" />
                              Review PR #{currentAttempt.pr_number} on GitHub
                            </a>
                          )}
                        </div>
                      )}

                      {/* Failed state */}
                      {currentAttempt.status === 'failed' && (
                        <div className="bg-red-900/20 p-4 rounded-lg">
                          <div className="flex items-center gap-2 text-red-400 font-medium mb-1">
                            <FiX className="h-5 w-5" />
                            Auto-Fix Failed
                          </div>
                          <p className="text-sm text-red-600">{currentAttempt.error_message || 'An unknown error occurred'}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Start new attempt */
                    <div className="space-y-4">
                      {/* Repo selector */}
                      <div>
                        <label className="block text-sm font-medium text-slate-200 mb-1">Target Repository</label>
                        <select
                          value={selectedRepo}
                          onChange={e => setSelectedRepo(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                          {repos.map(r => (
                            <option key={r.id} value={r.id}>{r.owner}/{r.repo}</option>
                          ))}
                        </select>
                      </div>

                      {/* Mode selector */}
                      <div>
                        <label className="block text-sm font-medium text-slate-200 mb-2">Fix Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setMode('loop')}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              mode === 'loop'
                                ? 'border-sky-500 bg-sky-900/20'
                                : 'border-slate-700 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <FiZap className={`h-4 w-4 ${mode === 'loop' ? 'text-sky-600' : 'text-slate-500'}`} />
                              <span className={`text-sm font-semibold ${mode === 'loop' ? 'text-sky-400' : 'text-slate-200'}`}>
                                Fix + Merge + Verify
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              Fix → PR → Merge → Retest → Iterate until quality met
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setMode('simple')}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              mode === 'simple'
                                ? 'border-sky-500 bg-sky-900/20'
                                : 'border-slate-700 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <FiCode className={`h-4 w-4 ${mode === 'simple' ? 'text-sky-600' : 'text-slate-500'}`} />
                              <span className={`text-sm font-semibold ${mode === 'simple' ? 'text-sky-400' : 'text-slate-200'}`}>
                                PR Only
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              Generate fix and create PR (no retest)
                            </p>
                          </button>
                        </div>
                      </div>

                      {/* Loop options */}
                      {mode === 'loop' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                            <div>
                              <div className="text-sm font-medium text-slate-200">Auto-merge PRs</div>
                              <div className="text-xs text-slate-400">Automatically merge PRs into the default branch</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAutoMerge(!autoMerge)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                autoMerge ? 'bg-sky-900/200' : 'bg-slate-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-slate-800 transition-transform ${
                                  autoMerge ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Max Iterations</label>
                            <select
                              value={maxIterations}
                              onChange={e => setMaxIterations(Number(e.target.value))}
                              className="w-full px-3 py-2 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                            >
                              <option value={1}>1</option>
                              <option value={2}>2</option>
                              <option value={3}>3 (recommended)</option>
                              <option value={5}>5</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Quality Target</label>
                            <select
                              value={qualityThreshold}
                              onChange={e => setQualityThreshold(Number(e.target.value))}
                              className="w-full px-3 py-2 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                            >
                              <option value={60}>60% (lenient)</option>
                              <option value={70}>70%</option>
                              <option value={80}>80% (recommended)</option>
                              <option value={90}>90% (strict)</option>
                            </select>
                          </div>
                        </div>
                        </div>
                      )}

                      {/* How it works */}
                      <div className="bg-sky-900/20 p-4 rounded-lg text-sm text-sky-400">
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
            <div className="p-5 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-slate-200 bg-slate-900 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
              {repos.length > 0 && !currentAttempt && (
                <button
                  onClick={handleStart}
                  disabled={starting || !selectedRepo}
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {starting ? (
                    <>
                      <FiLoader className="h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : mode === 'loop' ? (
                    <>
                      <FiZap className="h-4 w-4" />
                      Fix + Merge + Verify
                    </>
                  ) : (
                    <>
                      <FiCode className="h-4 w-4" />
                      Generate Fix
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
