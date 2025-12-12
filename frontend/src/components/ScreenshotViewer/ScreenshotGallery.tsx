import React, { useState } from 'react';
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
            className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
              selectedIndex === index
                ? 'border-primary-500 ring-2 ring-primary-200'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => {
              setSelectedIndex(index);
              setIsLightboxOpen(true);
            }}
          >
            <img
              src={getScreenshotUrl(screenshot)}
              alt={`Screenshot ${index + 1}`}
              className="w-full h-32 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not found%3C/text%3E%3C/svg%3E';
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2">
              {stepIds[index] || `Step ${index + 1}`}
            </div>
            {selectedIndex === index && (
              <div className="absolute top-2 right-2 bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {index + 1}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="relative max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <FiX className="h-6 w-6 text-gray-900" />
            </button>

            {/* Navigation Buttons */}
            {screenshots.length > 1 && (
              <>
                <button
                  onClick={prevScreenshot}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-3 hover:bg-gray-100 transition-colors"
                  aria-label="Previous"
                >
                  <FiChevronLeft className="h-6 w-6 text-gray-900" />
                </button>
                <button
                  onClick={nextScreenshot}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-3 hover:bg-gray-100 transition-colors"
                  aria-label="Next"
                >
                  <FiChevronRight className="h-6 w-6 text-gray-900" />
                </button>
              </>
            )}

            {/* Screenshot */}
            <img
              src={getScreenshotUrl(currentScreenshot)}
              alt={`Screenshot ${selectedIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />

            {/* Info Bar */}
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-75 text-white rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{currentStepId}</p>
                <p className="text-sm text-gray-300">
                  {selectedIndex + 1} of {screenshots.length}
                </p>
              </div>
              <button
                onClick={() => downloadScreenshot(getScreenshotUrl(currentScreenshot), `screenshot-${selectedIndex + 1}.png`)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <FiDownload className="h-4 w-4" />
                <span className="text-sm font-medium">Download</span>
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
              className={`w-2 h-2 rounded-full transition-all ${
                selectedIndex === index
                  ? 'bg-primary-600 w-8'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to screenshot ${index + 1}`}
            />
          ))}
        </div>
      )}
    </>
  );
};


















