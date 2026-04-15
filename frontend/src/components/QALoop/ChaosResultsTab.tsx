import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Shield,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ChaosResult {
  id: string;
  pageUrl: string;
  elementSelector?: string;
  attackCategory: string;
  attackName: string;
  payloadUsed: string;
  result: 'vulnerable' | 'blocked' | 'error' | 'timeout' | 'inconclusive';
  vulnerabilityConfirmed: boolean;
  severity?: string;
  confidence: number;
  reproductionSteps: string[];
  evidenceScreenshot?: string;
}

export interface ChaosSummary {
  totalAttacks: number;
  vulnerabilitiesFound: number;
  blockedAttacks: number;
  errors: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  pagesTested: number;
  inputsTested: number;
  durationMs: number;
}

interface ChaosResultsTabProps {
  results: ChaosResult[];
  summary?: ChaosSummary;
  isRunning?: boolean;
}

export const ChaosResultsTab: React.FC<ChaosResultsTabProps> = ({
  results,
  summary,
  isRunning
}) => {
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'vulnerable' | 'blocked'>('all');

  const getSeverityBadgeClass = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'vulnerable': return <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />;
      case 'blocked': return <Shield className="h-4 w-4 text-green-500 dark:text-green-400" />;
      case 'error': return <X className="h-4 w-4 text-muted-foreground" />;
      default: return <Check className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'injection': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'xss': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
      case 'boundary': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'timing': return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800';
      case 'security': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      case 'a11y': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredResults = results.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'vulnerable') return r.vulnerabilityConfirmed;
    if (filter === 'blocked') return r.result === 'blocked';
    return true;
  });

  const vulnerabilities = results.filter(r => r.vulnerabilityConfirmed);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {summary.vulnerabilitiesFound}
            </div>
            <div className="text-xs text-red-500 dark:text-red-400">Vulnerabilities</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {summary.blockedAttacks}
            </div>
            <div className="text-xs text-green-500 dark:text-green-400">Blocked</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {summary.totalAttacks}
            </div>
            <div className="text-xs text-blue-500 dark:text-blue-400">Total Attacks</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {summary.pagesTested}
            </div>
            <div className="text-xs text-sky-500 dark:text-sky-400">Pages Tested</div>
          </Card>
        </div>
      )}

      {/* Severity Breakdown */}
      {summary && summary.vulnerabilitiesFound > 0 && (
        <Card className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground me-2">By Severity:</span>
            {summary.criticalFindings > 0 && (
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                {summary.criticalFindings} Critical
              </Badge>
            )}
            {summary.highFindings > 0 && (
              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800">
                {summary.highFindings} High
              </Badge>
            )}
            {summary.mediumFindings > 0 && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800">
                {summary.mediumFindings} Medium
              </Badge>
            )}
            {summary.lowFindings > 0 && (
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                {summary.lowFindings} Low
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={v => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">
            All ({results.length})
          </TabsTrigger>
          <TabsTrigger value="vulnerable">
            Vulnerabilities ({vulnerabilities.length})
          </TabsTrigger>
          <TabsTrigger value="blocked">
            Blocked ({results.filter(r => r.result === 'blocked').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter}>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {isRunning && results.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="mx-auto h-8 w-8 mb-2 animate-spin" />
                Running chaos tests...
              </div>
            )}

            {!isRunning && results.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No chaos tests run yet. Start a session with chaos mode enabled.
              </div>
            )}

            {filteredResults.map((result, idx) => (
              <Card
                key={result.id || idx}
                className={cn(
                  'p-3',
                  result.vulnerabilityConfirmed && 'border-red-200 dark:border-red-800'
                )}
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedResult(expandedResult === result.id ? null : result.id)}
                >
                  <div className="flex items-center gap-3">
                    {getResultIcon(result.result)}
                    <div>
                      <div className="font-medium text-foreground">
                        {result.attackName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-xs">
                        {result.pageUrl ? new URL(result.pageUrl).pathname : 'Unknown page'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('text-xs', getCategoryBadgeClass(result.attackCategory))}>
                      {result.attackCategory}
                    </Badge>
                    {result.severity && result.vulnerabilityConfirmed && (
                      <Badge variant="outline" className={cn('text-xs', getSeverityBadgeClass(result.severity))}>
                        {result.severity}
                      </Badge>
                    )}
                    {expandedResult === result.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {expandedResult === result.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Payload Used:</div>
                      <code className="text-xs bg-muted px-2 py-1 rounded-md block overflow-x-auto">
                        {result.payloadUsed}
                      </code>
                    </div>

                    {result.elementSelector && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Element:</div>
                        <code className="text-xs bg-muted px-2 py-1 rounded-md">
                          {result.elementSelector}
                        </code>
                      </div>
                    )}

                    {result.reproductionSteps.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Reproduction Steps:</div>
                        <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                          {result.reproductionSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Confidence: {Math.round(result.confidence * 100)}%
                      </span>
                      {result.pageUrl && (
                        <a
                          href={result.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 flex items-center gap-1"
                        >
                          Open Page <ExternalLink className="h-3 w-3 rtl:scale-x-[-1]" />
                        </a>
                      )}
                    </div>

                    {result.evidenceScreenshot && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Evidence:</div>
                        <img
                          src={result.evidenceScreenshot}
                          alt="Evidence screenshot"
                          className="rounded-lg border border-border max-h-40 object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChaosResultsTab;
