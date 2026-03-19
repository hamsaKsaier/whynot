import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiPlay, FiFileText } from 'react-icons/fi';
import { Tabs } from '../components/common/Tabs';
import { TestRunsContent } from './TestRunsPage';
import { TestCasesContent } from './TestCasesPage';

const TABS = [
  { id: 'runs', label: 'Test Runs', icon: <FiPlay className="h-4 w-4" /> },
  { id: 'cases', label: 'Test Cases', icon: <FiFileText className="h-4 w-4" /> },
];

export const TestResultsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'runs';

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Test Results</h1>
        <p className="text-slate-400 mt-1">View test runs and manage test cases</p>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="mt-6">
        {activeTab === 'runs' && <TestRunsContent />}
        {activeTab === 'cases' && <TestCasesContent />}
      </div>
    </div>
  );
};
