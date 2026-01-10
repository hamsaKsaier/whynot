import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { TestCasesPage } from './pages/TestCasesPage';
import { TestRunsPage } from './pages/TestRunsPage';
import { EnvironmentsPage } from './pages/EnvironmentsPage';
import { ArchitectureFlowPage } from './pages/ArchitectureFlowPage';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/test-cases" element={<TestCasesPage />} />
          <Route path="/test-runs" element={<TestRunsPage />} />
          <Route path="/environments" element={<EnvironmentsPage />} />
          <Route path="/architecture-flow" element={<ArchitectureFlowPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;





