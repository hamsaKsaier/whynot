import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenshotGallery } from './ScreenshotGallery';
import { Card } from '../common/Card';
import { FiX } from 'react-icons/fi';

interface ScreenshotViewerModalProps {
  screenshots: string[];
  stepIds?: string[];
  onClose: () => void;
}

export const ScreenshotViewerModal: React.FC<ScreenshotViewerModalProps> = ({
  screenshots,
  stepIds,
  onClose,
}) => {
  const { t } = useTranslation('results');

  if (screenshots.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="max-w-6xl w-full max-h-[90vh] overflow-y-auto relative">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            {t('results.screenshot.screenshotsCount', { count: screenshots.length })}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            aria-label={t('results.screenshot.close')}
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <ScreenshotGallery
          screenshots={screenshots}
          stepIds={stepIds}
          onClose={onClose}
        />
      </Card>
    </div>
  );
};





























