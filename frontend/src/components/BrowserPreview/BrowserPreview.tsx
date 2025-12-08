import React, { useState } from 'react';
import { BrowserControls } from './BrowserControls';
import { BrowserFrame } from './BrowserFrame';

interface BrowserPreviewProps {
  imageUrl?: string;
  url?: string;
  isLoading?: boolean;
  error?: string;
  onNavigate?: (direction: 'back' | 'forward' | 'refresh' | 'home') => void;
}

export const BrowserPreview: React.FC<BrowserPreviewProps> = ({
  imageUrl,
  url,
  isLoading = false,
  error,
  onNavigate,
}) => {
  const [zoom, setZoom] = useState(100);
  const [browser, setBrowser] = useState('Chrome');
  const [resolution, setResolution] = useState('1920x1080');

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Browser Controls */}
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

      {/* Browser Frame */}
      <div className="flex-1 overflow-hidden" style={{ zoom: `${zoom}%` }}>
        <BrowserFrame
          imageUrl={imageUrl}
          isLoading={isLoading}
          error={error}
          url={url}
        />
      </div>
    </div>
  );
};









