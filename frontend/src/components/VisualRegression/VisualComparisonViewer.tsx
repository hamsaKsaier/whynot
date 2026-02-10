import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { FiX, FiEye, FiAlertCircle, FiInfo, FiCheck, FiXCircle } from 'react-icons/fi';
import type { VisualComparisonResult, VisualComparison } from '../../types';
import { setVisualRegressionIgnored } from '../../services/api';

interface VisualComparisonViewerProps {
  isOpen: boolean;
  onClose: () => void;
  comparison: VisualComparison | null;
  baselineScreenshotPath?: string;
  currentScreenshotPath?: string;
  diffImagePath?: string;
  onUpdate?: () => void;
}

export const VisualComparisonViewer: React.FC<VisualComparisonViewerProps> = ({
  isOpen,
  onClose,
  comparison,
  baselineScreenshotPath,
  currentScreenshotPath,
  diffImagePath,
  onUpdate,
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay' | 'diff'>('side-by-side');
  const [isIgnoring, setIsIgnoring] = useState(false);

  if (!comparison || !isOpen) return null;

  const severityColors = {
    low: 'bg-green-100 text-green-800 border-green-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    critical: 'bg-red-100 text-red-800 border-red-300',
  };

  const severityIcons = {
    low: FiCheck,
    medium: FiAlertCircle,
    high: FiAlertCircle,
    critical: FiXCircle,
  };

  const SeverityIcon = severityIcons[comparison.regression_severity || 'medium'];
  const severityColor = severityColors[comparison.regression_severity || 'medium'];

  const handleIgnore = async () => {
    if (!comparison.id) return;
    setIsIgnoring(true);
    try {
      await setVisualRegressionIgnored(comparison.id, !comparison.ignored);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to update regression ignored status:', error);
    } finally {
      setIsIgnoring(false);
    }
  };

  const getScreenshotUrl = (path: string) => {
    // Assuming screenshots are served from /api/screenshots or similar
    if (path.startsWith('http')) return path;
    return `/api/screenshots/${path.replace(/^.*[\\/]/, '')}`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Visual Regression Analysis" size="xl">
      <div className="space-y-4">
        {/* Severity Badge */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${severityColor}`}>
          <SeverityIcon className="h-5 w-5" />
          <span className="font-semibold">
            {comparison.regression_severity?.toUpperCase() || 'UNKNOWN'} Severity
          </span>
          <span className="ml-auto text-sm">
            Pixel Difference: {(comparison.pixel_diff_score * 100).toFixed(2)}%
          </span>
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'side-by-side' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('side-by-side')}
          >
            Side-by-Side
          </Button>
          <Button
            variant={viewMode === 'overlay' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('overlay')}
          >
            Overlay
          </Button>
          {diffImagePath && (
            <Button
              variant={viewMode === 'diff' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('diff')}
            >
              Diff View
            </Button>
          )}
        </div>

        {/* Screenshot Comparison */}
        <div className="grid grid-cols-2 gap-4">
          {viewMode === 'side-by-side' && (
            <>
              <Card title="Baseline" className="p-0">
                {baselineScreenshotPath && (
                  <img
                    src={getScreenshotUrl(baselineScreenshotPath)}
                    alt="Baseline"
                    className="w-full h-auto rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-screenshot.png';
                    }}
                  />
                )}
              </Card>
              <Card title="Current" className="p-0">
                {currentScreenshotPath && (
                  <img
                    src={getScreenshotUrl(currentScreenshotPath)}
                    alt="Current"
                    className="w-full h-auto rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-screenshot.png';
                    }}
                  />
                )}
              </Card>
            </>
          )}

          {viewMode === 'overlay' && (
            <div className="col-span-2 relative">
              <div className="grid grid-cols-2 gap-2">
                {baselineScreenshotPath && (
                  <img
                    src={getScreenshotUrl(baselineScreenshotPath)}
                    alt="Baseline"
                    className="w-full h-auto rounded-lg opacity-50"
                  />
                )}
                {currentScreenshotPath && (
                  <img
                    src={getScreenshotUrl(currentScreenshotPath)}
                    alt="Current"
                    className="w-full h-auto rounded-lg opacity-50"
                  />
                )}
              </div>
            </div>
          )}

          {viewMode === 'diff' && diffImagePath && (
            <div className="col-span-2">
              <Card title="Diff Image" className="p-0">
                <img
                  src={getScreenshotUrl(diffImagePath)}
                  alt="Diff"
                  className="w-full h-auto rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-screenshot.png';
                  }}
                />
              </Card>
            </div>
          )}
        </div>

        {/* AI Analysis */}
        {comparison.ai_diff_analysis && (
          <Card title="AI Analysis" className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Difference Types:</h4>
              <div className="flex flex-wrap gap-2">
                {comparison.ai_diff_analysis.difference_types.map((type, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Descriptions:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                {comparison.ai_diff_analysis.descriptions.map((desc, idx) => (
                  <li key={idx}>{desc}</li>
                ))}
              </ul>
            </div>

            {comparison.ai_diff_analysis.affected_areas && comparison.ai_diff_analysis.affected_areas.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Affected Areas:</h4>
                <ul className="space-y-2">
                  {comparison.ai_diff_analysis.affected_areas.map((area, idx) => (
                    <li key={idx} className="text-sm">
                      <span className="font-medium">{area.region}:</span>{' '}
                      <span className="text-gray-600">{area.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {comparison.ai_diff_analysis.recommendations && comparison.ai_diff_analysis.recommendations.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Recommendations:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  {comparison.ai_diff_analysis.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FiInfo className="h-4 w-4" />
            <span>
              Step ID: {comparison.step_id} | Created: {new Date(comparison.created_at).toLocaleString()}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant={comparison.ignored ? 'secondary' : 'danger'}
              size="sm"
              onClick={handleIgnore}
              isLoading={isIgnoring}
            >
              {comparison.ignored ? 'Unignore' : 'Ignore'}
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
