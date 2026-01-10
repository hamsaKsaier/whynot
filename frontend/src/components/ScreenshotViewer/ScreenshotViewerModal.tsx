import React from 'react';
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
  if (screenshots.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="max-w-6xl w-full max-h-[90vh] overflow-y-auto relative">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Screenshots ({screenshots.length})
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
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





























