import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('dashboard');
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
            <h2 className="text-lg font-semibold text-foreground">{t('dashboard.overview')}</h2>
            {statsError && (
              <Button variant="secondary" onClick={fetchStats} className="text-sm">
                <FiRefreshCw className="me-1 h-3 w-3" /> {t('dashboard.retry')}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title={t('dashboard.stats.testCases')}
              value={loadingStats ? '...' : stats?.totalTestCases ?? 0}
              icon={<FiCheckCircle className="h-6 w-6" />}
              onClick={() => navigate('/test-cases')}
            />
            <StatsCard
              title={t('dashboard.stats.qaSessions')}
              value={loadingStats ? '...' : stats?.totalQASessions ?? 0}
              icon={<FiActivity className="h-6 w-6" />}
              onClick={() => navigate('/qa-loop')}
            />
            <StatsCard
              title={t('dashboard.stats.bugsFound')}
              value={loadingStats ? '...' : stats?.totalBugsFound ?? 0}
              icon={<FiAlertTriangle className="h-6 w-6" />}
            />
            <StatsCard
              title={t('dashboard.stats.successRate')}
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
            <h2 className="text-lg font-semibold text-foreground">{t('dashboard.recentSessions.title')}</h2>
            <Link to="/qa-loop" className="text-sm text-primary hover:text-primary/80 font-medium">
              {t('dashboard.recentSessions.viewAll')}
            </Link>
          </div>
          <div className="space-y-3">
            {stats.recentSessions.map(session => (
              <Card key={session.id} className="p-4 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/qa-loop')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusBadge
                      status={sessionStatusMap[session.status] || 'pending'}
                      pulse={session.status === 'running'}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {(() => {
                          try { return new URL(session.target_url).hostname; } catch { return session.target_url; }
                        })()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelativeTime(session.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground ps-8 sm:ps-0">
                    {session.quality_score > 0 && (
                      <span className="font-medium">{t('dashboard.recentSessions.quality', { score: session.quality_score })}</span>
                    )}
                    <span>{t('dashboard.recentSessions.tests', { count: session.tests_generated })}</span>
                    <span>{t('dashboard.recentSessions.bugs', { count: session.bugs_found })}</span>
                    <span>{t('dashboard.recentSessions.pages', { count: session.pages_explored })}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* QA Loop Hero CTA */}
      {!showOnboarding && (
        <div className="rounded-lg border border-primary/50 bg-card p-6 sm:p-10 text-center">
          <div className="flex justify-center mb-5">
            <div className="h-16 w-16 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <FiZap className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">{t('dashboard.qaLoop.title')}</h2>
          <p className="text-muted-foreground mb-6 sm:mb-8 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            {t('dashboard.qaLoop.description')}
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-6 text-sm text-muted-foreground mb-6 sm:mb-8">
            <div className="flex items-center justify-center gap-2">
              <FiGlobe className="text-blue-500 h-4 w-4" />
              <span>{t('dashboard.qaLoop.exploresPages')}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <FiFileText className="text-green-500 h-4 w-4" />
              <span>{t('dashboard.qaLoop.generatesTests')}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <FiAlertTriangle className="text-red-500 h-4 w-4" />
              <span>{t('dashboard.qaLoop.findsBugs')}</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/qa-loop')}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors text-base"
          >
            <FiZap className="h-5 w-5" />
            {t('dashboard.qaLoop.launch')}
          </button>
        </div>
      )}
    </div>
  );
};
