import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Play, FileText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { TestRunsContent } from './TestRunsPage';
import { TestCasesContent } from './TestCasesPage';

export const TestResultsPage: React.FC = () => {
  const { t } = useTranslation('results');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'runs';

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">{t('results.title')}</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">{t('results.subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="runs" className="gap-1.5 flex-1 sm:flex-initial text-xs sm:text-sm">
            <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {t('results.testRuns.tabLabel')}
          </TabsTrigger>
          <TabsTrigger value="cases" className="gap-1.5 flex-1 sm:flex-initial text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {t('results.testCases.tabLabel')}
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
