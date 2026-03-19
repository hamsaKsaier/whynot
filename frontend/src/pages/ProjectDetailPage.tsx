import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiBook,
  FiZap,
  FiGlobe,
  FiFolder,
  FiCopy,
  FiGitBranch,
  FiChevronDown,
  FiChevronRight,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiRefreshCw,
  FiClock,
  FiImage,
  FiDownload,
} from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Alert } from '../components/common/Alert';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { Modal, ModalFooter } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { QuickActions } from '../components/common/QuickActions';
import { useClipboard } from '../hooks/useClipboard';
import { useFormAutoSave } from '../hooks/useFormAutoSave';
import {
  getProject,
  updateProject,
  getUserStories,
  createUserStory,
  updateUserStory,
  deleteUserStory,
  getFolders,
  assignUserStoryToFolder,
  ProjectWithStats,
  UserStoryWithStats,
  FolderWithStats,
} from '../services/api';
import { Select } from '../components/common/Select';
import {
  listQALoopSessions,
  QALoopSession,
  getProjectTestSuiteHierarchy,
  retestBug,
  exportTestCasePlaywright,
  exportTestSuitePlaywright,
  TestSuiteHierarchy,
  TestSuiteHierarchyTestCase,
  TestSuiteHierarchyBug,
} from '../services/qa-loop-api';

interface UserStoryFormData {
  story: string;
  website_url: string;
  additional_context: string;
}

const initialUserStoryFormData: UserStoryFormData = {
  story: '',
  website_url: '',
  additional_context: '',
};

// ── Severity helpers ──────────────────────────────────────────────────────────

const severityColor = (severity: string): string => {
  switch (severity) {
    case 'critical': return 'bg-red-900/30 text-red-300 border-red-800';
    case 'high': return 'bg-orange-900/30 text-orange-300 border-orange-200';
    case 'medium': return 'bg-yellow-900/30 text-yellow-300 border-yellow-700';
    case 'low': return 'bg-blue-900/30 text-blue-300 border-blue-800';
    default: return 'bg-slate-800 text-slate-200 border-slate-700';
  }
};

const statusIcon = (status: string | null) => {
  switch (status) {
    case 'passed': return <FiCheckCircle className="h-4 w-4 text-emerald-500" />;
    case 'failed': return <FiXCircle className="h-4 w-4 text-red-500" />;
    case 'error': return <FiAlertTriangle className="h-4 w-4 text-orange-500" />;
    default: return <FiClock className="h-4 w-4 text-slate-500" />;
  }
};

// ── Bug Detail Component (Task 4) ─────────────────────────────────────────────

const BugDetailCard: React.FC<{
  bug: TestSuiteHierarchyBug;
  testCaseName?: string;
  onRetest: (bugId: string) => void;
  retesting: string | null;
}> = ({ bug, testCaseName, onRetest, retesting }) => {
  const [expanded, setExpanded] = useState(false);
  const reproSteps = Array.isArray(bug.reproduction_steps) ? bug.reproduction_steps : [];
  const screenshots = Array.isArray(bug.evidence_screenshots) ? bug.evidence_screenshots : [];

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800/50">
      <div
        className="p-3 cursor-pointer hover:bg-slate-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {expanded ? (
              <FiChevronDown className="h-3 w-3 text-slate-500 flex-shrink-0" />
            ) : (
              <FiChevronRight className="h-3 w-3 text-slate-500 flex-shrink-0" />
            )}
            <span className="font-medium text-slate-200 truncate">{bug.title}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onRetest(bug.id)}
              isLoading={retesting === bug.id}
              disabled={retesting !== null}
            >
              <FiRefreshCw className="mr-1 h-3 w-3" />
              Retest
            </Button>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${severityColor(bug.severity)}`}>
              {bug.severity}
            </span>
          </div>
        </div>
        {bug.description && (
          <p className="text-sm text-slate-500 mt-1 ml-5 line-clamp-2">{bug.description}</p>
        )}
        <div className="text-xs text-slate-400 mt-1.5 ml-5 flex items-center gap-3 flex-wrap">
          {bug.category && <span className="bg-slate-700 px-1.5 py-0.5 rounded">{bug.category}</span>}
          {bug.bug_type && <span className="bg-slate-700 px-1.5 py-0.5 rounded">{bug.bug_type}</span>}
          <span className={bug.status === 'open' ? 'text-red-400' : bug.status === 'fixed' ? 'text-emerald-400' : 'text-amber-400'}>
            {bug.status}
          </span>
          {screenshots.length > 0 && (
            <span className="flex items-center gap-0.5 text-blue-400">
              <FiImage className="h-3 w-3" /> {screenshots.length}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700 pt-3 ml-5 space-y-3">
          {/* Test case that found this bug */}
          {testCaseName && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Found by Test Case</div>
              <p className="text-sm text-slate-400">{testCaseName}</p>
            </div>
          )}

          {/* Reproduction steps */}
          {reproSteps.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Reproduction Steps</div>
              <ol className="list-decimal list-inside space-y-1">
                {reproSteps.map((step: any, i: number) => (
                  <li key={i} className="text-sm text-slate-400">
                    {typeof step === 'string' ? step : step.description || step.action || JSON.stringify(step)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Evidence screenshots */}
          {screenshots.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Evidence Screenshots</div>
              <div className="grid grid-cols-2 gap-2">
                {screenshots.map((src: string, i: number) => (
                  <a key={i} href={src.startsWith('/') ? `/api/screenshots${src}` : src} target="_blank" rel="noopener noreferrer">
                    <img
                      src={src.startsWith('/') ? `/api/screenshots${src}` : src}
                      alt={`Evidence ${i + 1}`}
                      className="rounded border border-slate-600 w-full h-32 object-cover hover:opacity-80 transition-opacity"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Video */}
          {bug.video_path && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Session Recording</div>
              <video
                controls
                preload="metadata"
                className="w-full rounded-lg max-h-48 bg-black"
                src={`/api/videos/${bug.video_path}`}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {/* Root cause */}
          {bug.root_cause && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Root Cause</div>
              <p className="text-sm text-slate-400">{bug.root_cause}</p>
            </div>
          )}

          {/* Suggested fix */}
          {bug.suggested_fix && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Suggested Fix</div>
              <p className="text-sm text-slate-400">{bug.suggested_fix}</p>
            </div>
          )}

          {/* Page URL */}
          {bug.page_url && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Page URL</div>
              <a
                href={bug.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-400 hover:text-primary-300 break-all"
              >
                {bug.page_url}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Confidence Badge Helper ─────────────────────────────────────────────────

const ConfidenceBadge: React.FC<{ confidenceScore: number | null; totalRuns: number }> = ({ confidenceScore, totalRuns }) => {
  if (totalRuns === 0 || confidenceScore === null) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-500 border border-slate-600">
        Not Tested
      </span>
    );
  }
  if (confidenceScore >= 90) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        High Confidence
      </span>
    );
  }
  if (confidenceScore >= 60) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
        Medium Confidence
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
      Low Confidence
    </span>
  );
};

// ── Test Case Row Component ───────────────────────────────────────────────────

const TestCaseRow: React.FC<{
  testCase: TestSuiteHierarchyTestCase;
  onRetestBug: (bugId: string) => void;
  retestingBug: string | null;
}> = ({ testCase, onRetestBug, retestingBug }) => {
  const [expanded, setExpanded] = useState(false);
  const hasBugs = testCase.bugs.length > 0;

  const handleExportPlaywright = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await exportTestCasePlaywright(testCase.id);
    } catch (err) {
      console.error('Failed to export Playwright code:', err);
    }
  };

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <div
        className="p-3 cursor-pointer hover:bg-slate-700/30 transition-colors flex items-center justify-between gap-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasBugs ? (
            expanded ? <FiChevronDown className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" /> : <FiChevronRight className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
          ) : (
            <span className="w-3.5" />
          )}
          {statusIcon(testCase.last_run_status)}
          <span className="text-sm text-slate-300 truncate">{testCase.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ConfidenceBadge confidenceScore={testCase.confidence_score} totalRuns={testCase.total_runs} />
          <button
            onClick={handleExportPlaywright}
            className="text-xs bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded-full hover:bg-primary-500/20 transition-colors flex items-center gap-1"
            title="Export as Playwright"
          >
            <FiDownload className="h-3 w-3" />
            Export
          </button>
          {hasBugs && (
            <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">
              {testCase.bugs.length} bug{testCase.bugs.length !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{testCase.category}</span>
          {testCase.pass_count > 0 && (
            <span className="text-xs text-emerald-400">{testCase.pass_count}P</span>
          )}
          {testCase.fail_count > 0 && (
            <span className="text-xs text-red-400">{testCase.fail_count}F</span>
          )}
        </div>
      </div>

      {expanded && hasBugs && (
        <div className="border-t border-slate-700 p-3 space-y-2 bg-slate-800/30">
          {testCase.bugs.map((bug) => (
            <BugDetailCard
              key={bug.id}
              bug={bug}
              testCaseName={testCase.name}
              onRetest={onRetestBug}
              retesting={retestingBug}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Test Suite Card Component ─────────────────────────────────────────────────

const TestSuiteCard: React.FC<{
  suite: TestSuiteHierarchy;
  onRetestBug: (bugId: string) => void;
  retestingBug: string | null;
}> = ({ suite, onRetestBug, retestingBug }) => {
  const [expanded, setExpanded] = useState(false);
  const totalBugs = suite.test_cases.reduce((sum, tc) => sum + tc.bugs.length, 0) + suite.unlinked_bugs.length;
  const passedTests = suite.test_cases.filter(tc => tc.last_run_status === 'passed').length;
  const failedTests = suite.test_cases.filter(tc => tc.last_run_status === 'failed').length;

  const handleExportSuite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await exportTestSuitePlaywright(suite.id);
    } catch (err) {
      console.error('Failed to export Playwright suite:', err);
    }
  };

  return (
    <Card>
      <div
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {expanded ? <FiChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0" /> : <FiChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />}
            <FiZap className="h-5 w-5 text-primary-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-200 truncate">{suite.name}</span>
                {suite.is_qa_generated && (
                  <span className="text-xs bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded-full border border-primary-500/20 flex-shrink-0">
                    QA Scan
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                <span>{suite.test_cases.length} tests</span>
                {passedTests > 0 && <span className="text-emerald-400">{passedTests} passed</span>}
                {failedTests > 0 && <span className="text-red-400">{failedTests} failed</span>}
                {totalBugs > 0 && <span className="text-red-400">{totalBugs} bugs</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleExportSuite}
              className="text-xs bg-primary-500/10 text-primary-400 px-2.5 py-1 rounded-full hover:bg-primary-500/20 transition-colors flex items-center gap-1"
              title="Export Suite as Playwright"
            >
              <FiDownload className="h-3 w-3" />
              Export Suite
            </button>
            {suite.quality_score > 0 && (
              <span className={`text-sm font-semibold ${
                suite.quality_score >= 80 ? 'text-emerald-400' :
                suite.quality_score >= 50 ? 'text-amber-400' :
                'text-red-400'
              }`}>{suite.quality_score}%</span>
            )}
            <span className={`text-xs px-2 py-1 rounded-full ${
              suite.status === 'running' ? 'bg-sky-500/10 text-sky-400' :
              suite.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
              'bg-slate-9000/10 text-slate-500'
            }`}>{suite.status}</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2 border-t border-slate-700 pt-4">
          {suite.test_cases.length === 0 && suite.unlinked_bugs.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No test cases or bugs in this suite.</p>
          )}

          {suite.test_cases.map((tc) => (
            <TestCaseRow
              key={tc.id}
              testCase={tc}
              onRetestBug={onRetestBug}
              retestingBug={retestingBug}
            />
          ))}

          {suite.unlinked_bugs.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Unlinked Bugs</h4>
              <div className="space-y-2">
                {suite.unlinked_bugs.map((bug) => (
                  <BugDetailCard
                    key={bug.id}
                    bug={bug}
                    onRetest={onRetestBug}
                    retesting={retestingBug}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

// ── Main Page Component ───────────────────────────────────────────────────────

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { copyToClipboard } = useClipboard();

  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [userStories, setUserStories] = useState<UserStoryWithStats[]>([]);
  const [folders, setFolders] = useState<FolderWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qaLoopSessions, setQALoopSessions] = useState<QALoopSession[]>([]);
  const [testSuiteHierarchy, setTestSuiteHierarchy] = useState<TestSuiteHierarchy[]>([]);
  const [retestingBug, setRetestingBug] = useState<string | null>(null);

  // Project edit state
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectWebsiteUrl, setProjectWebsiteUrl] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  // User story modal state
  const [isUserStoryModalOpen, setIsUserStoryModalOpen] = useState(false);
  const [editingUserStory, setEditingUserStory] = useState<UserStoryWithStats | null>(null);
  const [userStoryFormData, setUserStoryFormData] = useState<UserStoryFormData>(
    initialUserStoryFormData
  );
  const [userStoryFormErrors, setUserStoryFormErrors] = useState<Partial<UserStoryFormData>>({});
  const [submittingUserStory, setSubmittingUserStory] = useState(false);
  // Auto-save user story form data
  const { loadDraft, clearDraft, hasDraft } = useFormAutoSave(
    editingUserStory ? `user-story-edit-${editingUserStory.id}` : `user-story-create-${id}`,
    userStoryFormData,
    {
      enabled: isUserStoryModalOpen,
      onRestore: (data: UserStoryFormData) => {
        setUserStoryFormData(data);
      },
    }
  );

  // Check for draft when modal opens
  useEffect(() => {
    if (isUserStoryModalOpen && hasDraft() && !editingUserStory) {
    }
  }, [isUserStoryModalOpen, hasDraft, editingUserStory]);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    userStory: UserStoryWithStats | null;
  }>({ isOpen: false, userStory: null });

  useEffect(() => {
    if (id) {
      fetchProjectData();
    }
  }, [id]);

  const fetchProjectData = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const [projectResponse, userStoriesResponse, foldersResponse, qaSessionsResponse, hierarchyResponse] = await Promise.all([
        getProject(id),
        getUserStories(id),
        getFolders(id).catch(() => ({ folders: [] })),
        listQALoopSessions({ projectId: id, limit: 5 }).catch(() => ({ sessions: [], total: 0 })),
        getProjectTestSuiteHierarchy(id).catch(() => ({ suites: [] })),
      ]);
      setProject(projectResponse.project);
      setUserStories(userStoriesResponse.user_stories);
      setFolders(foldersResponse.folders || []);
      setQALoopSessions(qaSessionsResponse.sessions || []);
      setTestSuiteHierarchy(hierarchyResponse.suites || []);

      // Initialize edit form
      setProjectName(projectResponse.project.name);
      setProjectDescription(projectResponse.project.description || '');
      setProjectWebsiteUrl(projectResponse.project.website_url || '');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch project');
    } finally {
      setLoading(false);
    }
  };

  const handleRetestBug = useCallback(async (bugId: string) => {
    setRetestingBug(bugId);
    try {
      await retestBug(bugId);
      // Refresh hierarchy to pick up status changes after a short delay
      setTimeout(() => {
        if (id) {
          getProjectTestSuiteHierarchy(id).then(r => setTestSuiteHierarchy(r.suites || [])).catch(() => {});
        }
      }, 3000);
    } catch (err: any) {
      const humanError = err.response?.data?.humanError;
      setError(humanError || err.response?.data?.error || err.message || 'Failed to start retest');
    } finally {
      setRetestingBug(null);
    }
  }, [id]);

  const handleAssignFolder = async (userStoryId: string, folderId: string | null) => {
    try {
      await assignUserStoryToFolder(userStoryId, folderId);
      if (id) {
        const userStoriesResponse = await getUserStories(id);
        setUserStories(userStoriesResponse.user_stories);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to assign folder');
    }
  };

  const handleSaveProject = async () => {
    if (!id || !projectName.trim()) return;

    setSavingProject(true);
    try {
      const response = await updateProject(id, {
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
        website_url: projectWebsiteUrl.trim() || undefined,
      });
      setProject({ ...project!, ...response.project });
      setIsEditingProject(false);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update project');
    } finally {
      setSavingProject(false);
    }
  };

  const cancelEditProject = () => {
    if (project) {
      setProjectName(project.name);
      setProjectDescription(project.description || '');
      setProjectWebsiteUrl(project.website_url || '');
    }
    setIsEditingProject(false);
  };

  const openCreateUserStoryModal = () => {
    setEditingUserStory(null);
    const draft = loadDraft();
    if (draft) {
      setUserStoryFormData(draft);
    } else {
      setUserStoryFormData({
        ...initialUserStoryFormData,
        website_url: project?.website_url || '',
      });
    }
    setUserStoryFormErrors({});
    setIsUserStoryModalOpen(true);
  };

  const openEditUserStoryModal = (userStory: UserStoryWithStats) => {
    setEditingUserStory(userStory);
    setUserStoryFormData({
      story: userStory.story,
      website_url: userStory.website_url || '',
      additional_context: userStory.additional_context || '',
    });
    setUserStoryFormErrors({});
    setIsUserStoryModalOpen(true);
  };

  const closeUserStoryModal = () => {
    setIsUserStoryModalOpen(false);
    setEditingUserStory(null);
    setUserStoryFormData(initialUserStoryFormData);
    setUserStoryFormErrors({});
  };

  const validateUserStoryForm = (): boolean => {
    const errors: Partial<UserStoryFormData> = {};

    if (!userStoryFormData.story.trim()) {
      errors.story = 'User story is required';
    } else if (userStoryFormData.story.trim().length < 10) {
      errors.story = 'User story must be at least 10 characters';
    }

    if (userStoryFormData.website_url && !isValidUrl(userStoryFormData.website_url)) {
      errors.website_url = 'Please enter a valid URL';
    }

    setUserStoryFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmitUserStory = async () => {
    if (!id || !validateUserStoryForm()) return;

    setSubmittingUserStory(true);
    try {
      if (editingUserStory) {
        await updateUserStory(editingUserStory.id, {
          story: userStoryFormData.story.trim(),
          website_url: userStoryFormData.website_url.trim() || undefined,
          additional_context: userStoryFormData.additional_context.trim() || undefined,
        });
      } else {
        await createUserStory(id, {
          story: userStoryFormData.story.trim(),
          website_url: userStoryFormData.website_url.trim() || undefined,
          additional_context: userStoryFormData.additional_context.trim() || undefined,
        });
      }
      clearDraft();
      closeUserStoryModal();
      fetchProjectData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save user story');
    } finally {
      setSubmittingUserStory(false);
    }
  };

  const handleDeleteUserStory = async () => {
    if (!deleteConfirm.userStory) return;

    try {
      await deleteUserStory(deleteConfirm.userStory.id);
      setDeleteConfirm({ isOpen: false, userStory: null });
      fetchProjectData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete user story');
      setDeleteConfirm({ isOpen: false, userStory: null });
    }
  };

  const handleStartQASession = (userStory?: UserStoryWithStats) => {
    navigate('/qa-loop', {
      state: {
        projectId: id,
        websiteUrl: userStory?.website_url || project?.website_url,
        userStoryContext: userStory?.story,
      },
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader width="w-32" height="h-4" className="mb-4" />
        <Card>
          <div className="flex items-start gap-4">
            <SkeletonLoader width="w-16" height="h-16" circle={true} />
            <div className="flex-1 space-y-3">
              <SkeletonLoader width="w-48" height="h-8" />
              <SkeletonLoader width="w-full" height="h-4" />
              <SkeletonLoader width="w-64" height="h-4" />
            </div>
          </div>
        </Card>
        <div className="page-section">
          <SkeletonLoader width="w-40" height="h-6" className="mb-4" />
          <div className="space-y-3">
            <SkeletonLoader width="w-full" height="h-20" />
            <SkeletonLoader width="w-full" height="h-20" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-white">Project not found</h2>
        <Button className="mt-4" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumbs
        items={[
          { label: 'Projects', path: '/projects', icon: <FiFolder className="h-4 w-4" /> },
          { label: project.name },
        ]}
      />

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Project Header */}
      <Card>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-900/30 rounded-lg">
              <FiFolder className="h-8 w-8 text-blue-600" />
            </div>
            {isEditingProject ? (
              <div className="space-y-3 flex-1">
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name"
                  className="max-w-md"
                />
                <Textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="max-w-md"
                />
                <Input
                  value={projectWebsiteUrl}
                  onChange={(e) => setProjectWebsiteUrl(e.target.value)}
                  placeholder="Website URL (optional)"
                  type="url"
                  className="max-w-md"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveProject} isLoading={savingProject}>
                    Save
                  </Button>
                  <Button size="sm" variant="secondary" onClick={cancelEditProject}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-white">{project.name}</h1>
                {project.description && (
                  <p className="mt-1 text-slate-400">{project.description}</p>
                )}
                {project.website_url && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-slate-400">
                    <FiGlobe className="h-4 w-4" />
                    <a
                      href={project.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary-600"
                    >
                      {project.website_url}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
          {!isEditingProject && (
            <div className="flex gap-2">
              <Button onClick={() => handleStartQASession()}>
                <FiZap className="mr-1" />
                Start QA Session
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/architecture-flow')}>
                <FiGitBranch className="mr-1" />
                Architecture
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsEditingProject(true)}>
                <FiEdit2 className="mr-1" />
                Edit
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Test Suite Hierarchy (Task 2) */}
      {testSuiteHierarchy.length > 0 && (
        <div className="page-section">
          <h2 className="section-title mb-4">
            <FiZap className="inline h-5 w-5 mr-2 text-primary-400" />
            Test Suites ({testSuiteHierarchy.length})
          </h2>
          <div className="space-y-3">
            {testSuiteHierarchy.map((suite) => (
              <TestSuiteCard
                key={suite.id}
                suite={suite}
                onRetestBug={handleRetestBug}
                retestingBug={retestingBug}
              />
            ))}
          </div>
        </div>
      )}

      {/* User Stories Section */}
      <div className="page-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">
            User Stories ({userStories.length})
          </h2>
          <Button size="sm" onClick={openCreateUserStoryModal}>
            <FiPlus className="mr-1" />
            Add User Story
          </Button>
        </div>

        {userStories.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FiBook />}
              title="No user stories yet"
              description="Add user stories to generate test cases for this project"
              action={
                <Button size="sm" onClick={openCreateUserStoryModal}>
                  <FiPlus className="mr-1" />
                  Add User Story
                </Button>
              }
              tip="Tip: User stories describe what users want to accomplish, and WhyNot will generate test cases from them"
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {userStories.map((userStory) => (
              <Card key={userStory.id} hoverable>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-green-900/30 rounded-lg mt-0.5">
                        <FiBook className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white">{userStory.story}</p>
                        {userStory.website_url && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                            <FiGlobe className="h-3 w-3" />
                            <span>{userStory.website_url}</span>
                          </div>
                        )}
                        {userStory.additional_context && (
                          <p className="mt-2 text-sm text-slate-400 italic">
                            {userStory.additional_context}
                          </p>
                        )}
                        <div className="mt-2 text-xs text-slate-500">
                          {userStory.test_case_count} test cases
                        </div>
                        {folders.length > 0 && (
                          <div className="mt-3">
                            <Select
                              label="Folder"
                              value={(userStory as any).folder_id || ''}
                              onChange={(value) => handleAssignFolder(userStory.id, value || null)}
                              options={[
                                { value: '', label: 'No folder' },
                                ...folders.map(f => ({ value: f.id, label: f.name }))
                              ]}
                              className="max-w-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleStartQASession(userStory)}>
                      <FiZap className="mr-1" />
                      Start QA Session
                    </Button>
                    <QuickActions
                      actions={[
                        {
                          label: 'Copy User Story ID',
                          icon: <FiCopy className="h-4 w-4" />,
                          onClick: () => {
                            copyToClipboard(userStory.id, {
                              successMessage: 'User story ID copied to clipboard',
                            });
                          },
                        },
                        {
                          label: 'Edit',
                          icon: <FiEdit2 className="h-4 w-4" />,
                          onClick: () => openEditUserStoryModal(userStory),
                        },
                        {
                          label: 'Delete',
                          icon: <FiTrash2 className="h-4 w-4" />,
                          onClick: () => setDeleteConfirm({ isOpen: true, userStory }),
                          variant: 'danger',
                        },
                      ]}
                      position="bottom-right"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* QA Scan Sessions (non-suite sessions for quick reference) */}
      {qaLoopSessions.length > 0 && testSuiteHierarchy.length === 0 && (
        <div className="page-section">
          <h2 className="section-title mb-4">
            <FiZap className="inline h-5 w-5 mr-2 text-primary-400" />
            QA Scan Sessions ({qaLoopSessions.length})
          </h2>
          <div className="space-y-3">
            {qaLoopSessions.map((session) => {
              const date = session.created_at ? new Date(session.created_at).toLocaleDateString() : '';
              return (
                <Card key={session.id} hoverable clickable onClick={() => navigate('/qa-loop')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FiZap className={`h-5 w-5 ${
                        session.status === 'running' ? 'text-sky-400' :
                        session.status === 'completed' ? 'text-emerald-400' :
                        session.status === 'paused' ? 'text-amber-400' :
                        'text-slate-400'
                      }`} />
                      <div>
                        <div className="font-medium text-slate-200 truncate max-w-md">
                          QA Scan — {date} — {session.target_url}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                          <span>{session.pages_explored} pages explored</span>
                          <span className="text-emerald-400">{session.tests_generated} tests</span>
                          <span className={session.bugs_found > 0 ? 'text-red-400' : 'text-slate-400'}>{session.bugs_found} bugs</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {session.quality_score > 0 && (
                        <span className={`text-sm font-semibold ${
                          session.quality_score >= 80 ? 'text-emerald-400' :
                          session.quality_score >= 50 ? 'text-amber-400' :
                          'text-red-400'
                        }`}>{session.quality_score}%</span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        session.status === 'running' ? 'bg-sky-500/10 text-sky-400' :
                        session.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        session.status === 'paused' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-slate-9000/10 text-slate-500'
                      }`}>{session.status}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* User Story Modal */}
      <Modal
        isOpen={isUserStoryModalOpen}
        onClose={closeUserStoryModal}
        title={editingUserStory ? 'Edit User Story' : 'Add User Story'}
        size="lg"
      >
        <div className="space-y-4">
          <Textarea
            label="User Story"
            placeholder="As a user, I want to..."
            value={userStoryFormData.story}
            onChange={(e) =>
              setUserStoryFormData({ ...userStoryFormData, story: e.target.value })
            }
            error={userStoryFormErrors.story}
            rows={4}
            required
          />
          <Input
            label="Website URL"
            type="url"
            placeholder={project?.website_url || 'https://example.com'}
            value={userStoryFormData.website_url}
            onChange={(e) =>
              setUserStoryFormData({ ...userStoryFormData, website_url: e.target.value })
            }
            error={userStoryFormErrors.website_url}
          />
          <Textarea
            label="Additional Context"
            placeholder="Any additional context or requirements (optional)"
            value={userStoryFormData.additional_context}
            onChange={(e) =>
              setUserStoryFormData({
                ...userStoryFormData,
                additional_context: e.target.value,
              })
            }
            rows={2}
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={closeUserStoryModal} disabled={submittingUserStory}>
            Cancel
          </Button>
          <Button onClick={handleSubmitUserStory} isLoading={submittingUserStory}>
            {editingUserStory ? 'Save Changes' : 'Add User Story'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete User Story"
        message="Are you sure you want to delete this user story? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeleteUserStory}
        onCancel={() => setDeleteConfirm({ isOpen: false, userStory: null })}
      />
    </div>
  );
};
