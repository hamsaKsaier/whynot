import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { FiLock, FiUnlock, FiImage, FiClock, FiTrash2, FiEye } from 'react-icons/fi';
import type { VisualBaseline } from '../../types';
import {
  getTestCaseBaselines,
  getBaselineHistory,
  setBaselineLock,
  createBaseline,
} from '../../services/api';

interface BaselineManagerProps {
  testCaseId: string;
  onSelectBaseline?: (baseline: VisualBaseline) => void;
}

export const BaselineManager: React.FC<BaselineManagerProps> = ({
  testCaseId,
  onSelectBaseline,
}) => {
  const [baselines, setBaselines] = useState<VisualBaseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [stepHistory, setStepHistory] = useState<VisualBaseline[]>([]);
  const [lockingId, setLockingId] = useState<string | null>(null);

  useEffect(() => {
    loadBaselines();
  }, [testCaseId]);

  const loadBaselines = async () => {
    try {
      setLoading(true);
      const response = await getTestCaseBaselines(testCaseId);
      setBaselines(response.baselines);
    } catch (error) {
      console.error('Failed to load baselines:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStepHistory = async (stepId: string) => {
    try {
      const response = await getBaselineHistory(testCaseId, stepId);
      setStepHistory(response.baselines);
      setSelectedStepId(stepId);
    } catch (error) {
      console.error('Failed to load step history:', error);
    }
  };

  const handleToggleLock = async (baselineId: string, currentLocked: boolean) => {
    try {
      setLockingId(baselineId);
      await setBaselineLock(testCaseId, baselineId, !currentLocked);
      await loadBaselines();
      if (selectedStepId) {
        await loadStepHistory(selectedStepId);
      }
    } catch (error) {
      console.error('Failed to toggle baseline lock:', error);
    } finally {
      setLockingId(null);
    }
  };

  // Group baselines by step_id, showing only the latest version for each step
  const groupedBaselines = baselines.reduce((acc, baseline) => {
    if (!acc[baseline.step_id] || acc[baseline.step_id].baseline_version < baseline.baseline_version) {
      acc[baseline.step_id] = baseline;
    }
    return acc;
  }, {} as Record<string, VisualBaseline>);

  const getScreenshotUrl = (path: string) => {
    if (path.startsWith('http')) return path;
    return `/api/screenshots/${path.replace(/^.*[\\/]/, '')}`;
  };

  if (loading) {
    return (
      <Card title="Visual Baselines">
        <div className="text-center py-8 text-slate-400">Loading baselines...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Visual Baselines" className="space-y-4">
        {Object.keys(groupedBaselines).length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FiImage className="h-12 w-12 mx-auto mb-2 text-slate-500" />
            <p>No baselines found for this test case.</p>
            <p className="text-sm mt-1">Baselines are automatically created after successful test executions.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedBaselines).map(([stepId, baseline]) => (
              <div
                key={baseline.id}
                className="border border-slate-700 rounded-lg p-4 hover:bg-slate-900 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-white">Step: {baseline.step_id}</span>
                      <span className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs">
                        v{baseline.baseline_version}
                      </span>
                      {baseline.is_locked && (
                        <span className="px-2 py-1 bg-yellow-900/30 text-yellow-300 rounded text-xs flex items-center gap-1">
                          <FiLock className="h-3 w-3" />
                          Locked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <FiClock className="h-4 w-4" />
                        {new Date(baseline.created_at).toLocaleDateString()}
                      </span>
                      <span>Created by: {baseline.created_by}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => loadStepHistory(baseline.step_id)}
                    >
                      <FiEye className="h-4 w-4 mr-1" />
                      History
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggleLock(baseline.id, baseline.is_locked)}
                      isLoading={lockingId === baseline.id}
                    >
                      {baseline.is_locked ? (
                        <>
                          <FiUnlock className="h-4 w-4 mr-1" />
                          Unlock
                        </>
                      ) : (
                        <>
                          <FiLock className="h-4 w-4 mr-1" />
                          Lock
                        </>
                      )}
                    </Button>
                    {onSelectBaseline && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onSelectBaseline(baseline)}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>

                {baseline.screenshot_path && (
                  <div className="mt-3">
                    <img
                      src={getScreenshotUrl(baseline.screenshot_path)}
                      alt={`Baseline for step ${baseline.step_id}`}
                      className="w-full max-w-xs h-auto rounded border border-slate-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-screenshot.png';
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Step History Modal */}
      {selectedStepId && stepHistory.length > 0 && (
        <Card
          title={`Baseline History: Step ${selectedStepId}`}
          className="space-y-3"
        >
          <div className="space-y-2">
            {stepHistory.map((baseline) => (
              <div
                key={baseline.id}
                className="flex items-center justify-between p-3 border border-slate-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-slate-800 text-slate-200 rounded text-sm font-medium">
                    Version {baseline.baseline_version}
                  </span>
                  {baseline.is_locked && (
                    <FiLock className="h-4 w-4 text-yellow-600" />
                  )}
                  <span className="text-sm text-slate-400">
                    {new Date(baseline.created_at).toLocaleString()}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleToggleLock(baseline.id, baseline.is_locked)}
                  isLoading={lockingId === baseline.id}
                >
                  {baseline.is_locked ? <FiUnlock /> : <FiLock />}
                </Button>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t">
            <Button variant="secondary" size="sm" onClick={() => setSelectedStepId(null)}>
              Close History
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
