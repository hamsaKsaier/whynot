import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Layout } from './components/Layout';
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

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <Layout>
            <Routes>
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
            </Routes>
          </Layout>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;





