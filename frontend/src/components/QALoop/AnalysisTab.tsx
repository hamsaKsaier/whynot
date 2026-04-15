import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import {
  Search,
  AlertCircle,
  Activity,
  HelpCircle,
  Link,
  RefreshCw,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface RootCauseAnalysis {
  id: string;
  failureId: string;
  testCaseId: string;
  testCaseName: string;
  category: 'bug' | 'flaky' | 'environment' | 'test_issue' | 'data_issue';
  subCategory?: string;
  confidence: number;
  rootCause: string;
  hypothesis?: string;
  minimalSteps: string[];
  environmentFactors: string[];
  fixSuggestion?: string;
  testImprovement?: string;
  verified?: boolean;
}

export interface FailureCorrelation {
  id: string;
  failureIds: string[];
  correlationType: 'same_root_cause' | 'same_component' | 'same_timing' | 'cascading';
  sharedRootCause?: string;
  sharedComponent?: string;
  patternDescription: string;
  confidence: number;
  failureCount: number;
}

interface AnalysisTabProps {
  analyses: RootCauseAnalysis[];
  correlations: FailureCorrelation[];
  flakyTests?: { testCaseId: string; testCaseName: string; passRate: number }[];
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
  analyses,
  correlations,
  flakyTests = []
}) => {
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'analyses' | 'correlations' | 'flaky'>('analyses');

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'bug': return <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />;
      case 'flaky': return <RefreshCw className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />;
      case 'environment': return <Activity className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
      case 'test_issue': return <HelpCircle className="h-4 w-4 text-orange-500 dark:text-orange-400" />;
      case 'data_issue': return <HelpCircle className="h-4 w-4 text-sky-500 dark:text-sky-400" />;
      default: return <Search className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'bug': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'flaky': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      case 'environment': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'test_issue': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
      case 'data_issue': return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCorrelationTypeLabel = (type: string) => {
    switch (type) {
      case 'same_root_cause': return 'Same Root Cause';
      case 'same_component': return 'Same Component';
      case 'same_timing': return 'Timing Related';
      case 'cascading': return 'Cascading Failures';
      default: return type;
    }
  };

  // Summary stats
  const byCategory = analyses.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-red-600 dark:text-red-400">{byCategory.bug || 0}</div>
          <div className="text-xs text-red-500 dark:text-red-400">Bugs</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{byCategory.flaky || 0}</div>
          <div className="text-xs text-yellow-500 dark:text-yellow-400">Flaky</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{byCategory.environment || 0}</div>
          <div className="text-xs text-blue-500 dark:text-blue-400">Environment</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{byCategory.test_issue || 0}</div>
          <div className="text-xs text-orange-500 dark:text-orange-400">Test Issues</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-sky-600 dark:text-sky-400">{correlations.length}</div>
          <div className="text-xs text-sky-500 dark:text-sky-400">Correlations</div>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={v => setActiveView(v as typeof activeView)}>
        <TabsList>
          <TabsTrigger value="analyses" className="gap-1">
            <Search className="h-3.5 w-3.5" />
            Root Causes ({analyses.length})
          </TabsTrigger>
          <TabsTrigger value="correlations" className="gap-1">
            <Link className="h-3.5 w-3.5" />
            Correlations ({correlations.length})
          </TabsTrigger>
          <TabsTrigger value="flaky" className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
            Flaky Tests ({flakyTests.length})
          </TabsTrigger>
        </TabsList>

        {/* Root Cause Analyses */}
        <TabsContent value="analyses">
          <div className="max-h-96 overflow-y-auto space-y-2">
            {analyses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="mx-auto h-8 w-8 mb-2" />
                No failure analyses yet
              </div>
            ) : (
              analyses.map((analysis) => (
                <Card key={analysis.id} className="p-3">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedAnalysis(expandedAnalysis === analysis.id ? null : analysis.id)}
                  >
                    <div className="flex items-center gap-3">
                      {getCategoryIcon(analysis.category)}
                      <div>
                        <div className="font-medium text-foreground">
                          {analysis.testCaseName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-sm">
                          {analysis.rootCause}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn('text-xs', getCategoryBadgeClass(analysis.category))}>
                        {analysis.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(analysis.confidence * 100)}%
                      </span>
                      {analysis.verified ? (
                        <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                      ) : (
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      {expandedAnalysis === analysis.id ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {expandedAnalysis === analysis.id && (
                    <div className="mt-3 pt-3 border-t border-border space-y-3">
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Root Cause:</div>
                        <p className="text-sm text-foreground">{analysis.rootCause}</p>
                      </div>

                      {analysis.hypothesis && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Hypothesis:</div>
                          <p className="text-sm text-muted-foreground">{analysis.hypothesis}</p>
                        </div>
                      )}

                      {analysis.minimalSteps.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Minimal Reproduction:</div>
                          <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                            {analysis.minimalSteps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {analysis.environmentFactors.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Environment Factors:</div>
                          <div className="flex flex-wrap gap-1">
                            {analysis.environmentFactors.map((factor, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {factor}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {analysis.fixSuggestion && (
                        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                            Suggested Fix:
                          </div>
                          <p className="text-xs text-green-600 dark:text-green-300">{analysis.fixSuggestion}</p>
                        </div>
                      )}

                      {analysis.testImprovement && (
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                            Test Improvement:
                          </div>
                          <p className="text-xs text-blue-600 dark:text-blue-300">{analysis.testImprovement}</p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Correlations */}
        <TabsContent value="correlations">
          <div className="max-h-96 overflow-y-auto space-y-2">
            {correlations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link className="mx-auto h-8 w-8 mb-2" />
                No failure correlations found
              </div>
            ) : (
              correlations.map((correlation) => (
                <Card key={correlation.id} className="p-3 border-sky-200 dark:border-sky-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4 text-sky-500 dark:text-sky-400" />
                      <span className="font-medium text-foreground">
                        {getCorrelationTypeLabel(correlation.correlationType)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-sky-600 dark:text-sky-400">
                        {correlation.failureCount} failures linked
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(correlation.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {correlation.patternDescription}
                  </p>
                  {correlation.sharedRootCause && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">Shared cause:</span> {correlation.sharedRootCause}
                    </div>
                  )}
                  {correlation.sharedComponent && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium">Component:</span> {correlation.sharedComponent}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Flaky Tests */}
        <TabsContent value="flaky">
          <div className="max-h-96 overflow-y-auto space-y-2">
            {flakyTests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="mx-auto h-8 w-8 mb-2" />
                No flaky tests detected
              </div>
            ) : (
              flakyTests.map((test, idx) => (
                <Card key={test.testCaseId || idx} className="p-3 border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                      <span className="font-medium text-foreground">
                        {test.testCaseName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={test.passRate}
                        className="w-24 h-2"
                      />
                      <span className="text-sm text-yellow-600 dark:text-yellow-400">
                        {Math.round(test.passRate)}% pass rate
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalysisTab;
