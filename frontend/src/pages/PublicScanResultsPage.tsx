import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiZap, FiCheck, FiAlertTriangle, FiLoader, FiExternalLink,
  FiChevronDown, FiChevronUp, FiMonitor, FiSearch, FiCpu,
  FiFileText, FiGlobe, FiX
} from 'react-icons/fi';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ScanSession {
  id: string;
  target_url: string;
  status: string;
  quality_score: number;
  bugs_found: number;
  tests_generated: number;
  pages_explored: number;
  created_at: string;
  completed_at: string | null;
}

interface ScanBug {
  id: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string | null;
  page_url: string | null;
  reproduction_steps: any[];
}

interface ScanTestCase {
  id: string;
  name: string;
  category: string;
  last_run_status: string | null;
  source_page_url: string | null;
}

const severityColor: Record<string, string> = {
  critical: 'bg-red-900/30 text-red-400',
  high: 'bg-orange-900/30 text-orange-400',
  medium: 'bg-yellow-900/30 text-yellow-400',
  low: 'bg-blue-900/30 text-blue-400',
};

// Animated activity messages while scanning
const SCAN_ACTIVITIES = [
  { icon: FiGlobe, text: 'Crawling pages and discovering routes...' },
  { icon: FiSearch, text: 'Analyzing UI elements and interactions...' },
  { icon: FiCpu, text: 'AI is generating test scenarios...' },
  { icon: FiFileText, text: 'Running automated tests...' },
  { icon: FiSearch, text: 'Checking for accessibility issues...' },
  { icon: FiCpu, text: 'Validating form submissions...' },
  { icon: FiGlobe, text: 'Testing navigation flows...' },
  { icon: FiFileText, text: 'Analyzing error handling...' },
];

export const PublicScanResultsPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<ScanSession | null>(null);
  const [bugs, setBugs] = useState<ScanBug[]>([]);
  const [testCases, setTestCases] = useState<ScanTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedBug, setExpandedBug] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [activityIndex, setActivityIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'bugs' | 'tests'>('tests');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activityRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/public/scan/${sessionId}`);
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'Scan not found' : 'Failed to load scan results');
      }
      const data = await res.json();
      setSession(data.session);
      setBugs(data.bugs || []);
      setTestCases(data.testCases || []);

      // Stop polling if completed
      if (['completed', 'stopped', 'failed'].includes(data.session?.status)) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        if (activityRef.current) {
          clearInterval(activityRef.current);
          activityRef.current = null;
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    fetchData();
    pollRef.current = setInterval(fetchData, 5000);
    // Rotate activity messages
    activityRef.current = setInterval(() => {
      setActivityIndex(i => (i + 1) % SCAN_ACTIVITIES.length);
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (activityRef.current) clearInterval(activityRef.current);
    };
  }, [sessionId]);

  const isRunning = session && ['running', 'pending', 'paused'].includes(session.status);
  const isComplete = session && ['completed', 'stopped', 'failed'].includes(session.status);
  const qualityColor = !session ? 'text-slate-500' :
    session.quality_score >= 80 ? 'text-green-600' :
    session.quality_score >= 50 ? 'text-yellow-600' : 'text-red-600';

  const elapsedTime = session ? Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000) : 0;
  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="h-8 w-8 animate-spin text-sky-600 mx-auto mb-3" />
          <p className="text-slate-400">Loading scan results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <FiAlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/landing')}
            className="text-sky-600 hover:text-sky-400 font-medium"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  const ActivityMessage = SCAN_ACTIVITIES[activityIndex];

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Nav */}
      <nav className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/landing')} className="flex items-center gap-2 hover:opacity-80">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-sky-600 rounded-lg flex items-center justify-center">
              <FiZap className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white">WhyNot</span>
          </button>
          <div className="flex items-center gap-3">
            {isRunning && (
              <span className="text-xs text-slate-500">{formatElapsed(elapsedTime)} elapsed</span>
            )}
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
            >
              Sign up for full access
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Two-column layout: Results + Preview */}
        <div className={`grid gap-6 ${showPreview && session?.target_url ? 'lg:grid-cols-2' : 'max-w-5xl mx-auto'}`}>
          {/* Left column: Results */}
          <div className="space-y-5">
            {/* Header + Stats */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-bold text-white mb-1">Scan Results</h1>
                  <a
                    href={session?.target_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sky-600 hover:text-sky-400 flex items-center gap-1 truncate"
                  >
                    {session?.target_url}
                    <FiExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!showPreview && session?.target_url && (
                    <button
                      onClick={() => setShowPreview(true)}
                      className="p-2 text-slate-500 hover:text-sky-600 hover:bg-sky-900/20 rounded-lg transition-colors"
                      title="Show site preview"
                    >
                      <FiMonitor className="h-4 w-4" />
                    </button>
                  )}
                  {isRunning && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-900/20 text-sky-400 rounded-full text-sm font-medium">
                      <FiLoader className="h-3.5 w-3.5 animate-spin" />
                      Scanning
                    </div>
                  )}
                  {isComplete && session?.status === 'completed' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/20 text-green-400 rounded-full text-sm font-medium">
                      <FiCheck className="h-3.5 w-3.5" />
                      Complete
                    </div>
                  )}
                  {isComplete && session?.status === 'failed' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 text-red-400 rounded-full text-sm font-medium">
                      <FiAlertTriangle className="h-3.5 w-3.5" />
                      Failed
                    </div>
                  )}
                </div>
              </div>

              {/* Live activity indicator */}
              {isRunning && (
                <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-sky-900/20 rounded-lg text-sm text-sky-400 transition-all">
                  <ActivityMessage.icon className="h-4 w-4 flex-shrink-0 animate-pulse" />
                  <span className="truncate">{ActivityMessage.text}</span>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-3 bg-slate-900 rounded-lg">
                  <div className={`text-2xl font-bold ${qualityColor}`}>
                    {session?.quality_score ?? '—'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Quality Score</div>
                </div>
                <div className="text-center p-3 bg-slate-900 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{session?.bugs_found ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Bugs Found</div>
                </div>
                <div className="text-center p-3 bg-slate-900 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{session?.tests_generated ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Tests Generated</div>
                </div>
                <div className="text-center p-3 bg-slate-900 rounded-lg">
                  <div className="text-2xl font-bold text-sky-600">{session?.pages_explored ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Pages Explored</div>
                </div>
              </div>
            </div>

            {/* Tabs: Tests / Bugs */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="flex border-b border-slate-700">
                <button
                  onClick={() => setActiveTab('tests')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'tests'
                      ? 'text-sky-400 border-b-2 border-sky-600 bg-sky-900/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tests ({testCases.length || session?.tests_generated || 0})
                </button>
                <button
                  onClick={() => setActiveTab('bugs')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'bugs'
                      ? 'text-sky-400 border-b-2 border-sky-600 bg-sky-900/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Bugs ({bugs.length})
                  {bugs.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-900/30 text-red-600 rounded-full">
                      {bugs.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="p-5">
                {activeTab === 'tests' && (
                  <>
                    {testCases.length === 0 && !session?.tests_generated ? (
                      <div className="text-center py-8 text-slate-500">
                        {isRunning ? (
                          <div className="flex flex-col items-center gap-2">
                            <FiLoader className="h-5 w-5 animate-spin" />
                            <span>Generating tests...</span>
                          </div>
                        ) : 'No tests generated'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {testCases.map((tc) => (
                          <div key={tc.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              tc.last_run_status === 'passed' ? 'bg-green-400' :
                              tc.last_run_status === 'failed' ? 'bg-red-400' :
                              'bg-slate-500'
                            }`} />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-slate-200 truncate">{tc.name}</div>
                              {tc.source_page_url && (
                                <div className="text-[11px] text-slate-500 truncate">{tc.source_page_url}</div>
                              )}
                            </div>
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                              tc.last_run_status === 'passed' ? 'bg-green-900/30 text-green-400' :
                              tc.last_run_status === 'failed' ? 'bg-red-900/30 text-red-400' :
                              'bg-slate-900 text-slate-400'
                            }`}>
                              {tc.last_run_status || 'pending'}
                            </span>
                          </div>
                        ))}
                        {testCases.length === 0 && (session?.tests_generated ?? 0) > 0 && (
                          <div className="text-center py-4 text-sm text-slate-500">
                            {session!.tests_generated} tests generated — details loading...
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'bugs' && (
                  <>
                    {bugs.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        {isRunning ? (
                          <div className="flex flex-col items-center gap-2">
                            <FiSearch className="h-5 w-5 animate-pulse" />
                            <span>Scanning for bugs...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <FiCheck className="h-6 w-6 text-green-400" />
                            <span className="text-green-600 font-medium">No bugs found — looking good!</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {bugs.map((bug) => (
                          <div key={bug.id} className="border border-slate-700 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setExpandedBug(expandedBug === bug.id ? null : bug.id)}
                              className="w-full p-3 flex items-center justify-between hover:bg-slate-900 transition-colors text-left"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${severityColor[bug.severity] || severityColor.low}`}>
                                  {bug.severity}
                                </span>
                                <span className="text-sm font-medium text-white truncate">{bug.title}</span>
                              </div>
                              {expandedBug === bug.id ? (
                                <FiChevronUp className="h-4 w-4 text-slate-500" />
                              ) : (
                                <FiChevronDown className="h-4 w-4 text-slate-500" />
                              )}
                            </button>
                            {expandedBug === bug.id && (
                              <div className="px-4 pb-4 border-t border-slate-700 pt-3">
                                {bug.description && (
                                  <p className="text-sm text-slate-400 mb-3">{bug.description}</p>
                                )}
                                {bug.page_url && (
                                  <div className="text-xs text-slate-500 mb-2">Page: {bug.page_url}</div>
                                )}
                                {bug.reproduction_steps && bug.reproduction_steps.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium text-slate-400 mb-1">Reproduction Steps:</div>
                                    <ol className="list-decimal list-inside space-y-1">
                                      {bug.reproduction_steps.map((step: any, i: number) => (
                                        <li key={i} className="text-xs text-slate-400">
                                          {typeof step === 'string' ? step : step.description || step.action || JSON.stringify(step)}
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-r from-sky-500 to-sky-600 rounded-xl p-6 text-center text-white">
              <h2 className="text-xl font-bold mb-2">Want the full experience?</h2>
              <p className="text-sky-100 mb-4 text-sm max-w-lg mx-auto">
                Sign up to get auto-fix PRs, scheduled monitoring, CI integration, and unlimited QA sessions.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2.5 bg-white text-sky-700 font-semibold rounded-lg hover:bg-gray-100 transition-colors text-sm"
              >
                Sign up free
              </button>
            </div>
          </div>

          {/* Right column: Live Preview */}
          {showPreview && session?.target_url && (
            <div className="hidden lg:block">
              <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden sticky top-6">
                {/* Preview header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-700">
                  <div className="flex items-center gap-2">
                    <FiMonitor className="h-4 w-4 text-slate-500" />
                    <span className="text-xs font-medium text-slate-400">Live Preview</span>
                    {isRunning && (
                      <span className="flex items-center gap-1 text-[10px] text-sky-600 bg-sky-900/20 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse" />
                        AI is testing this site
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={session.target_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-500 hover:text-slate-400 transition-colors"
                      title="Open in new tab"
                    >
                      <FiExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="p-1 text-slate-500 hover:text-slate-400 transition-colors"
                      title="Hide preview"
                    >
                      <FiX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {/* URL bar */}
                <div className="px-4 py-1.5 bg-slate-900 border-b border-slate-700">
                  <div className="flex items-center gap-2 bg-slate-800 rounded px-3 py-1 text-[11px] text-slate-400 border border-slate-700">
                    <FiGlobe className="h-3 w-3 text-slate-500" />
                    <span className="truncate">{session.target_url}</span>
                  </div>
                </div>
                {/* iframe */}
                <div className="relative" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
                  <iframe
                    src={session.target_url}
                    className="w-full h-full border-0"
                    title="Site preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    loading="lazy"
                  />
                  {/* Scanning overlay */}
                  {isRunning && (
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                        <FiCpu className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
                        <span>WhyNot AI is testing this page...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
