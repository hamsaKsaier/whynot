import React from 'react';
import {
  FiShield,
  FiActivity,
  FiEye,
  FiZap,
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiMinus,
  FiAlertTriangle,
  FiCheckCircle,
  FiDollarSign,
  FiCpu
} from 'react-icons/fi';

export interface QualityScore {
  overall: number;
  breakdown: {
    coverage: number;
    stability: number;
    security: number;
    /** null = not yet measured (no real data available) */
    accessibility: number | null;
    /** null = not yet measured (no real data available) */
    performance: number | null;
  };
  trend: 'improving' | 'stable' | 'declining';
  scoreDelta: number;
}

export interface RiskCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface IterationHistory {
  iteration: number;
  score: number;
  focus: string;
  timestamp: string;
}

// Phase 8: Cost tracking interfaces
export interface CostTracking {
  totalCostCents: number;
  maxCostCents?: number;
  alertLevel: 'none' | 'info' | 'warning' | 'critical';
  alertPercentage: number;
  budgetExceeded: boolean;
  costByPhase?: {
    exploration: number;
    chaos: number;
    detective: number;
    guardian: number;
    retest: number;
  };
  costByModel?: {
    Haiku: number;
    Sonnet: number;
    Opus: number;
  };
  totalTokens?: number;
}

interface QualityDashboardProps {
  qualityScore: QualityScore;
  risks: RiskCounts;
  iterationHistory: IterationHistory[];
  currentIteration: number;
  targetThreshold: number;
  // Phase 8: Cost tracking props
  costTracking?: CostTracking;
}

export const QualityDashboard: React.FC<QualityDashboardProps> = ({
  qualityScore,
  risks,
  iterationHistory,
  currentIteration,
  targetThreshold,
  costTracking
}) => {
  // Format cost in dollars
  const formatCost = (cents: number) => `$${(cents / 100).toFixed(4)}`;

  // Get alert color based on level
  const getAlertColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-500 bg-red-100 dark:bg-red-900/30';
      case 'warning': return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30';
      case 'info': return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30';
      default: return 'text-green-500 bg-green-100 dark:bg-green-900/30';
    }
  };

  const getBudgetBarColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 90) return 'bg-red-400';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  const getTrendIcon = () => {
    switch (qualityScore.trend) {
      case 'improving': return <FiTrendingUp className="text-green-500" />;
      case 'declining': return <FiTrendingDown className="text-red-500" />;
      default: return <FiMinus className="text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    switch (qualityScore.trend) {
      case 'improving': return 'text-green-500';
      case 'declining': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  // 6.5 — static map avoids dynamic class-name interpolation that Tailwind purges
  const iconColorClass: Record<string, string> = {
    blue:   'text-blue-500',
    green:  'text-green-500',
    red:    'text-red-500',
    purple: 'text-purple-500',
    yellow: 'text-yellow-500',
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getGaugeRotation = (score: number) => {
    // Convert 0-100 to -90 to 90 degrees
    return (score / 100) * 180 - 90;
  };

  const totalRisks = risks.critical + risks.high + risks.medium + risks.low;

  return (
    <div className="space-y-6">
      {/* Main Quality Gauge */}
      <div className="flex items-center justify-center gap-8">
        {/* Gauge */}
        <div className="relative w-48 h-24 overflow-hidden">
          {/* Gauge Background */}
          <div className="absolute w-48 h-48 rounded-full border-8 border-gray-200 dark:border-gray-700"
            style={{ top: '0', clipPath: 'inset(50% 0 0 0)' }} />

          {/* Colored arc based on score */}
          <div
            className={`absolute w-48 h-48 rounded-full border-8 ${getScoreBarColor(qualityScore.overall)}`}
            style={{
              top: '0',
              clipPath: 'inset(50% 0 0 0)',
              transform: `rotate(${getGaugeRotation(qualityScore.overall)}deg)`,
              transformOrigin: 'center center'
            }}
          />

          {/* Center text */}
          <div className="absolute inset-0 flex items-end justify-center pb-2">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getScoreColor(qualityScore.overall)}`}>
                {qualityScore.overall}%
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                {getTrendIcon()}
                <span className={getTrendColor()}>
                  {qualityScore.scoreDelta > 0 ? '+' : ''}{qualityScore.scoreDelta}
                </span>
              </div>
            </div>
          </div>

          {/* Min/Max labels */}
          <div className="absolute bottom-0 left-2 text-xs text-gray-400">0</div>
          <div className="absolute bottom-0 right-2 text-xs text-gray-400">100</div>

          {/* Target threshold marker */}
          <div
            className="absolute w-1 h-4 bg-purple-500 rounded"
            style={{
              bottom: '0',
              left: '50%',
              transform: `rotate(${getGaugeRotation(targetThreshold)}deg) translateX(-50%)`,
              transformOrigin: 'bottom center'
            }}
          />
        </div>

        {/* Trend Info */}
        <div className="text-center">
          <div className="text-sm text-gray-500">Target</div>
          <div className="text-2xl font-bold text-purple-500">{targetThreshold}%</div>
          <div className="text-xs text-gray-400">
            {qualityScore.overall >= targetThreshold ? (
              <span className="text-green-500 flex items-center gap-1">
                <FiCheckCircle /> Reached!
              </span>
            ) : (
              <span>{targetThreshold - qualityScore.overall}% to go</span>
            )}
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { key: 'coverage', label: 'Coverage', icon: FiEye, color: 'blue' },
          { key: 'stability', label: 'Stability', icon: FiActivity, color: 'green' },
          { key: 'security', label: 'Security', icon: FiShield, color: 'red' },
          { key: 'accessibility', label: 'A11y', icon: FiEye, color: 'purple' },
          { key: 'performance', label: 'Perf', icon: FiZap, color: 'yellow' }
        ].map(({ key, label, icon: Icon, color }) => {
          const score = qualityScore.breakdown[key as keyof typeof qualityScore.breakdown];
          return (
            <div key={key} className="text-center">
              {/* 6.5 — use static map, never interpolate class names at runtime */}
              <Icon className={`mx-auto text-lg ${iconColorClass[color] ?? 'text-gray-500'} mb-1`} />
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${score !== null ? getScoreBarColor(score) : 'bg-gray-300 dark:bg-gray-600'}`}
                  style={{ width: `${score !== null ? score : 0}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
              {/* 6.4 — null means no real data: show N/A instead of a made-up number */}
              <div className={`text-sm font-medium ${score !== null ? getScoreColor(score) : 'text-gray-400'}`}>
                {score !== null ? `${score}%` : 'N/A'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk Summary */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <FiAlertTriangle className="text-yellow-500" />
            Risk Summary
          </h4>
          <span className="text-xs text-gray-500">{totalRisks} total issues</span>
        </div>
        <div className="flex gap-2">
          {risks.critical > 0 && (
            <div className="flex-1 p-2 bg-red-100 dark:bg-red-900/30 rounded text-center">
              <div className="text-lg font-bold text-red-600">{risks.critical}</div>
              <div className="text-xs text-red-500">Critical</div>
            </div>
          )}
          {risks.high > 0 && (
            <div className="flex-1 p-2 bg-orange-100 dark:bg-orange-900/30 rounded text-center">
              <div className="text-lg font-bold text-orange-600">{risks.high}</div>
              <div className="text-xs text-orange-500">High</div>
            </div>
          )}
          {risks.medium > 0 && (
            <div className="flex-1 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-center">
              <div className="text-lg font-bold text-yellow-600">{risks.medium}</div>
              <div className="text-xs text-yellow-500">Medium</div>
            </div>
          )}
          {risks.low > 0 && (
            <div className="flex-1 p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-center">
              <div className="text-lg font-bold text-blue-600">{risks.low}</div>
              <div className="text-xs text-blue-500">Low</div>
            </div>
          )}
          {totalRisks === 0 && (
            <div className="flex-1 p-2 bg-green-100 dark:bg-green-900/30 rounded text-center">
              <FiCheckCircle className="mx-auto text-lg text-green-500" />
              <div className="text-xs text-green-500 mt-1">No issues!</div>
            </div>
          )}
        </div>
      </div>

      {/* Phase 8: Cost Tracking Section */}
      {costTracking && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <FiDollarSign className="text-green-500" />
              Cost Tracking
            </h4>
            <span className={`text-xs px-2 py-1 rounded ${getAlertColor(costTracking.alertLevel)}`}>
              {costTracking.alertLevel === 'none' ? 'On Budget' :
                costTracking.alertLevel === 'info' ? '50% Used' :
                  costTracking.alertLevel === 'warning' ? '75% Used' :
                    costTracking.budgetExceeded ? 'Budget Exceeded!' : '90% Used'}
            </span>
          </div>

          {/* Budget Progress Bar */}
          {costTracking.maxCostCents && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{formatCost(costTracking.totalCostCents)}</span>
                <span>Budget: {formatCost(costTracking.maxCostCents)}</span>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${getBudgetBarColor(costTracking.alertPercentage)}`}
                  style={{ width: `${Math.min(costTracking.alertPercentage, 100)}%` }}
                />
              </div>
              <div className="text-center text-xs text-gray-500 mt-1">
                {Math.round(costTracking.alertPercentage)}% used
              </div>
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            {/* By Phase */}
            {costTracking.costByPhase && (
              <div>
                <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <FiActivity className="text-purple-500" /> By Phase
                </div>
                <div className="space-y-1">
                  {Object.entries(costTracking.costByPhase)
                    .filter(([_, cost]) => cost > 0)
                    .map(([phase, cost]) => (
                      <div key={phase} className="flex justify-between text-xs">
                        <span className="capitalize text-gray-600 dark:text-gray-400">{phase}</span>
                        <span className="font-medium">{formatCost(cost)}</span>
                      </div>
                    ))
                  }
                  {Object.values(costTracking.costByPhase).every(c => c === 0) && (
                    <span className="text-xs text-gray-400">No usage yet</span>
                  )}
                </div>
              </div>
            )}

            {/* By Model */}
            {costTracking.costByModel && (
              <div>
                <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <FiCpu className="text-blue-500" /> By Model
                </div>
                <div className="space-y-1">
                  {Object.entries(costTracking.costByModel)
                    .filter(([_, cost]) => cost > 0)
                    .map(([model, cost]) => (
                      <div key={model} className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">{model}</span>
                        <span className="font-medium">{formatCost(cost)}</span>
                      </div>
                    ))
                  }
                  {Object.values(costTracking.costByModel).every(c => c === 0) && (
                    <span className="text-xs text-gray-400">No usage yet</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Total Tokens */}
          {costTracking.totalTokens !== undefined && costTracking.totalTokens > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 text-center">
              Total tokens: {costTracking.totalTokens.toLocaleString()}
            </div>
          )}

          {/* Budget Warning */}
          {costTracking.budgetExceeded && (
            <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-center">
              <FiAlertTriangle className="inline text-red-500 mr-1" />
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                Budget limit reached! Session will stop automatically.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Iteration Timeline */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <FiClock className="text-blue-500" />
          Iteration Timeline
        </h4>
        <div className="relative">
          {/* Timeline bar */}
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
            {iterationHistory.map((item, idx) => {
              const width = 100 / Math.max(iterationHistory.length, 1);
              return (
                <div
                  key={idx}
                  className={`h-full ${getScoreBarColor(item.score)}`}
                  style={{ width: `${width}%` }}
                  title={`Iteration ${item.iteration}: ${item.score}%`}
                />
              );
            })}
          </div>

          {/* Score points */}
          <div className="flex justify-between mt-2">
            {iterationHistory.slice(-5).map((item, idx) => (
              <div key={idx} className="text-center">
                <div className={`text-xs font-medium ${getScoreColor(item.score)}`}>
                  {item.score}%
                </div>
                <div className="text-xs text-gray-400">#{item.iteration}</div>
                <div className="text-xs text-gray-400 capitalize">{item.focus}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current Status */}
      <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
        <div className="flex items-center gap-2">
          <FiActivity className="text-purple-500 animate-pulse" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Iteration <span className="font-bold">{currentIteration}</span>
          </span>
        </div>
        <div className="text-sm text-purple-600 dark:text-purple-400">
          {qualityScore.overall >= targetThreshold ? (
            <span className="flex items-center gap-1">
              <FiCheckCircle /> Quality target reached
            </span>
          ) : (
            <span>Working towards {targetThreshold}%...</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default QualityDashboard;
