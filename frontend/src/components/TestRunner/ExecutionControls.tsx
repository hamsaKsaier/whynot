import React from 'react';
import { FiPlay, FiPause, FiSquare, FiSkipForward, FiSkipBack, FiSettings } from 'react-icons/fi';

interface ExecutionControlsProps {
  isRunning: boolean;
  isPaused?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onNextStep?: () => void;
  onPreviousStep?: () => void;
  onSpeedChange?: (speed: number) => void;
  currentSpeed?: number;
  headless: boolean;
  onHeadlessChange?: (headless: boolean) => void;
}

export const ExecutionControls: React.FC<ExecutionControlsProps> = ({
  isRunning,
  isPaused = false,
  onPlay,
  onPause,
  onStop,
  onNextStep,
  onPreviousStep,
  onSpeedChange,
  currentSpeed = 1,
  headless,
  onHeadlessChange,
}) => {
  const speeds = [0.5, 1, 2, 5];

  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center justify-between">
        {/* Main Controls */}
        <div className="flex items-center space-x-2">
          {!isRunning ? (
            <button
              onClick={onPlay}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <FiPlay className="h-4 w-4" />
              <span>Run Test</span>
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={onPlay}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <FiPlay className="h-4 w-4" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <FiPause className="h-4 w-4" />
                  <span>Pause</span>
                </button>
              )}
              <button
                onClick={onStop}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FiSquare className="h-4 w-4" />
                <span>Stop</span>
              </button>
            </>
          )}

          {/* Step Navigation */}
          {isRunning && (
            <>
              <div className="w-px h-6 bg-gray-300 mx-2"></div>
              <button
                onClick={onPreviousStep}
                className="p-2 rounded hover:bg-gray-100 transition-colors"
                title="Previous step"
              >
                <FiSkipBack className="h-4 w-4 text-gray-600" />
              </button>
              <button
                onClick={onNextStep}
                className="p-2 rounded hover:bg-gray-100 transition-colors"
                title="Next step"
              >
                <FiSkipForward className="h-4 w-4 text-gray-600" />
              </button>
            </>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-4">
          {/* Speed Control */}
          {isRunning && (
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Speed:</label>
              <select
                value={currentSpeed}
                onChange={(e) => onSpeedChange?.(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
              >
                {speeds.map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}x
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Headless Mode Toggle */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Headless:</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={headless}
                onChange={(e) => onHeadlessChange?.(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {/* Settings */}
          <button
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            title="Settings"
          >
            <FiSettings className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};














