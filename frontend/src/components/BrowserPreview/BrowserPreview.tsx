import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrowserControls } from './BrowserControls';
import { BrowserFrame } from './BrowserFrame';
import { FrameNavigation } from './FrameNavigation';

interface BrowserFrame {
  imageUrl: string;
  timestamp: number;
  url?: string;
  stepIndex?: number;
  format?: 'png' | 'jpeg';
}

interface BrowserPreviewProps {
  imageUrl?: string;
  url?: string;
  isLoading?: boolean;
  error?: string;
  onNavigate?: (direction: 'back' | 'forward' | 'refresh' | 'home') => void;
  frameHistory?: Map<number, BrowserFrame[]>;
  currentStepIndex?: number | null;
  currentFrameIndex?: number;
  onGoToStep?: (stepIndex: number) => void;
  onGoToNextFrame?: () => void;
  onGoToPrevFrame?: () => void;
  onGoToFirstFrame?: () => void;
  onGoToLastFrame?: () => void;
  getTotalFrames?: () => number;
  getCurrentFramePosition?: () => { step: number; frame: number; total: number; stepIndex?: number };
}

export const BrowserPreview: React.FC<BrowserPreviewProps> = ({
  imageUrl,
  url,
  isLoading = false,
  error,
  onNavigate,
  frameHistory = new Map(),
  currentStepIndex = null,
  currentFrameIndex = 0,
  onGoToStep,
  onGoToNextFrame,
  onGoToPrevFrame,
  onGoToFirstFrame,
  onGoToLastFrame,
  getTotalFrames,
  getCurrentFramePosition,
}) => {
  const [zoom, setZoom] = useState(100);
  const [browser, setBrowser] = useState('Chrome');
  const [resolution, setResolution] = useState('1920x1080');
  const [isTransitioning, setIsTransitioning] = useState(false);

  React.useEffect(() => {
    if (imageUrl) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 200);
      return () => clearTimeout(timer);
    }
  }, [imageUrl]);

  const totalFrames = getTotalFrames ? getTotalFrames() : 0;
  const framePosition = getCurrentFramePosition ? getCurrentFramePosition() : { step: 0, frame: 0, total: 0 };

  const hasNavigation = frameHistory.size > 0 &&
    onGoToStep &&
    onGoToNextFrame &&
    onGoToPrevFrame &&
    onGoToFirstFrame &&
    onGoToLastFrame;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="p-0">
        <BrowserControls
          url={url}
          onNavigate={onNavigate}
          onZoomChange={setZoom}
          onBrowserChange={setBrowser}
          onResolutionChange={setResolution}
          currentZoom={zoom}
          currentBrowser={browser}
          currentResolution={resolution}
        />
      </CardHeader>

      {hasNavigation && (
        <FrameNavigation
          currentStepIndex={currentStepIndex}
          currentFrameIndex={currentFrameIndex}
          frameHistory={frameHistory}
          totalFrames={totalFrames}
          framePosition={framePosition}
          onGoToStep={onGoToStep}
          onGoToNextFrame={onGoToNextFrame}
          onGoToPrevFrame={onGoToPrevFrame}
          onGoToFirstFrame={onGoToFirstFrame}
          onGoToLastFrame={onGoToLastFrame}
        />
      )}

      <CardContent className="flex-1 overflow-hidden relative p-0" style={{ zoom: `${zoom}%` }}>
        <div
          className={`absolute inset-0 transition-opacity duration-150 ${
            isTransitioning ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <BrowserFrame
            imageUrl={imageUrl}
            isLoading={isLoading}
            error={error}
            url={url}
          />
        </div>
      </CardContent>

      <CardFooter className="px-3 py-1.5 border-t border-border justify-between">
        <Badge variant={isLoading ? 'default' : error ? 'destructive' : 'secondary'} className="text-[10px]">
          {isLoading ? 'Streaming' : error ? 'Error' : imageUrl ? 'Connected' : 'Idle'}
        </Badge>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {resolution} &middot; {browser}
        </span>
      </CardFooter>
    </Card>
  );
};
