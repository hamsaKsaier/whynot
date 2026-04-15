import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiEdit2,
  FiGlobe,
  FiFolder,
  FiPlay,
  FiZap,
  FiChevronDown,
  FiChevronRight,
  FiCopy,
  FiCheck,
  FiX,
  FiAlertTriangle,
  FiClock,
  FiSkipForward,
  FiShield,
  FiFileText,
  FiAlertCircle,
} from 'react-icons/fi';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Alert } from '../components/common/Alert';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import {
  getProject,
  updateProject,
  getProjectContext,
  updateProjectPrd,
  resetProjectContext,
  getProjectTestCasesByCategory,
  ProjectWithStats,
  CategoryGroup,
} from '../services/api';

// Status helpers
function statusIcon(status: string) {
  switch (status) {
    case 'completed':
    case 'pass':
    case 'passed':
    case 'confirmed':
      return <FiCheck className="h-4 w-4 text-emerald-400" />;
    case 'failed':
    case 'fail':
    case 'error':
      return <FiX className="h-4 w-4 text-red-400" />;
    case 'mismatch':
      return <FiAlertTriangle className="h-4 w-4 text-amber-400" />;
    case 'skipped':
      return <FiSkipForward className="h-4 w-4 text-muted-foreground rtl:scale-x-[-1]" />;
    default:
      return <FiAlertTriangle className="h-4 w-4 text-amber-400" />;
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-500/10 text-emerald-400',
    pass: 'bg-emerald-500/10 text-emerald-400',
    passed: 'bg-emerald-500/10 text-emerald-400',
    confirmed: 'bg-emerald-500/10 text-emerald-400',
    failed: 'bg-red-500/10 text-red-400',
    fail: 'bg-red-500/10 text-red-400',
    error: 'bg-red-500/10 text-red-400',
    mismatch: 'bg-amber-500/10 text-amber-400',
    skipped: 'bg-muted text-muted-foreground',
  };
  return map[status] || 'bg-amber-500/10 text-amber-400';
}

function statusLabel(status: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    completed: t('dashboard.projectDetail.status.passed'),
    pass: t('dashboard.projectDetail.status.passed'),
    passed: t('dashboard.projectDetail.status.passed'),
    confirmed: t('dashboard.projectDetail.status.passed'),
    failed: t('dashboard.projectDetail.status.failed'),
    fail: t('dashboard.projectDetail.status.failed'),
    error: t('dashboard.projectDetail.status.failed'),
    mismatch: t('dashboard.projectDetail.status.needsReview'),
    skipped: t('dashboard.projectDetail.status.skipped'),
  };
  return map[status] || t('dashboard.projectDetail.status.needsReview');
}

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('auth')) return <FiShield className="h-4 w-4" />;
  if (n.includes('nav')) return <FiGlobe className="h-4 w-4" />;
  if (n.includes('setting')) return <FiEdit2 className="h-4 w-4" />;
  if (n.includes('search')) return <FiFileText className="h-4 w-4" />;
  return <FiFolder className="h-4 w-4" />;
}

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');

  const [project, setProject] = useState<ProjectWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Category data
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [bugs, setBugs] = useState<any[]>([]);
  const [scanHistory, setScanHistory] = useState<any[]>([]);

  // Expanded categories
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  // Expanded test case detail rows
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  // Project Context state
  const [projectContext, setProjectContext] = useState<any>({});
  const [userPrd, setUserPrd] = useState('');
  const [prdDraft, setPrdDraft] = useState('');
  const [savingPrd, setSavingPrd] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showScanHistory, setShowScanHistory] = useState(false);
  const [showBugs, setShowBugs] = useState(false);
  const [expandedBugs, setExpandedBugs] = useState<Set<string>>(new Set());
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Project edit state
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectWebsiteUrl, setProjectWebsiteUrl] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  // Clipboard
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyCode = useCallback((code: string, testId: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(testId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const fetchProjectData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [projectResponse, categoryResponse] = await Promise.all([
        getProject(id),
        getProjectTestCasesByCategory(id).catch(() => ({ categories: [], bugs: [], scanHistory: [] })),
      ]);
      setProject(projectResponse.project);
      setCategories(categoryResponse.categories || []);
      setBugs(categoryResponse.bugs || []);
      setScanHistory(categoryResponse.scanHistory || []);

      // Auto-expand categories with failures
      const failed = new Set<string>();
      for (const cat of (categoryResponse.categories || [])) {
        if (cat.stats.failed > 0 || cat.stats.review > 0) failed.add(cat.name);
      }
      setExpandedCategories(failed);

      // Load project context
      try {
        const ctxResponse = await getProjectContext(id);
        setProjectContext(ctxResponse.context || {});
        setUserPrd(ctxResponse.user_prd || '');
        setPrdDraft(ctxResponse.user_prd || '');
      } catch { /* context column may not exist yet */ }

      setProjectName(projectResponse.project.name);
      setProjectDescription(projectResponse.project.description || '');
      setProjectWebsiteUrl(projectResponse.project.website_url || '');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || t('dashboard.projectDetail.fetchError'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

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
      setError(err.response?.data?.error || err.message || t('dashboard.projectDetail.updateError'));
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

  const handleSavePrd = async () => {
    if (!id) return;
    setSavingPrd(true);
    try {
      await updateProjectPrd(id, prdDraft);
      setUserPrd(prdDraft);
    } catch (err: any) {
      setError(err.message || t('dashboard.projectDetail.prdSaveError'));
    } finally {
      setSavingPrd(false);
    }
  };

  const handleResetContext = async () => {
    if (!id) return;
    try {
      await resetProjectContext(id);
      setProjectContext({});
      setShowResetConfirm(false);
    } catch (err: any) {
      setError(err.message || t('dashboard.projectDetail.resetError'));
    }
  };

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleTestExpand = (testId: string) => {
    setExpandedTests(prev => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId); else next.add(testId);
      return next;
    });
  };

  const toggleBugExpand = (bugId: string) => {
    setExpandedBugs(prev => {
      const next = new Set(prev);
      if (next.has(bugId)) next.delete(bugId); else next.add(bugId);
      return next;
    });
  };

  // Totals
  const totalTests = categories.reduce((sum, c) => sum + c.testCases.length, 0);
  const totalPassed = categories.reduce((sum, c) => sum + c.stats.passed, 0);
  const totalFailed = categories.reduce((sum, c) => sum + c.stats.failed, 0);

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
        <div className="space-y-3">
          <SkeletonLoader width="w-full" height="h-20" />
          <SkeletonLoader width="w-full" height="h-20" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-foreground">{t('dashboard.projectDetail.notFound')}</h2>
        <Button className="mt-4" onClick={() => navigate('/projects')}>
          {t('dashboard.projectDetail.backToProjects')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumbs
        items={[
          { label: t('dashboard.projects.title'), path: '/projects', icon: <FiFolder className="h-4 w-4" /> },
          { label: project.name },
        ]}
      />

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* ===== SECTION 1: Header ===== */}
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
                  placeholder={t('dashboard.projects.form.namePlaceholder')}
                  className="max-w-md"
                />
                <Textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder={t('dashboard.projects.form.descriptionPlaceholder')}
                  rows={2}
                  className="max-w-md"
                />
                <Input
                  value={projectWebsiteUrl}
                  onChange={(e) => setProjectWebsiteUrl(e.target.value)}
                  placeholder={t('dashboard.projects.form.urlPlaceholder')}
                  type="url"
                  className="max-w-md"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveProject} isLoading={savingProject}>{t('dashboard.projectDetail.save')}</Button>
                  <Button size="sm" variant="secondary" onClick={cancelEditProject}>{t('dashboard.projects.cancel')}</Button>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
                {project.description && <p className="mt-1 text-muted-foreground">{project.description}</p>}
                {project.website_url && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                    <FiGlobe className="h-4 w-4" />
                    <a href={project.website_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary-600">
                      {project.website_url}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span>{t('dashboard.projectDetail.testsCount', { count: totalTests })}</span>
                  <span className="text-emerald-400">{t('dashboard.projectDetail.passedCount', { count: totalPassed })}</span>
                  {totalFailed > 0 && <span className="text-red-400">{t('dashboard.projectDetail.failedCount', { count: totalFailed })}</span>}
                  <span>{t('dashboard.projectDetail.bugsCount', { count: bugs.length })}</span>
                  {scanHistory.length > 0 && (
                    <span>{t('dashboard.projectDetail.lastScan', { date: new Date(scanHistory[0].created_at).toLocaleDateString() })}</span>
                  )}
                </div>
              </div>
            )}
          </div>
          {!isEditingProject && (
            <div className="flex gap-2">
              <Button onClick={() => navigate('/qa-loop', { state: { projectId: id, websiteUrl: project.website_url } })}>
                <FiZap className="me-1" /> {t('dashboard.projectDetail.newScan')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsEditingProject(true)}>
                <FiEdit2 className="me-1" /> {t('dashboard.projects.edit')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* ===== SECTION 2: Test Results by Category ===== */}
      <div className="page-section">
        <h2 className="section-title mb-4">{t('dashboard.projectDetail.testResults', { count: totalTests })}</h2>

        {categories.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <FiZap className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">{t('dashboard.projectDetail.noTests')}</p>
              <Button size="sm" className="mt-4" onClick={() => navigate('/qa-loop', { state: { projectId: id, websiteUrl: project.website_url } })}>
                <FiZap className="me-1" /> {t('dashboard.projectDetail.startScan')}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {categories.map(cat => {
              const isExpanded = expandedCategories.has(cat.name);
              const total = cat.testCases.length;
              return (
                <div key={cat.name} className="bg-navy-800 rounded-lg border border-navy-700 overflow-hidden">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat.name)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-navy-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <FiChevronDown className="h-4 w-4 text-muted-foreground" /> : <FiChevronRight className="h-4 w-4 text-muted-foreground rtl:scale-x-[-1]" />}
                      {categoryIcon(cat.name)}
                      <span className="font-medium text-foreground">{cat.name}</span>
                      <span className="text-xs text-muted-foreground">({total})</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {cat.stats.passed > 0 && <span className="text-emerald-400">{t('dashboard.projectDetail.passedCount', { count: cat.stats.passed })}</span>}
                      {cat.stats.failed > 0 && <span className="text-red-400">{t('dashboard.projectDetail.failedCount', { count: cat.stats.failed })}</span>}
                      {cat.stats.review > 0 && <span className="text-amber-400">{t('dashboard.projectDetail.reviewCount', { count: cat.stats.review })}</span>}
                      {cat.stats.skipped > 0 && <span className="text-muted-foreground">{t('dashboard.projectDetail.skippedCount', { count: cat.stats.skipped })}</span>}
                    </div>
                  </button>

                  {/* Category test cases */}
                  {isExpanded && (
                    <div className="border-t border-navy-700">
                      {cat.testCases.map((tc: any) => {
                        const testStatus = tc.last_run_status || tc.observed_result || 'review';
                        const isTestExpanded = expandedTests.has(tc.id);
                        const steps = tc.steps || [];
                        const duration = tc.last_run_duration;
                        return (
                          <div key={tc.id} className="border-b border-navy-700/50 last:border-b-0">
                            <button
                              onClick={() => toggleTestExpand(tc.id)}
                              className="w-full flex items-center justify-between px-6 py-2.5 hover:bg-navy-700/30 transition-colors text-start"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {statusIcon(testStatus)}
                                <span className="text-sm text-foreground truncate">{tc.name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${statusBadge(testStatus)}`}>
                                  {statusLabel(testStatus, t)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 ms-3 flex-shrink-0">
                                {duration && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <FiClock className="h-3 w-3" />
                                    {(duration / 1000).toFixed(1)}s
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* Expanded test details */}
                            {isTestExpanded && (
                              <div className="px-6 pb-4 pt-1 bg-navy-900/50 space-y-3">
                                {tc.description && (
                                  <p className="text-sm text-muted-foreground">{tc.description}</p>
                                )}

                                {/* Steps */}
                                {steps.length > 0 && (
                                  <div>
                                    <h4 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t('dashboard.projectDetail.steps', { count: steps.length })}</h4>
                                    <div className="space-y-1">
                                      {steps.map((step: any, i: number) => (
                                        <div key={i} className="text-xs text-muted-foreground flex gap-2">
                                          <span className="text-muted-foreground/60 w-5 flex-shrink-0">{i + 1}.</span>
                                          <span><span className="text-sky-400">{step.action}</span> {step.description}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Error */}
                                {tc.last_run_error && (
                                  <div className="bg-red-950/30 border border-red-800/30 rounded p-2">
                                    <span className="text-xs text-red-400">{tc.last_run_error}</span>
                                  </div>
                                )}

                                {/* Playwright code */}
                                {tc.playwright_code && (
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <h4 className="text-xs text-muted-foreground uppercase tracking-wide">{t('dashboard.projectDetail.playwrightCode')}</h4>
                                      <button
                                        onClick={() => copyCode(tc.playwright_code, tc.id)}
                                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                      >
                                        {copiedId === tc.id ? <FiCheck className="h-3 w-3 text-emerald-400" /> : <FiCopy className="h-3 w-3" />}
                                        {copiedId === tc.id ? t('dashboard.projectDetail.copied') : t('dashboard.projectDetail.copy')}
                                      </button>
                                    </div>
                                    <pre className="text-xs text-foreground bg-navy-950 rounded p-3 overflow-x-auto max-h-48">
                                      {tc.playwright_code}
                                    </pre>
                                  </div>
                                )}

                                {/* Last run date */}
                                {tc.last_run_at && (
                                  <div className="text-xs text-muted-foreground">
                                    {t('dashboard.projectDetail.lastRun', { date: new Date(tc.last_run_at).toLocaleString() })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== SECTION 3: Bugs ===== */}
      {bugs.length > 0 && (
        <div className="page-section">
          <button
            onClick={() => setShowBugs(!showBugs)}
            className="flex items-center gap-2 w-full text-start mb-4"
          >
            <h2 className="section-title flex items-center gap-2">
              <FiAlertCircle className="inline h-5 w-5 text-red-400" />
              {t('dashboard.projectDetail.bugsSection', { count: bugs.length })}
            </h2>
            <span className="text-muted-foreground text-sm ms-auto">
              {showBugs ? t('dashboard.projectDetail.collapse') : t('dashboard.projectDetail.expand')}
            </span>
          </button>

          {showBugs && (
            <div className="space-y-2">
              {bugs.map((bug: any) => {
                const isBugExpanded = expandedBugs.has(bug.id);
                return (
                  <Card key={bug.id}>
                    <button
                      onClick={() => toggleBugExpand(bug.id)}
                      className="w-full text-start"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FiAlertCircle className={`h-4 w-4 ${bug.severity === 'critical' ? 'text-red-400' : bug.severity === 'high' ? 'text-orange-400' : 'text-amber-400'}`} />
                          <span className="text-sm text-foreground">{bug.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            bug.verification_status === 'verified' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {bug.verification_status === 'verified' ? t('dashboard.projectDetail.verified') : t('dashboard.projectDetail.aiObserved')}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            bug.severity === 'critical' ? 'bg-red-500/10 text-red-400' :
                            bug.severity === 'high' ? 'bg-orange-500/10 text-orange-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>{bug.severity}</span>
                          <span className="text-xs text-muted-foreground">{new Date(bug.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </button>
                    {isBugExpanded && (
                      <div className="mt-3 pt-3 border-t border-navy-700 space-y-2">
                        {bug.description && <p className="text-sm text-muted-foreground">{bug.description}</p>}
                        {bug.page_url && <p className="text-xs text-muted-foreground">{t('dashboard.projectDetail.page')}: {bug.page_url}</p>}
                        {bug.screenshot_url && (
                          <img src={bug.screenshot_url} alt={t('dashboard.projectDetail.bugScreenshot')} className="rounded max-h-48 mt-2" />
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== SECTION 4: Scan History (collapsed) ===== */}
      {scanHistory.length > 0 && (
        <div className="page-section">
          <button
            onClick={() => setShowScanHistory(!showScanHistory)}
            className="flex items-center gap-2 w-full text-start mb-4"
          >
            <h2 className="section-title flex items-center gap-2">
              <FiPlay className="inline h-5 w-5 text-sky-400" />
              {t('dashboard.projectDetail.scanHistory', { count: scanHistory.length })}
            </h2>
            <span className="text-muted-foreground text-sm ms-auto">
              {showScanHistory ? t('dashboard.projectDetail.collapse') : t('dashboard.projectDetail.expand')}
            </span>
          </button>

          {showScanHistory && (
            <div className="space-y-2">
              {scanHistory.map((scan: any) => (
                <Card key={scan.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`w-2 h-2 rounded-full ${
                        scan.status === 'completed' ? 'bg-emerald-400' :
                        scan.status === 'running' ? 'bg-sky-400' :
                        'bg-muted-foreground'
                      }`} />
                      <span className="text-foreground">{new Date(scan.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{t('dashboard.projectDetail.pagesCount', { count: scan.pages_explored })}</span>
                      <span className="text-emerald-400">{t('dashboard.projectDetail.testsCount', { count: scan.tests_generated })}</span>
                      <span className={scan.bugs_found > 0 ? 'text-red-400' : ''}>{t('dashboard.projectDetail.bugsCount', { count: scan.bugs_found })}</span>
                      {scan.quality_score > 0 && (
                        <span className={scan.quality_score >= 80 ? 'text-emerald-400' : scan.quality_score >= 50 ? 'text-amber-400' : 'text-red-400'}>
                          {scan.quality_score}%
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== SECTION 5: Project Notes (collapsed) ===== */}
      <div className="page-section">
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="flex items-center gap-2 w-full text-start mb-4"
        >
          <h2 className="section-title flex items-center gap-2">
            <FiFileText className="inline h-5 w-5 text-sky-400" />
            {t('dashboard.projectDetail.projectNotes')}
          </h2>
          <span className="text-muted-foreground text-sm ms-auto">
            {showNotes ? t('dashboard.projectDetail.collapse') : t('dashboard.projectDetail.expand')}
          </span>
        </button>

        {showNotes && (
          <div className="space-y-4">
            <Card>
              <p className="text-xs text-muted-foreground mb-2">
                {t('dashboard.projectDetail.notesDescription')}
              </p>
              <Textarea
                value={prdDraft}
                onChange={e => setPrdDraft(e.target.value)}
                placeholder={t('dashboard.projectDetail.notesPlaceholder')}
                rows={6}
              />
              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" onClick={handleSavePrd} isLoading={savingPrd} disabled={prdDraft === userPrd}>
                  {t('dashboard.projectDetail.saveNotes')}
                </Button>
                {prdDraft !== userPrd && (
                  <span className="text-xs text-amber-400">{t('dashboard.projectDetail.unsavedChanges')}</span>
                )}
              </div>
            </Card>

            {/* Context info */}
            {projectContext.known_pages && projectContext.known_pages.length > 0 && (
              <Card>
                <h3 className="text-sm font-semibold text-foreground mb-3">{t('dashboard.projectDetail.knowledgeTitle')}</h3>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {t('dashboard.projectDetail.pagesKnown', { count: projectContext.known_pages.length })} |
                    {t('dashboard.projectDetail.bugsTracked', { count: projectContext.known_bugs?.length || 0 })} |
                    {t('dashboard.projectDetail.totalScans', { count: projectContext.total_scans || 0 })}
                  </div>
                </div>
              </Card>
            )}

            {/* Reset Context */}
            <div className="flex items-center gap-3">
              {showResetConfirm ? (
                <div className="flex items-center gap-2 bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
                  <span className="text-xs text-red-400">{t('dashboard.projectDetail.resetConfirm')}</span>
                  <Button size="sm" variant="danger" onClick={handleResetContext}>{t('dashboard.projectDetail.resetYes')}</Button>
                  <Button size="sm" variant="secondary" onClick={() => setShowResetConfirm(false)}>{t('dashboard.projects.cancel')}</Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setShowResetConfirm(true)}>
                  {t('dashboard.projectDetail.resetContext')}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
