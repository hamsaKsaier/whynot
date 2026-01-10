import React from 'react';
import { FiChevronLeft, FiChevronRight, FiSkipBack, FiSkipForward } from 'react-icons/fi';

interface BrowserFrame {
  imageUrl: string;
  timestamp: number;
  url?: string;
  stepIndex?: number;
  format?: 'png' | 'jpeg';
}

interface FrameNavigationProps {
  currentStepIndex: number | null;
  currentFrameIndex: number;
  frameHistory: Map<number, BrowserFrame[]>;
  totalFrames: number;
  framePosition: { step: number; frame: number; total: number; stepIndex?: number };
  onGoToStep: (stepIndex: number) => void;
  onGoToNextFrame: () => void;
  onGoToPrevFrame: () => void;
  onGoToFirstFrame: () => void;
  onGoToLastFrame: () => void;
  onFrameIndexChange?: (stepIndex: number, frameIndex: number) => void;
}

export const FrameNavigation: React.FC<FrameNavigationProps> = ({
  currentStepIndex,
  currentFrameIndex,
  frameHistory,
  totalFrames,
  framePosition,
  onGoToStep,
  onGoToNextFrame,
  onGoToPrevFrame,
  onGoToFirstFrame,
  onGoToLastFrame,
  onFrameIndexChange,
}) => {
  const sortedSteps = Array.from(frameHistory.keys()).sort((a, b) => a - b);
  const currentStepFrames = currentStepIndex !== null ? frameHistory.get(currentStepIndex) || [] : [];
  const canGoPrev = currentStepIndex !== null && (currentFrameIndex > 0 || sortedSteps.indexOf(currentStepIndex) > 0);
  const canGoNext = currentStepIndex !== null && (
    currentFrameIndex < currentStepFrames.length - 1 || 
    sortedSteps.indexOf(currentStepIndex) < sortedSteps.length - 1
  );

  const handleStepSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stepIndex = parseInt(e.target.value, 10);
    if (!isNaN(stepIndex)) {
      onGoToStep(stepIndex);
    }
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && currentStepIndex !== null) {
      // Find which step this frame belongs to
      let frameCount = 0;
      for (const stepIdx of sortedSteps) {
        const stepFrames = frameHistory.get(stepIdx)!;
        if (frameCount + stepFrames.length > value) {
          const frameIndex = value - frameCount;
          onGoToStep(stepIdx);
          if (onFrameIndexChange) {
            onFrameIndexChange(stepIdx, frameIndex);
          }
          return;
        }
        frameCount += stepFrames.length;
      }
    }
  };

  const getTimelineValue = (): number => {
    if (currentStepIndex === null) return 0;
    let frameCount = 0;
    for (const stepIdx of sortedSteps) {
      if (stepIdx === currentStepIndex) {
        return frameCount + currentFrameIndex;
      }
      frameCount += frameHistory.get(stepIdx)!.length;
    }
    return 0;
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-4">
      {/* Navigation Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onGoToFirstFrame}
          disabled={!canGoPrev}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="First frame"
        >
          <FiSkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={onGoToPrevFrame}
          disabled={!canGoPrev}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Previous frame"
        >
          <FiChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onGoToNextFrame}
          disabled={!canGoNext}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Next frame"
        >
          <FiChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={onGoToLastFrame}
          disabled={!canGoNext}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Last frame"
        >
          <FiSkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Step Selector */}
      {sortedSteps.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">Step:</label>
          <select
            value={currentStepIndex ?? ''}
            onChange={handleStepSelect}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sortedSteps.map((stepIdx) => (
              <option key={stepIdx} value={stepIdx}>
                Step {stepIdx + 1} ({frameHistory.get(stepIdx)?.length || 0} frames)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Frame Counter */}
      <div className="text-sm text-gray-600 whitespace-nowrap">
        {framePosition.total > 0 ? (
          <>
            Frame {getTimelineValue() + 1} of {framePosition.total}
            {framePosition.step > 0 && (
              <span className="text-gray-400 ml-2">
                (Step {framePosition.step}, Frame {framePosition.frame})
              </span>
            )}
          </>
        ) : (
          'No frames'
        )}
      </div>

      {/* Timeline Scrubber */}
      {totalFrames > 0 && (
        <div className="flex-1 max-w-md">
          <input
            type="range"
            min="0"
            max={totalFrames - 1}
            value={getTimelineValue()}
            onChange={handleTimelineChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(getTimelineValue() / (totalFrames - 1)) * 100}%, #e5e7eb ${(getTimelineValue() / (totalFrames - 1)) * 100}%, #e5e7eb 100%)`
            }}
          />
        </div>
      )}
    </div>
  );
};


