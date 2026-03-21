import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { OnboardingFlow } from '../components/Onboarding/OnboardingFlow';
import { useOnboarding } from '../hooks/useOnboarding';
import { StatsCard } from '../components/common/StatsCard';
import { Card } from '../components/common/Card';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { getDashboardStats, type DashboardStats } from '../services/api';
import { formatRelativeTime } from '../utils/dateFormat';
import {
  FiCheckCircle,
  FiTrendingUp,
  FiZap,
  FiGlobe,
  FiFileText,
  FiAlertTriangle,
  FiActivity,
  FiRefreshCw,
} from 'react-icons/fi';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isCompleted, isLoading: onboardingLoading } = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(false);

  const fetchStats = async () => {
    setLoadingStats(true);
    setStatsError(false);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch {
      setStatsError(true);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (!onboardingLoading && !isCompleted) {
      setShowOnboarding(true);
    }
  }, [onboardingLoading, isCompleted]);

  const sessionStatusMap: Record<string, 'success' | 'error' | 'running' | 'pending'> = {
    completed: 'success',
    failed: 'error',
    running: 'running',
    cancelled: 'pending',
    paused: 'pending',
    pending: 'pending',
  };

  return (
    <div className="space-y-8">
      {/* Onboarding Flow */}
      {showOnboarding && (
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      )}

      {/* Statistics Dashboard */}
      {!showOnboarding && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Overview</h2>
            {statsError && (
              <Button variant="secondary" onClick={fetchStats} className="text-sm">
                <FiRefreshCw className="mr-1 h-3 w-3" /> Retry
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Test Cases"
              value={loadingStats ? '...' : stats?.totalTestCases ?? 0}
              icon={<FiCheckCircle className="h-6 w-6" />}
              onClick={() => navigate('/test-cases')}
            />
            <StatsCard
              title="QA Sessions"
              value={loadingStats ? '...' : stats?.totalQASessions ?? 0}
              icon={<FiActivity className="h-6 w-6" />}
              onClick={() => navigate('/qa-loop')}
            />
            <StatsCard
              title="Bugs Found"
              value={loadingStats ? '...' : stats?.totalBugsFound ?? 0}
              icon={<FiAlertTriangle className="h-6 w-6" />}
            />
            <StatsCard
              title="Success Rate"
              value={loadingStats ? '...' : `${stats?.successRate ?? 0}%`}
              icon={<FiTrendingUp className="h-6 w-6" />}
              trend={(stats?.successRate ?? 0) >= 80 ? 'up' : (stats?.successRate ?? 0) >= 50 ? 'neutral' : 'down'}
              onClick={() => navigate('/test-runs')}
            />
          </div>
        </div>
      )}

      {/* Recent QA Sessions */}
      {!showOnboarding && stats?.recentSessions && stats.recentSessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent QA Sessions</h2>
            <Link to="/qa-loop" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {stats.recentSessions.map(session => (
              <Card key={session.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/qa-loop')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      status={sessionStatusMap[session.status] || 'pending'}
                      pulse={session.status === 'running'}
                      size="sm"
                    />
                    <div>
                      <div className="font-medium text-white truncate max-w-md">
                        {(() => {
                          try { return new URL(session.target_url).hostname; } catch { return session.target_url; }
                        })()}
                      </div>
                      <div className="text-xs text-slate-400">
                        {formatRelativeTime(session.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    {session.quality_score > 0 && (
                      <span className="font-medium">{session.quality_score}% quality</span>
                    )}
                    <span>{session.tests_generated} tests</span>
                    <span>{session.bugs_found} bugs</span>
                    <span>{session.pages_explored} pages</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* QA Loop Hero CTA */}
      {!showOnboarding && (
        <div className="rounded-2xl border border-primary-700 bg-gradient-to-br from-slate-800 to-slate-800/80 p-10 text-center">
          <div className="flex justify-center mb-5">
            <div className="h-16 w-16 rounded-2xl bg-primary-600 flex items-center justify-center shadow-lg">
              <FiZap className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Autonomous QA Loop</h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto text-base leading-relaxed">
            Point the AI at any URL and let it autonomously explore your app, generate test cases,
            and find bugs — while you focus on building.
          </p>

          <div className="flex justify-center gap-6 text-sm text-slate-400 mb-8">
            <div className="flex items-center gap-2">
              <FiGlobe className="text-blue-500 h-4 w-4" />
              <span>Explores all pages</span>
            </div>
            <div className="flex items-center gap-2">
              <FiFileText className="text-green-500 h-4 w-4" />
              <span>Generates test cases</span>
            </div>
            <div className="flex items-center gap-2">
              <FiAlertTriangle className="text-red-500 h-4 w-4" />
              <span>Finds bugs</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/qa-loop')}
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors text-base shadow-md hover:shadow-lg"
          >
            <FiZap className="h-5 w-5" />
            Launch QA Loop
          </button>
        </div>
      )}
    </div>
  );
};
