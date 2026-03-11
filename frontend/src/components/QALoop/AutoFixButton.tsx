import React, { useState, useEffect, useRef } from 'react';
import { FiGitPullRequest, FiCheck, FiX, FiLoader, FiExternalLink, FiCode } from 'react-icons/fi';
import { apiClient } from '../../services/api';

interface GitHubRepo {
  id: string;
  owner: string;
  repo: string;
  default_branch: string;
}

interface AutoFixAttempt {
  id: string;
  status: 'pending' | 'analyzing' | 'generating' | 'pr_created' | 'verified' | 'failed';
  branch_name: string | null;
  pr_number: number | null;
  pr_url: string | null;
  relevant_files: string[];
  generated_diff: string | null;
  claude_reasoning: string | null;
  error_message: string | null;
  created_at: string;
}

interface AutoFixButtonProps {
  bugId: string;
  bugTitle: string;
  className?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Starting...', color: 'text-gray-500', icon: <FiLoader className="h-3 w-3 animate-spin" /> },
  analyzing: { label: 'Analyzing code...', color: 'text-blue-500', icon: <FiLoader className="h-3 w-3 animate-spin" /> },
  generating: { label: 'Generating fix...', color: 'text-purple-500', icon: <FiLoader className="h-3 w-3 animate-spin" /> },
  pr_created: { label: 'PR Created', color: 'text-green-600', icon: <FiCheck className="h-3 w-3" /> },
  verified: { label: 'Verified', color: 'text-green-600', icon: <FiCheck className="h-3 w-3" /> },
  failed: { label: 'Failed', color: 'text-red-500', icon: <FiX className="h-3 w-3" /> },
};

export const AutoFixButton: React.FC<AutoFixButtonProps> = ({ bugId, bugTitle, className = '' }) => {
  const [showModal, setShowModal] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [attempts, setAttempts] = useState<AutoFixAttempt[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<AutoFixAttempt | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const workspaceId = localStorage.getItem('workspace_id') || '';

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
    setShowDiff(false);
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
      const res = await apiClient.post(`/bugs/${bugId}/auto-fix`, {
        github_repo_id: selectedRepo,
      });
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
        if (['pr_created', 'verified', 'failed'].includes(res.data.status)) {
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

  const isInProgress = currentAttempt && ['pending', 'analyzing', 'generating'].includes(currentAttempt.status);

  return (
    <>
      <button
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors ${className}`}
        title="Auto-fix: Generate a PR to fix this bug"
      >
        <FiGitPullRequest className="h-3 w-3" />
        <span>Auto-Fix</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClose}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FiGitPullRequest className="h-5 w-5 text-purple-600" />
                Auto-Fix Bug
              </h3>
              <p className="text-sm text-gray-500 mt-1 truncate">{bugTitle}</p>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {loading ? (
                <div className="text-center py-4 text-gray-500">Loading...</div>
              ) : repos.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 mb-3">No GitHub repositories connected</p>
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
                      <div className="text-xs font-medium text-gray-500 uppercase mb-2">Previous Attempts</div>
                      <div className="space-y-2">
                        {attempts.map((attempt) => {
                          const statusInfo = STATUS_LABELS[attempt.status] || STATUS_LABELS.pending;
                          return (
                            <div key={attempt.id} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {statusInfo.icon}
                                  <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                                </div>
                                <span className="text-xs text-gray-400">{new Date(attempt.created_at).toLocaleString()}</span>
                              </div>
                              {attempt.pr_url && (
                                <a
                                  href={attempt.pr_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-2 text-sm text-primary-600 hover:text-primary-700"
                                >
                                  <FiExternalLink className="h-3 w-3" />
                                  PR #{attempt.pr_number}
                                </a>
                              )}
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
                      <div className="text-center py-2">
                        <div className="mb-4">
                          {/* Progress steps */}
                          <div className="flex items-center justify-center gap-1">
                            {['analyzing', 'generating', 'pr_created'].map((step, i) => {
                              const steps = ['pending', 'analyzing', 'generating', 'pr_created'];
                              const currentIdx = steps.indexOf(currentAttempt.status);
                              const stepIdx = steps.indexOf(step);
                              const isActive = stepIdx <= currentIdx;
                              const isCurrent = step === currentAttempt.status || (currentAttempt.status === 'pending' && step === 'analyzing');
                              return (
                                <React.Fragment key={step}>
                                  {i > 0 && <div className={`h-0.5 w-8 ${isActive ? 'bg-purple-500' : 'bg-gray-200'}`} />}
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                                    ${isActive ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-500'}
                                    ${isCurrent ? 'ring-2 ring-purple-300' : ''}`}>
                                    {i + 1}
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          </div>
                          <div className="flex justify-center gap-4 mt-2">
                            <span className="text-xs text-gray-500">Analyze</span>
                            <span className="text-xs text-gray-500">Generate</span>
                            <span className="text-xs text-gray-500">PR</span>
                          </div>
                        </div>

                        {isInProgress && (
                          <div className="flex items-center justify-center gap-2 text-purple-600">
                            <FiLoader className="h-5 w-5 animate-spin" />
                            <span className="font-medium">{STATUS_LABELS[currentAttempt.status]?.label}</span>
                          </div>
                        )}
                      </div>

                      {/* Success state */}
                      {currentAttempt.status === 'pr_created' && (
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
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
                              <div className="text-sm font-medium text-green-800 mb-1">Fix Explanation:</div>
                              <p className="text-sm text-green-700">{currentAttempt.claude_reasoning}</p>
                            </div>
                          )}
                          {currentAttempt.relevant_files && currentAttempt.relevant_files.length > 0 && (
                            <div className="mt-3">
                              <div className="text-sm font-medium text-green-800 mb-1">Files Modified:</div>
                              <div className="space-y-1">
                                {(Array.isArray(currentAttempt.relevant_files) ? currentAttempt.relevant_files : []).map((f: string) => (
                                  <div key={f} className="text-xs text-green-700 font-mono bg-green-100 px-2 py-1 rounded">{f}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Failed state */}
                      {currentAttempt.status === 'failed' && (
                        <div className="bg-red-50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                            <FiX className="h-5 w-5" />
                            Auto-Fix Failed
                          </div>
                          <p className="text-sm text-red-600">{currentAttempt.error_message || 'An unknown error occurred'}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Start new attempt */
                    <div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Target Repository</label>
                        <select
                          value={selectedRepo}
                          onChange={e => setSelectedRepo(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                          {repos.map(r => (
                            <option key={r.id} value={r.id}>{r.owner}/{r.repo}</option>
                          ))}
                        </select>
                      </div>

                      <div className="bg-purple-50 p-4 rounded-lg text-sm text-purple-700">
                        <p className="font-medium mb-1">How it works:</p>
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                          <li>AI analyzes the bug report and finds relevant source files</li>
                          <li>Claude generates a code fix based on the bug context</li>
                          <li>A pull request is created on a new branch for your review</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              {repos.length > 0 && !currentAttempt && (
                <button
                  onClick={handleStart}
                  disabled={starting || !selectedRepo}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {starting ? (
                    <>
                      <FiLoader className="h-4 w-4 animate-spin" />
                      Starting...
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
