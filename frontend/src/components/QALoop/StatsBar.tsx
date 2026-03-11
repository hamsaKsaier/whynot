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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
      <Card className="p-4 text-center">
        <FiGlobe className="mx-auto text-2xl text-blue-500 mb-2" />
        <div className="text-2xl font-bold text-gray-900">
          {pagesExplored.length || activeSession.pages_explored}
        </div>
        <div className="text-xs text-gray-500">Pages Explored</div>
      </Card>

      <Card className="p-4 text-center">
        <FiFileText className="mx-auto text-2xl text-green-500 mb-2" />
        <div className="text-2xl font-bold text-gray-900">
          {testsGenerated.length || activeSession.tests_generated}
        </div>
        <div className="text-xs text-gray-500">Tests Generated</div>
      </Card>

      <Card className="p-4 text-center">
        <FiAlertTriangle className="mx-auto text-2xl text-red-500 mb-2" />
        <div className="text-2xl font-bold text-gray-900">
          {bugsFound.length || activeSession.bugs_found}
        </div>
        <div className="text-xs text-gray-500">Bugs Found</div>
      </Card>

      <Card className="p-4 text-center">
        <FiShield className="mx-auto text-2xl text-orange-500 mb-2" />
        <div className="text-2xl font-bold text-gray-900">
          {chaosResults.filter(r => r.vulnerabilityConfirmed).length}
        </div>
        <div className="text-xs text-gray-500">Vulnerabilities</div>
      </Card>

      <Card
        className="p-4 text-center cursor-pointer hover:bg-gray-50"
        onClick={onToggleQualityDashboard}
      >
        <FiBarChart2 className="mx-auto text-2xl text-purple-500 mb-2" />
        <div className="text-2xl font-bold text-gray-900">
          {qualityScore.overall}%
        </div>
        <div className="text-xs text-gray-500">Quality Score</div>
      </Card>
    </div>

    {/* Collapsible quality dashboard */}
    {showQualityDashboard && (
      <Card className="p-4">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FiBarChart2 className="text-purple-500" />
          Quality Dashboard
          <button
            onClick={onToggleQualityDashboard}
            className="ml-auto text-sm text-gray-500 hover:text-gray-700"
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
