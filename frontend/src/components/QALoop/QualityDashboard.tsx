import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Activity,
  Eye,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Cpu,
} from 'lucide-react';

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
  const { t } = useTranslation('runner');

  // Format cost in dollars
  const formatCost = (cents: number) => `$${(cents / 100).toFixed(4)}`;

  // Get alert badge variant based on level
  const getAlertBadgeClasses = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'warning': return 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 'info': return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      default: return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800';
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
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (qualityScore.trend) {
      case 'improving': return 'text-green-500';
      case 'declining': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  // 6.5 -- static map avoids dynamic class-name interpolation that Tailwind purges
  const iconColorClass: Record<string, string> = {
    blue:   'text-blue-500',
    green:  'text-green-500',
    red:    'text-red-500',
    sky:    'text-sky-500',
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
          <div className="absolute w-48 h-48 rounded-full border-8 border-muted"
            style={{ top: '0', clipPath: 'inset(50% 0 0 0)' }} />

          {/* Colored arc based on score */}
          <div
            className={cn("absolute w-48 h-48 rounded-full border-8", getScoreBarColor(qualityScore.overall))}
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
              <div className={cn("text-3xl font-bold", getScoreColor(qualityScore.overall))}>
                {qualityScore.overall}%
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {getTrendIcon()}
                <span className={getTrendColor()}>
                  {qualityScore.scoreDelta > 0 ? '+' : ''}{qualityScore.scoreDelta}
                </span>
              </div>
            </div>
          </div>

          {/* Min/Max labels */}
          <div className="absolute bottom-0 start-2 text-xs text-muted-foreground">0</div>
          <div className="absolute bottom-0 end-2 text-xs text-muted-foreground">100</div>

          {/* Target threshold marker */}
          <div
            className="absolute w-1 h-4 bg-sky-500 rounded"
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
          <div className="text-sm text-muted-foreground">{t('runner.qaLoop.qualityDashboard.target')}</div>
          <div className="text-2xl font-bold text-sky-500">{targetThreshold}%</div>
          <div className="text-xs text-muted-foreground">
            {qualityScore.overall >= targetThreshold ? (
              <span className="text-green-500 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> {t('runner.qaLoop.qualityDashboard.reached')}
              </span>
            ) : (
              <span>{t('runner.qaLoop.qualityDashboard.toGo', { value: targetThreshold - qualityScore.overall })}</span>
            )}
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { key: 'coverage', label: 'Coverage', icon: Eye, color: 'blue' },
          { key: 'stability', label: 'Stability', icon: Activity, color: 'green' },
          { key: 'security', label: 'Security', icon: Shield, color: 'red' },
          { key: 'accessibility', label: 'A11y', icon: Eye, color: 'sky' },
          { key: 'performance', label: 'Perf', icon: Zap, color: 'yellow' }
        ].map(({ key, label, icon: Icon, color }) => {
          const score = qualityScore.breakdown[key as keyof typeof qualityScore.breakdown];
          return (
            <div key={key} className="text-center">
              {/* 6.5 -- use static map, never interpolate class names at runtime */}
              <Icon className={cn("mx-auto h-4 w-4 mb-1", iconColorClass[color] ?? 'text-muted-foreground')} />
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full", score !== null ? getScoreBarColor(score) : 'bg-muted-foreground/30')}
                  style={{ width: `${score !== null ? score : 0}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
              {/* 6.4 -- null means no real data: show N/A instead of a made-up number */}
              <div className={cn("text-sm font-medium", score !== null ? getScoreColor(score) : 'text-muted-foreground')}>
                {score !== null ? `${score}%` : 'N/A'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              {t('runner.qaLoop.qualityDashboard.riskSummary')}
            </h4>
            <span className="text-xs text-muted-foreground">{t('runner.qaLoop.qualityDashboard.totalIssues', { count: totalRisks })}</span>
          </div>
          <div className="flex gap-2">
            {risks.critical > 0 && (
              <div className="flex-1 p-2 bg-red-50 dark:bg-red-900/20 rounded-md text-center">
                <div className="text-lg font-bold text-red-700 dark:text-red-300">{risks.critical}</div>
                <div className="text-xs text-red-600 dark:text-red-400">{t('runner.qaLoop.qualityDashboard.critical')}</div>
              </div>
            )}
            {risks.high > 0 && (
              <div className="flex-1 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-md text-center">
                <div className="text-lg font-bold text-orange-700 dark:text-orange-300">{risks.high}</div>
                <div className="text-xs text-orange-600 dark:text-orange-400">{t('runner.qaLoop.qualityDashboard.high')}</div>
              </div>
            )}
            {risks.medium > 0 && (
              <div className="flex-1 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-center">
                <div className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{risks.medium}</div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400">{t('runner.qaLoop.qualityDashboard.medium')}</div>
              </div>
            )}
            {risks.low > 0 && (
              <div className="flex-1 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md text-center">
                <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{risks.low}</div>
                <div className="text-xs text-blue-600 dark:text-blue-400">{t('runner.qaLoop.qualityDashboard.low')}</div>
              </div>
            )}
            {totalRisks === 0 && (
              <div className="flex-1 p-2 bg-green-50 dark:bg-green-900/20 rounded-md text-center">
                <CheckCircle className="mx-auto h-4 w-4 text-green-500" />
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">{t('runner.qaLoop.qualityDashboard.noIssues')}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Phase 8: Cost Tracking Section */}
      {costTracking && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                {t('runner.qaLoop.qualityDashboard.costTracking')}
              </h4>
              <Badge variant="outline" className={cn("text-xs", getAlertBadgeClasses(costTracking.alertLevel))}>
                {costTracking.alertLevel === 'none' ? t('runner.qaLoop.qualityDashboard.onBudget') :
                  costTracking.alertLevel === 'info' ? t('runner.qaLoop.qualityDashboard.fiftyUsed') :
                    costTracking.alertLevel === 'warning' ? t('runner.qaLoop.qualityDashboard.seventyFiveUsed') :
                      costTracking.budgetExceeded ? t('runner.qaLoop.qualityDashboard.budgetExceeded') : t('runner.qaLoop.qualityDashboard.ninetyUsed')}
              </Badge>
            </div>

            {/* Budget Progress Bar */}
            {costTracking.maxCostCents && (
              <div className="mb-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{formatCost(costTracking.totalCostCents)}</span>
                  <span>{t('runner.qaLoop.qualityDashboard.budget')}: {formatCost(costTracking.maxCostCents)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full transition-colors duration-150", getBudgetBarColor(costTracking.alertPercentage))}
                    style={{ width: `${Math.min(costTracking.alertPercentage, 100)}%` }}
                  />
                </div>
                <div className="text-center text-xs text-muted-foreground mt-1">
                  {Math.round(costTracking.alertPercentage)}% used
                </div>
              </div>
            )}

            {/* Cost Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              {/* By Phase */}
              {costTracking.costByPhase && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Activity className="h-3 w-3 text-sky-500" /> {t('runner.qaLoop.qualityDashboard.byPhase')}
                  </div>
                  <div className="space-y-1">
                    {Object.entries(costTracking.costByPhase)
                      .filter(([_, cost]) => cost > 0)
                      .map(([phase, cost]) => (
                        <div key={phase} className="flex justify-between text-xs">
                          <span className="capitalize text-muted-foreground">{phase}</span>
                          <span className="font-medium text-foreground">{formatCost(cost)}</span>
                        </div>
                      ))
                    }
                    {Object.values(costTracking.costByPhase).every(c => c === 0) && (
                      <span className="text-xs text-muted-foreground">{t('runner.qaLoop.qualityDashboard.noUsage')}</span>
                    )}
                  </div>
                </div>
              )}

              {/* By Model */}
              {costTracking.costByModel && (
                <div>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Cpu className="h-3 w-3 text-blue-500" /> {t('runner.qaLoop.qualityDashboard.byModel')}
                  </div>
                  <div className="space-y-1">
                    {Object.entries(costTracking.costByModel)
                      .filter(([_, cost]) => cost > 0)
                      .map(([model, cost]) => (
                        <div key={model} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{model}</span>
                          <span className="font-medium text-foreground">{formatCost(cost)}</span>
                        </div>
                      ))
                    }
                    {Object.values(costTracking.costByModel).every(c => c === 0) && (
                      <span className="text-xs text-muted-foreground">{t('runner.qaLoop.qualityDashboard.noUsage')}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Total Tokens */}
            {costTracking.totalTokens !== undefined && costTracking.totalTokens > 0 && (
              <>
                <Separator className="mt-3 mb-3" />
                <div className="text-xs text-muted-foreground text-center">
                  Total tokens: {costTracking.totalTokens.toLocaleString()}
                </div>
              </>
            )}

            {/* Budget Warning */}
            {costTracking.budgetExceeded && (
              <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                <AlertTriangle className="inline h-3 w-3 text-red-500 me-1" />
                <span className="text-xs text-red-700 dark:text-red-300 font-medium">
                  {t('runner.qaLoop.qualityDashboard.budgetLimitReached')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Iteration Timeline */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          {t('runner.qaLoop.qualityDashboard.iterationTimeline')}
        </h4>
        <div className="relative">
          {/* Timeline bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden flex">
            {iterationHistory.map((item, idx) => {
              const width = 100 / Math.max(iterationHistory.length, 1);
              return (
                <div
                  key={idx}
                  className={getScoreBarColor(item.score)}
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
                <div className={cn("text-xs font-medium", getScoreColor(item.score))}>
                  {item.score}%
                </div>
                <div className="text-xs text-muted-foreground">#{item.iteration}</div>
                <div className="text-xs text-muted-foreground capitalize">{item.focus}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current Status */}
      <div className="flex items-center justify-between p-3 bg-sky-50 dark:bg-sky-900/20 rounded-lg">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-sky-500" />
          <span className="text-sm text-foreground">
            {t('runner.qaLoop.qualityDashboard.iterationLabel')} <span className="font-bold">{currentIteration}</span>
          </span>
        </div>
        <div className="text-sm text-sky-600 dark:text-sky-400">
          {qualityScore.overall >= targetThreshold ? (
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> {t('runner.qaLoop.qualityDashboard.targetReached')}
            </span>
          ) : (
            <span>{t('runner.qaLoop.qualityDashboard.workingTowards', { value: targetThreshold })}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default QualityDashboard;
