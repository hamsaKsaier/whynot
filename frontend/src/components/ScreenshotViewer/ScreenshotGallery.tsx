import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX, FiDownload, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface ScreenshotGalleryProps {
  screenshots: string[];
  stepIds?: string[];
  onClose: () => void;
}

export const ScreenshotGallery: React.FC<ScreenshotGalleryProps> = ({
  screenshots,
  stepIds = [],
  onClose,
}) => {
  const { t } = useTranslation('results');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (screenshots.length === 0) {
    return null;
  }

  const currentScreenshot = screenshots[selectedIndex];
  const currentStepId = stepIds[selectedIndex] || `Step ${selectedIndex + 1}`;

  const nextScreenshot = () => {
    setSelectedIndex((prev) => (prev + 1) % screenshots.length);
  };

  const prevScreenshot = () => {
    setSelectedIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length);
  };

  const downloadScreenshot = async (url: string, filename: string) => {
    try {
      // For local files, create a download link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download screenshot:', error);
    }
  };

  const getScreenshotUrl = (path: string) => {
    // If it's a full URL, return as is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    // For local paths, try to load from the API
    // In production, this would be served by the backend
    return `/api/screenshots/${path.split('/').pop()}`;
  };

  return (
    <>
      {/* Gallery Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {screenshots.map((screenshot, index) => (
          <div
            key={index}
            className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${
              selectedIndex === index
                ? 'border-primary-500 ring-1 ring-primary'
                : 'border-border hover:border-muted-foreground'
            }`}
            onClick={() => {
              setSelectedIndex(index);
              setIsLightboxOpen(true);
            }}
          >
            <img
              src={getScreenshotUrl(screenshot)}
              alt={t('results.screenshot.altImage', { index: index + 1 })}
              className="w-full h-32 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not found%3C/text%3E%3C/svg%3E';
              }}
            />
            <div className="absolute bottom-0 start-0 end-0 bg-foreground/50 text-background text-xs p-2">
              {stepIds[index] || `Step ${index + 1}`}
            </div>
            {selectedIndex === index && (
              <div className="absolute top-2 end-2 bg-primary-600 text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {index + 1}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 bg-foreground/90 z-50 flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="relative max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-4 end-4 z-10 bg-card rounded-full p-2 hover:bg-muted transition-colors"
              aria-label={t('results.screenshot.close')}
            >
              <FiX className="h-6 w-6 text-foreground" />
            </button>

            {/* Navigation Buttons */}
            {screenshots.length > 1 && (
              <>
                <button
                  onClick={prevScreenshot}
                  className="absolute start-4 top-1/2 -translate-y-1/2 z-10 bg-card rounded-full p-3 hover:bg-muted transition-colors"
                  aria-label={t('results.screenshot.previous')}
                >
                  <FiChevronLeft className="h-6 w-6 text-foreground rtl:scale-x-[-1]" />
                </button>
                <button
                  onClick={nextScreenshot}
                  className="absolute end-4 top-1/2 -translate-y-1/2 z-10 bg-card rounded-full p-3 hover:bg-muted transition-colors"
                  aria-label={t('results.screenshot.next')}
                >
                  <FiChevronRight className="h-6 w-6 text-foreground rtl:scale-x-[-1]" />
                </button>
              </>
            )}

            {/* Screenshot */}
            <img
              src={getScreenshotUrl(currentScreenshot)}
              alt={t('results.screenshot.altImage', { index: selectedIndex + 1 })}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />

            {/* Info Bar */}
            <div className="absolute bottom-4 start-4 end-4 bg-foreground/75 text-background rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{currentStepId}</p>
                <p className="text-sm text-muted-foreground">
                  {t('results.screenshot.indexOfTotal', { current: selectedIndex + 1, total: screenshots.length })}
                </p>
              </div>
              <button
                onClick={() => downloadScreenshot(getScreenshotUrl(currentScreenshot), `screenshot-${selectedIndex + 1}.png`)}
                className="flex items-center gap-2 px-4 py-2 bg-card text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <FiDownload className="h-4 w-4" />
                <span className="text-sm font-medium">{t('results.screenshot.download')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thumbnail Navigation */}
      {screenshots.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {screenshots.map((_, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`w-2 h-2 rounded-full transition-opacity ${
                selectedIndex === index
                  ? 'bg-primary-600 w-8'
                  : 'bg-muted-foreground hover:bg-foreground'
              }`}
              aria-label={t('results.screenshot.goTo', { index: index + 1 })}
            />
          ))}
        </div>
      )}
    </>
  );
};





























