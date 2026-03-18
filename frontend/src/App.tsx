import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { HomePage } from './pages/HomePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { TestRunDetailPage } from './pages/TestRunDetailPage';
import { TestResultsPage } from './pages/TestResultsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ArchitectureFlowPage } from './pages/ArchitectureFlowPage';
import { QALoopPage } from './pages/QALoopPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LandingPage } from './pages/LandingPage';
import { PublicScanResultsPage } from './pages/PublicScanResultsPage';
import { MonitorsPage } from './pages/MonitorsPage';
import { UpgradePrompt } from './components/common/UpgradePrompt';

/** Wraps all authenticated routes inside the app shell (sidebar + header). */
const LayoutWrapper: React.FC = () => (
  <Layout>
    <Outlet />
  </Layout>
);

function App() {
  const [upgradePrompt, setUpgradePrompt] = useState<{
    isOpen: boolean;
    type: 'credits' | 'feature' | 'subscription';
    details?: any;
  }>({ isOpen: false, type: 'credits' });

  const handleUpgradeEvent = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    setUpgradePrompt({ isOpen: true, type: detail.type, details: detail.details });
  }, []);

  useEffect(() => {
    window.addEventListener('upgrade-prompt', handleUpgradeEvent);
    return () => window.removeEventListener('upgrade-prompt', handleUpgradeEvent);
  }, [handleUpgradeEvent]);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <Routes>
              {/* Public routes — rendered without the app shell */}
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/scan/:sessionId" element={<PublicScanResultsPage />} />

              {/* All other routes require auth + workspace */}
              <Route element={<ProtectedRoute />}>
                <Route element={<WorkspaceProvider><Outlet /></WorkspaceProvider>}>
                  <Route element={<LayoutWrapper />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/qa-loop" element={<QALoopPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:id" element={<ProjectDetailPage />} />
                    <Route path="/test-results" element={<TestResultsPage />} />
                    <Route path="/test-runs/:executionId" element={<TestRunDetailPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/architecture-flow" element={<ArchitectureFlowPage />} />

                    {/* Redirects from old routes */}
                    <Route path="/test-runs" element={<Navigate to="/test-results?tab=runs" replace />} />
                    <Route path="/test-cases" element={<Navigate to="/test-results?tab=cases" replace />} />
                    <Route path="/environments" element={<Navigate to="/settings?tab=environments" replace />} />
                    <Route path="/integrations" element={<Navigate to="/settings?tab=integrations" replace />} />
                    <Route path="/github-repos" element={<Navigate to="/settings?tab=github" replace />} />
                    <Route path="/webhooks" element={<Navigate to="/settings?tab=webhooks" replace />} />
                    <Route path="/notifications" element={<Navigate to="/settings?tab=webhooks" replace />} />
                    <Route path="/billing" element={<Navigate to="/settings?tab=billing" replace />} />

                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
            <UpgradePrompt
              isOpen={upgradePrompt.isOpen}
              onClose={() => setUpgradePrompt(prev => ({ ...prev, isOpen: false }))}
              type={upgradePrompt.type}
              details={upgradePrompt.details}
            />
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

