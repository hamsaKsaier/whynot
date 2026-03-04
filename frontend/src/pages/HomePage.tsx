import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingFlow } from '../components/Onboarding/OnboardingFlow';
import { useOnboarding } from '../hooks/useOnboarding';
import { StatsCard } from '../components/common/StatsCard';
import { getTestCases } from '../services/api';
import {
  FiCheckCircle,
  FiPlay,
  FiTrendingUp,
  FiActivity,
  FiZap,
  FiGlobe,
  FiFileText,
  FiAlertTriangle,
} from 'react-icons/fi';
import type { TestCase } from '../types';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isCompleted, isLoading: onboardingLoading } = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Statistics state
  const [stats, setStats] = useState({
    totalTestCases: 0,
    totalTestRuns: 0,
    successRate: 0,
    recentActivity: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    setLoadingStats(true);
    try {
      const testCasesResponse = await getTestCases();
      const totalTestCases = testCasesResponse.test_cases.length;
      const successfulTests = testCasesResponse.test_cases.filter(
        (tc) => (tc as TestCase & { validation_summary?: { overall_status?: string } }).validation_summary?.overall_status === 'passed'
      ).length;
      const successRate = totalTestCases > 0 ? (successfulTests / totalTestCases) * 100 : 0;
      setStats({
        totalTestCases,
        totalTestRuns: 0,
        successRate: Math.round(successRate),
        recentActivity: 0,
      });
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Show onboarding for first-time users
  useEffect(() => {
    if (!onboardingLoading && !isCompleted) {
      setShowOnboarding(true);
    }
  }, [onboardingLoading, isCompleted]);

  return (
    <div className="space-y-8">
      {/* Onboarding Flow */}
      {showOnboarding && (
        <OnboardingFlow onComplete={() => setShowOnboarding(false)} />
      )}

      {/* Statistics Dashboard */}
      {!showOnboarding && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Test Cases"
              value={loadingStats ? '...' : stats.totalTestCases}
              icon={<FiCheckCircle className="h-6 w-6" />}
              onClick={() => navigate('/test-cases')}
            />
            <StatsCard
              title="Test Runs"
              value={loadingStats ? '...' : stats.totalTestRuns}
              icon={<FiPlay className="h-6 w-6" />}
              onClick={() => navigate('/test-runs')}
            />
            <StatsCard
              title="Success Rate"
              value={loadingStats ? '...' : `${stats.successRate}%`}
              icon={<FiTrendingUp className="h-6 w-6" />}
              trend={stats.successRate >= 80 ? 'up' : stats.successRate >= 50 ? 'neutral' : 'down'}
            />
            <StatsCard
              title="Recent Activity"
              value={loadingStats ? '...' : stats.recentActivity}
              icon={<FiActivity className="h-6 w-6" />}
            />
          </div>
        </div>
      )}

      {/* QA Loop Hero CTA */}
      {!showOnboarding && (
        <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-purple-50 p-10 text-center">
          <div className="flex justify-center mb-5">
            <div className="h-16 w-16 rounded-2xl bg-primary-600 flex items-center justify-center shadow-lg">
              <FiZap className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Autonomous QA Loop</h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto text-base leading-relaxed">
            Point the AI at any URL and let it autonomously explore your app, generate test cases,
            and find bugs — while you focus on building.
          </p>

          <div className="flex justify-center gap-6 text-sm text-gray-500 mb-8">
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
