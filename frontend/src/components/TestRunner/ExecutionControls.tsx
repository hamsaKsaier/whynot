import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('runner');
  const speeds = [0.5, 1, 2, 5];

  return (
    <div className="bg-card border-b border-border px-3 py-2 sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Main Controls */}
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              onClick={onPlay}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-primary-600 text-primary-foreground rounded-md hover:bg-primary-700 transition-colors duration-150 text-sm"
            >
              <FiPlay className="h-4 w-4" />
              <span>{t('runner.runTest')}</span>
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={onPlay}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-primary-600 text-primary-foreground rounded-md hover:bg-primary-700 transition-colors duration-150 text-sm"
                >
                  <FiPlay className="h-4 w-4" />
                  <span>{t('runner.controls.resume')}</span>
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-muted text-foreground rounded-md hover:bg-accent transition-colors duration-150 text-sm"
                >
                  <FiPause className="h-4 w-4" />
                  <span>{t('runner.controls.pause')}</span>
                </button>
              )}
              <button
                onClick={onStop}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-red-600 text-foreground rounded-md hover:bg-red-700 transition-colors duration-150 text-sm"
              >
                <FiSquare className="h-4 w-4" />
                <span>{t('runner.controls.stop')}</span>
              </button>
            </>
          )}

          {/* Step Navigation */}
          {isRunning && (
            <>
              <div className="w-px h-6 bg-border hidden sm:block"></div>
              <button
                onClick={onPreviousStep}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-muted transition-colors duration-150"
                title={t('runner.controls.previousStep')}
              >
                <FiSkipBack className="h-4 w-4 text-muted-foreground rtl:scale-x-[-1]" />
              </button>
              <button
                onClick={onNextStep}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-muted transition-colors duration-150"
                title={t('runner.controls.nextStep')}
              >
                <FiSkipForward className="h-4 w-4 text-muted-foreground rtl:scale-x-[-1]" />
              </button>
            </>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Speed Control */}
          {isRunning && (
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">{t('runner.controls.speed')}:</label>
              <select
                value={currentSpeed}
                onChange={(e) => onSpeedChange?.(Number(e.target.value))}
                className="text-sm border border-border rounded-md px-2 py-1 min-h-[44px] bg-card"
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
          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">{t('runner.controls.headless')}:</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={headless}
                onChange={(e) => onHeadlessChange?.(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-input peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-foreground after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Settings */}
          <button
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-muted transition-colors duration-150"
            title={t('runner.controls.settings')}
          >
            <FiSettings className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

























