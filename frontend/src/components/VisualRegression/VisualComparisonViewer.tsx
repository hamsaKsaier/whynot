import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('results');
  const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay' | 'diff'>('side-by-side');
  const [isIgnoring, setIsIgnoring] = useState(false);

  if (!comparison || !isOpen) return null;

  const severityColors = {
    low: 'bg-green-900/30 text-green-300 border-green-700',
    medium: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
    high: 'bg-orange-900/30 text-orange-300 border-orange-700',
    critical: 'bg-red-900/30 text-red-300 border-red-700',
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
    <Modal isOpen={isOpen} onClose={onClose} title={t('results.visualRegression.analysisTitle')} size="xl">
      <div className="space-y-4">
        {/* Severity Badge */}
        <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg border ${severityColor}`}>
          <div className="flex items-center gap-2">
            <SeverityIcon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span className="font-semibold text-xs sm:text-base">
              {t('results.visualRegression.severity', { level: comparison.regression_severity?.toUpperCase() || 'UNKNOWN' })}
            </span>
          </div>
          <span className="sm:ms-auto text-[10px] sm:text-sm">
            {t('results.visualRegression.pixelDifference')}: {(comparison.pixel_diff_score * 100).toFixed(2)}%
          </span>
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1" role="tablist">
          <Button
            variant={viewMode === 'side-by-side' ? 'primary' : 'secondary'}
            size="sm"
            className="min-h-[44px] min-w-[44px] shrink-0 flex-1 sm:flex-initial"
            onClick={() => setViewMode('side-by-side')}
            role="tab"
            aria-selected={viewMode === 'side-by-side'}
          >
            {t('results.visualRegression.sideBySide')}
          </Button>
          <Button
            variant={viewMode === 'overlay' ? 'primary' : 'secondary'}
            size="sm"
            className="min-h-[44px] min-w-[44px] shrink-0 flex-1 sm:flex-initial"
            onClick={() => setViewMode('overlay')}
            role="tab"
            aria-selected={viewMode === 'overlay'}
          >
            {t('results.visualRegression.overlay')}
          </Button>
          {diffImagePath && (
            <Button
              variant={viewMode === 'diff' ? 'primary' : 'secondary'}
              size="sm"
              className="min-h-[44px] min-w-[44px] shrink-0 flex-1 sm:flex-initial"
              onClick={() => setViewMode('diff')}
              role="tab"
              aria-selected={viewMode === 'diff'}
            >
              {t('results.visualRegression.diffView')}
            </Button>
          )}
        </div>

        {/* Screenshot Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {viewMode === 'side-by-side' && (
            <>
              <Card title={t('results.visualRegression.baseline')} className="p-0">
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
              <Card title={t('results.visualRegression.current')} className="p-0">
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
            <div className="col-span-1 md:col-span-2 relative">
              <div className="relative">
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
                {currentScreenshotPath && (
                  <img
                    src={getScreenshotUrl(currentScreenshotPath)}
                    alt="Current"
                    className="absolute inset-0 w-full h-auto rounded-lg opacity-50"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-screenshot.png';
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {viewMode === 'diff' && diffImagePath && (
            <div className="col-span-1 md:col-span-2">
              <Card title={t('results.visualRegression.diffImage')} className="p-0">
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
          <Card title={t('results.visualRegression.aiAnalysis')} className="space-y-2.5 sm:space-y-3">
            <div>
              <h4 className="font-semibold text-xs sm:text-sm text-foreground mb-1.5 sm:mb-2">{t('results.visualRegression.differenceTypes')}:</h4>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {comparison.ai_diff_analysis.difference_types.map((type, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 sm:py-1 bg-blue-900/30 text-blue-300 rounded text-[10px] sm:text-xs"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-xs sm:text-sm text-foreground mb-1.5 sm:mb-2">{t('results.visualRegression.descriptions')}:</h4>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-muted-foreground">
                {comparison.ai_diff_analysis.descriptions.map((desc, idx) => (
                  <li key={idx} className="break-words">{desc}</li>
                ))}
              </ul>
            </div>

            {comparison.ai_diff_analysis.affected_areas && comparison.ai_diff_analysis.affected_areas.length > 0 && (
              <div>
                <h4 className="font-semibold text-xs sm:text-sm text-foreground mb-1.5 sm:mb-2">{t('results.visualRegression.affectedAreas')}:</h4>
                <ul className="space-y-1.5 sm:space-y-2">
                  {comparison.ai_diff_analysis.affected_areas.map((area, idx) => (
                    <li key={idx} className="text-xs sm:text-sm">
                      <span className="font-medium">{area.region}:</span>{' '}
                      <span className="text-muted-foreground">{area.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {comparison.ai_diff_analysis.recommendations && comparison.ai_diff_analysis.recommendations.length > 0 && (
              <div>
                <h4 className="font-semibold text-xs sm:text-sm text-foreground mb-1.5 sm:mb-2">{t('results.visualRegression.recommendations')}:</h4>
                <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-muted-foreground">
                  {comparison.ai_diff_analysis.recommendations.map((rec, idx) => (
                    <li key={idx} className="break-words">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <FiInfo className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-all text-xs sm:text-sm">
              Step ID: {comparison.step_id} | Created: {new Date(comparison.created_at).toLocaleString()}
            </span>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant={comparison.ignored ? 'secondary' : 'danger'}
              size="sm"
              className="flex-1 sm:flex-initial min-h-[44px]"
              onClick={handleIgnore}
              isLoading={isIgnoring}
            >
              {comparison.ignored ? t('results.visualRegression.unignore') : t('results.visualRegression.ignore')}
            </Button>
            <Button variant="secondary" size="sm" className="flex-1 sm:flex-initial min-h-[44px]" onClick={onClose}>
              {t('results.visualRegression.close')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
