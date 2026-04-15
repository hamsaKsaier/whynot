import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Play, FileText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { TestRunsContent } from './TestRunsPage';
import { TestCasesContent } from './TestCasesPage';

export const TestResultsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'runs';

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Test Results</h1>
        <p className="text-muted-foreground mt-1">View test runs and manage test cases</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="runs" className="gap-1.5">
            <Play className="h-4 w-4" />
            Test Runs
          </TabsTrigger>
          <TabsTrigger value="cases" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Test Cases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <TestRunsContent />
        </TabsContent>
        <TabsContent value="cases">
          <TestCasesContent />
        </TabsContent>
      </Tabs>
    </div>
  );
};
