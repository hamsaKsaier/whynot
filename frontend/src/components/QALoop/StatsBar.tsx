/**
 * StatsBar — the four stat cards + collapsible QualityDashboard that sit
 * at the top of the active-session right column (5.1).
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QualityDashboard } from './QualityDashboard';
import {
  Globe,
  FileText,
  AlertTriangle,
  BarChart2,
} from 'lucide-react';
import { QALoopSession } from '../../services/qa-loop-api';
import { QualityScore, RiskCounts, IterationHistory } from './QualityDashboard';
import { ChaosResult } from './ChaosResultsTab';

export interface StatsBarProps {
  activeSession: QALoopSession;
  /** Live values from WebSocket stream (may be empty arrays before stream connects) */
  pagesExplored: string[];
  testsGenerated: string[];
  bugsFound: Array<{ title: string; severity: string }>;
  chaosResults: ChaosResult[];
  qualityScore: QualityScore;
  risks: RiskCounts;
  iterationHistory: IterationHistory[];
  iteration: number;
  qualityThreshold: number;
  showQualityDashboard: boolean;
  onToggleQualityDashboard: () => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  activeSession,
  pagesExplored,
  testsGenerated,
  bugsFound,
  chaosResults,
  qualityScore,
  risks,
  iterationHistory,
  iteration,
  qualityThreshold,
  showQualityDashboard,
  onToggleQualityDashboard,
}) => (
  <>
    {/* Four stat cards */}
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      <Card className="text-center">
        <CardContent className="p-4">
          <Globe className="mx-auto h-6 w-6 text-blue-500 dark:text-blue-400 mb-2" />
          <div className="text-2xl font-bold text-foreground">
            {pagesExplored.length || activeSession.pages_explored}
          </div>
          <div className="text-xs text-muted-foreground">Pages Explored</div>
        </CardContent>
      </Card>

      <Card className="text-center">
        <CardContent className="p-4">
          <FileText className="mx-auto h-6 w-6 text-green-500 dark:text-green-400 mb-2" />
          <div className="text-2xl font-bold text-foreground">
            {testsGenerated.length || activeSession.tests_generated}
          </div>
          <div className="text-xs text-muted-foreground">Tests Generated</div>
        </CardContent>
      </Card>

      <Card className="text-center">
        <CardContent className="p-4">
          <AlertTriangle className="mx-auto h-6 w-6 text-red-500 dark:text-red-400 mb-2" />
          <div className="text-2xl font-bold text-foreground">
            {bugsFound.length || activeSession.bugs_found}
          </div>
          <div className="text-xs text-muted-foreground">Bugs Found</div>
        </CardContent>
      </Card>

      <Card
        className="text-center cursor-pointer hover:bg-muted/50 transition-colors duration-150"
        onClick={onToggleQualityDashboard}
      >
        <CardContent className="p-4">
          <BarChart2 className="mx-auto h-6 w-6 text-sky-500 dark:text-sky-400 mb-2" />
          <div className="text-2xl font-bold text-foreground">
            {qualityScore.overall}%
          </div>
          <div className="text-xs text-muted-foreground">Quality Score</div>
        </CardContent>
      </Card>
    </div>

    {/* Collapsible quality dashboard */}
    {showQualityDashboard && (
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-sky-500" />
            Quality Dashboard
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleQualityDashboard}
              className="ms-auto text-sm text-muted-foreground"
            >
              Hide
            </Button>
          </h3>
          <QualityDashboard
            qualityScore={qualityScore}
            risks={risks}
            iterationHistory={iterationHistory}
            currentIteration={iteration || activeSession.iteration_count}
            targetThreshold={qualityThreshold}
          />
        </CardContent>
      </Card>
    )}
  </>
);
