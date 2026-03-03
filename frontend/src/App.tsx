import React from 'react';
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

/** Wraps all authenticated routes inside the app shell (sidebar + header). */
const LayoutWrapper: React.FC = () => (
  <Layout>
    <Outlet />
  </Layout>
);

function App() {
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
                  </Route>
                </Route>
              </Route>
            </Routes>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;





