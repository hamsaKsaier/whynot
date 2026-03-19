/**
 * StatsBar — the five stat cards + collapsible QualityDashboard that sit
 * at the top of the active-session right column (5.1).
 */
import React from 'react';
import { Card } from '../common/Card';
import { QualityDashboard } from './QualityDashboard';
import {
  FiGlobe,
  FiFileText,
  FiAlertTriangle,
  FiShield,
  FiBarChart2,
} from 'react-icons/fi';
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
    {/* Five stat cards */}
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      <Card className="p-4 text-center">
        <FiGlobe className="mx-auto text-2xl text-blue-500 mb-2" />
        <div className="text-2xl font-bold text-white">
          {pagesExplored.length || activeSession.pages_explored}
        </div>
        <div className="text-xs text-slate-400">Pages Explored</div>
      </Card>

      <Card className="p-4 text-center">
        <FiFileText className="mx-auto text-2xl text-green-500 mb-2" />
        <div className="text-2xl font-bold text-white">
          {testsGenerated.length || activeSession.tests_generated}
        </div>
        <div className="text-xs text-slate-400">Tests Generated</div>
      </Card>

      <Card className="p-4 text-center">
        <FiAlertTriangle className="mx-auto text-2xl text-red-500 mb-2" />
        <div className="text-2xl font-bold text-white">
          {bugsFound.length || activeSession.bugs_found}
        </div>
        <div className="text-xs text-slate-400">Bugs Found</div>
      </Card>

      <Card
        className="p-4 text-center cursor-pointer hover:bg-slate-900"
        onClick={onToggleQualityDashboard}
      >
        <FiBarChart2 className="mx-auto text-2xl text-sky-500 mb-2" />
        <div className="text-2xl font-bold text-white">
          {qualityScore.overall}%
        </div>
        <div className="text-xs text-slate-400">Quality Score</div>
      </Card>
    </div>

    {/* Collapsible quality dashboard */}
    {showQualityDashboard && (
      <Card className="p-4">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <FiBarChart2 className="text-sky-500" />
          Quality Dashboard
          <button
            onClick={onToggleQualityDashboard}
            className="ml-auto text-sm text-slate-400 hover:text-slate-200"
          >
            Hide
          </button>
        </h3>
        <QualityDashboard
          qualityScore={qualityScore}
          risks={risks}
          iterationHistory={iterationHistory}
          currentIteration={iteration || activeSession.iteration_count}
          targetThreshold={qualityThreshold}
        />
      </Card>
    )}
  </>
);
