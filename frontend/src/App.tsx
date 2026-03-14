import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
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
import { TestCasesPage } from './pages/TestCasesPage';
import { TestRunsPage } from './pages/TestRunsPage';
import { TestRunDetailPage } from './pages/TestRunDetailPage';
import { EnvironmentsPage } from './pages/EnvironmentsPage';
import { ArchitectureFlowPage } from './pages/ArchitectureFlowPage';
import { QALoopPage } from './pages/QALoopPage';
import { WebhookManagementPage } from './pages/WebhookManagementPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { GitHubReposPage } from './pages/GitHubReposPage';
import { BillingPage } from './pages/BillingPage';
import { NotFoundPage } from './pages/NotFoundPage';
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
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* All other routes require auth + workspace */}
              <Route element={<ProtectedRoute />}>
                <Route element={<WorkspaceProvider><Outlet /></WorkspaceProvider>}>
                  <Route element={<LayoutWrapper />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/qa-loop" element={<QALoopPage />} />
                    <Route path="/webhooks" element={<WebhookManagementPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:id" element={<ProjectDetailPage />} />
                    <Route path="/test-cases" element={<TestCasesPage />} />
                    <Route path="/test-runs/:executionId" element={<TestRunDetailPage />} />
                    <Route path="/test-runs" element={<TestRunsPage />} />
                    <Route path="/environments" element={<EnvironmentsPage />} />
                    <Route path="/architecture-flow" element={<ArchitectureFlowPage />} />
                    <Route path="/integrations" element={<IntegrationsPage />} />
                    <Route path="/github-repos" element={<GitHubReposPage />} />
                    <Route path="/billing" element={<BillingPage />} />
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

