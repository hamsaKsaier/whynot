import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, Image, Pencil, Eye } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { cn } from '../../lib/utils';
import type { ExecutionResult, TestCase, TestStep } from '../../types';
import { VisualComparisonViewer } from '../VisualRegression/VisualComparisonViewer';
import { getExecutionVisualComparisons } from '../../services/api';

interface TestResultsViewProps {
  testCase: TestCase | null;
  executionResult: ExecutionResult | null;
  onViewScreenshots: () => void;
  onStepFix?: (testCase: TestCase, stepIndex: number, step: TestStep) => void;
}

export const TestResultsView: React.FC<TestResultsViewProps> = ({
  testCase,
  executionResult,
  onViewScreenshots,
  onStepFix,
}) => {
  const [selectedComparison, setSelectedComparison] = useState<any>(null);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [visualComparisons, setVisualComparisons] = useState<Record<string, any>>({});

  // Load visual comparisons when execution result is available
  React.useEffect(() => {
    if (executionResult?.execution_id) {
      loadVisualComparisons();
    }
  }, [executionResult?.execution_id]);

  const loadVisualComparisons = async () => {
    if (!executionResult?.execution_id) return;
    try {
      const response = await getExecutionVisualComparisons(executionResult.execution_id);
      const comparisonMap: Record<string, any> = {};
      response.comparisons.forEach((comp: any) => {
        comparisonMap[comp.step_id] = comp;
      });
      setVisualComparisons(comparisonMap);
    } catch (error) {
      console.error('Failed to load visual comparisons:', error);
    }
  };

  const handleViewVisualComparison = (stepId: string) => {
    const comparison = visualComparisons[stepId];
    if (comparison) {
      setSelectedComparison(comparison);
      setComparisonModalOpen(true);
    }
  };

  if (!executionResult) {
    return null;
  }

  const totalSteps = executionResult.steps.length;
  const passedSteps = executionResult.steps.filter(s => s.success).length;
  const failedSteps = executionResult.steps.filter(s => !s.success).length;
  const successRate = totalSteps > 0 ? (passedSteps / totalSteps) * 100 : 0;

  const statusBadgeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    completed: { label: 'COMPLETED', variant: 'outline', className: 'border-green-700 bg-green-900/20 text-green-300' },
    failed:    { label: 'FAILED',    variant: 'destructive' },
    running:   { label: 'RUNNING',   variant: 'outline', className: 'border-blue-700 bg-blue-900/20 text-blue-300' },
    timeout:   { label: 'TIMEOUT',   variant: 'outline', className: 'border-yellow-700 bg-yellow-900/20 text-yellow-300' },
    paused:    { label: 'PAUSED',    variant: 'secondary' },
    cancelled: { label: 'CANCELLED', variant: 'secondary' },
  };

  const statusInfo = statusBadgeMap[executionResult.status] || statusBadgeMap.completed;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Test Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Test Name</p>
                  <p className="text-lg font-bold text-foreground mt-1">
                    {testCase?.name || 'N/A'}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-800/30 bg-green-900/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-400 font-medium">Success Rate</p>
                  <p className="text-lg font-bold text-foreground mt-1">
                    {successRate.toFixed(0)}%
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-800/30 bg-blue-900/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-400 font-medium">Total Steps</p>
                  <p className="text-lg font-bold text-foreground mt-1">
                    {totalSteps}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Duration</p>
                  <p className="text-lg font-bold text-foreground mt-1">
                    {(executionResult.total_duration_ms / 1000).toFixed(2)}s
                  </p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status and Actions */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={statusInfo.variant} className={statusInfo.className}>
              {statusInfo.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {passedSteps} passed, {failedSteps} failed
            </span>
          </div>
          {executionResult.screenshots.length > 0 && (
            <Button variant="outline" size="sm" onClick={onViewScreenshots}>
              <Image className="h-4 w-4 me-2" />
              View Screenshots ({executionResult.screenshots.length})
            </Button>
          )}
        </div>

        <Separator />

        {/* Step-by-Step Results */}
        <div>
          <h4 className="font-semibold text-foreground mb-3">Step-by-Step Results</h4>
          <div className="space-y-2">
            {executionResult.steps.map((step, index) => {
              const correspondingStep = testCase?.steps.find(s => s.id === step.step_id);

              return (
                <div
                  key={step.step_id}
                  className={cn(
                    'p-4 rounded-lg border',
                    step.success
                      ? 'bg-green-900/10 border-green-800/50'
                      : 'bg-destructive/10 border-destructive/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {step.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">
                          Step {index + 1}: {correspondingStep?.description || step.step_id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {step.execution_time_ms}ms
                        </span>
                      </div>
                      {correspondingStep && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Action: <span className="font-medium capitalize">{correspondingStep.action}</span>
                        </p>
                      )}
                      {step.error && (
                        <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                          <strong>Error:</strong> {step.error}
                        </div>
                      )}
                      {step.selector_used && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span className="font-medium">Selector used:</span> {step.selector_used.type} - {step.selector_used.value}
                        </div>
                      )}
                      {/* Visual Regression Indicator */}
                      {(step.visual_comparison || visualComparisons[step.step_id]) && (() => {
                        const comparison = step.visual_comparison || visualComparisons[step.step_id];
                        const severity = comparison?.severity || comparison?.regression_severity || 'medium';
                        const severityColors: Record<string, string> = {
                          low: 'bg-green-900/20 text-green-400 border-green-800/50',
                          medium: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/50',
                          high: 'bg-orange-900/20 text-orange-400 border-orange-800/50',
                          critical: 'bg-destructive/20 text-destructive border-destructive/50',
                        };
                        const isRegression = comparison?.isRegression || comparison?.is_regression;

                        if (isRegression) {
                          return (
                            <div className={cn('mt-2 p-2 rounded border', severityColors[String(severity)] ?? severityColors.medium)}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  <span className="text-sm font-medium">
                                    Visual Regression ({severity.toUpperCase()})
                                  </span>
                                </div>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs"
                                  onClick={() => handleViewVisualComparison(step.step_id)}
                                >
                                  View Details
                                </Button>
                              </div>
                              {comparison?.differences && comparison.differences.length > 0 && (
                                <p className="text-xs mt-1">
                                  {comparison.differences[0]}
                                </p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {/* Fix/Edit Icon */}
                    {testCase && correspondingStep && onStepFix && (
                      <div className="flex-shrink-0 ms-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStepFix(testCase, index, correspondingStep);
                          }}
                          title="Fix or modify this step"
                          aria-label="Fix or modify this step"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Visual Comparison Viewer Modal */}
        {selectedComparison && (
          <VisualComparisonViewer
            isOpen={comparisonModalOpen}
            onClose={() => {
              setComparisonModalOpen(false);
              setSelectedComparison(null);
            }}
            comparison={selectedComparison}
            baselineScreenshotPath={selectedComparison.baseline_id ? undefined : undefined}
            currentScreenshotPath={selectedComparison.current_screenshot_path}
            diffImagePath={selectedComparison.diff_image_path}
            onUpdate={loadVisualComparisons}
          />
        )}

        {/* Error Summary */}
        {executionResult.error && (
          <div className="p-4 bg-destructive/10 border border-destructive/50 rounded-lg">
            <h4 className="font-semibold text-destructive mb-2">Execution Error</h4>
            <p className="text-sm text-destructive">{executionResult.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
