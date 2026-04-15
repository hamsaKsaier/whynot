import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  const { t } = useTranslation('runner');
  const sortedSteps = Array.from(frameHistory.keys()).sort((a, b) => a - b);
  const currentStepFrames = currentStepIndex !== null ? frameHistory.get(currentStepIndex) || [] : [];
  const canGoPrev = currentStepIndex !== null && (currentFrameIndex > 0 || sortedSteps.indexOf(currentStepIndex) > 0);
  const canGoNext = currentStepIndex !== null && (
    currentFrameIndex < currentStepFrames.length - 1 ||
    sortedSteps.indexOf(currentStepIndex) < sortedSteps.length - 1
  );

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

  const handleSliderChange = (value: number[]) => {
    const v = value[0];
    if (currentStepIndex === null) return;
    let frameCount = 0;
    for (const stepIdx of sortedSteps) {
      const stepFrames = frameHistory.get(stepIdx)!;
      if (frameCount + stepFrames.length > v) {
        const frameIndex = v - frameCount;
        onGoToStep(stepIdx);
        if (onFrameIndexChange) {
          onFrameIndexChange(stepIdx, frameIndex);
        }
        return;
      }
      frameCount += stepFrames.length;
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="bg-card border-b border-border px-3 py-1.5 flex items-center justify-between gap-3">
        {/* Navigation Controls */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onGoToFirstFrame} disabled={!canGoPrev}>
                <SkipBack className="h-3.5 w-3.5 rtl:scale-x-[-1]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('runner.browser.firstFrame')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onGoToPrevFrame} disabled={!canGoPrev}>
                <ChevronLeft className="h-3.5 w-3.5 rtl:scale-x-[-1]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('runner.browser.previousFrame')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onGoToNextFrame} disabled={!canGoNext}>
                <ChevronRight className="h-3.5 w-3.5 rtl:scale-x-[-1]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('runner.browser.nextFrame')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onGoToLastFrame} disabled={!canGoNext}>
                <SkipForward className="h-3.5 w-3.5 rtl:scale-x-[-1]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('runner.browser.lastFrame')}</TooltipContent>
          </Tooltip>
        </div>

        {/* Step Selector */}
        {sortedSteps.length > 0 && (
          <Select
            value={currentStepIndex?.toString() ?? ''}
            onValueChange={(v) => {
              const stepIndex = parseInt(v, 10);
              if (!isNaN(stepIndex)) onGoToStep(stepIndex);
            }}
          >
            <SelectTrigger className="h-7 w-[160px] text-xs">
              <SelectValue placeholder={t('runner.browser.selectStep')} />
            </SelectTrigger>
            <SelectContent>
              {sortedSteps.map((stepIdx) => (
                <SelectItem key={stepIdx} value={stepIdx.toString()} className="text-xs">
                  {t('runner.browser.stepWithFrames', { step: stepIdx + 1, frames: frameHistory.get(stepIdx)?.length || 0 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Frame Counter */}
        <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
          {framePosition.total > 0 ? (
            <>
              {t('runner.browser.frameOf', { current: getTimelineValue() + 1, total: framePosition.total })}
              {framePosition.step > 0 && (
                <span className="text-muted-foreground/60 ms-1.5">
                  ({t('runner.browser.stepFrame', { step: framePosition.step, frame: framePosition.frame })})
                </span>
              )}
            </>
          ) : (
            t('runner.browser.noFrames')
          )}
        </span>

        {/* Timeline Scrubber */}
        {totalFrames > 0 && (
          <div className="flex-1 max-w-xs">
            <Slider
              min={0}
              max={totalFrames - 1}
              step={1}
              value={[getTimelineValue()]}
              onValueChange={handleSliderChange}
              className="w-full"
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
