import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { TestCasesPage } from './pages/TestCasesPage';
import { TestRunsPage } from './pages/TestRunsPage';
import { EnvironmentsPage } from './pages/EnvironmentsPage';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/test-cases" element={<TestCasesPage />} />
          <Route path="/test-runs" element={<TestRunsPage />} />
          <Route path="/environments" element={<EnvironmentsPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;





