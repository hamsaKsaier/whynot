import React, { useState } from 'react';
import { 
  FiChevronLeft, 
  FiChevronRight, 
  FiRefreshCw, 
  FiHome,
  FiZoomIn,
  FiZoomOut,
  FiSettings,
  FiMoon,
  FiCamera
} from 'react-icons/fi';

interface BrowserControlsProps {
  url?: string;
  onNavigate?: (direction: 'back' | 'forward' | 'refresh' | 'home') => void;
  onZoomChange?: (zoom: number) => void;
  onBrowserChange?: (browser: string) => void;
  onResolutionChange?: (resolution: string) => void;
  currentZoom?: number;
  currentBrowser?: string;
  currentResolution?: string;
}

export const BrowserControls: React.FC<BrowserControlsProps> = ({
  url = '',
  onNavigate,
  onZoomChange,
  onBrowserChange,
  currentBrowser = 'Chrome',
  currentResolution = '1920x1080',
  currentZoom = 100,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
  const resolutions = [
    '1920x1080',
    '1366x768',
    '1536x864',
    '1440x900',
    '1280x720',
  ];

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
        {/* Navigation Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onNavigate?.('back')}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="Back"
          >
            <FiChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => onNavigate?.('forward')}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="Forward"
          >
            <FiChevronRight className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => onNavigate?.('refresh')}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => onNavigate?.('home')}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="Home"
          >
            <FiHome className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* URL Bar */}
        <div className="flex-1 mx-4">
          <div className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 flex items-center">
            <div className="flex-1 text-sm text-gray-700 truncate">
              {url || 'about:blank'}
            </div>
            <div className="ml-2 flex items-center space-x-1">
              <div className="h-3 w-3 rounded-full bg-green-500" title="Secure connection"></div>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-600">{currentZoom}%</span>
          <button
            onClick={() => onZoomChange?.(Math.max(25, currentZoom - 25))}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="Zoom out"
          >
            <FiZoomOut className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => onZoomChange?.(Math.min(200, currentZoom + 25))}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="Zoom in"
          >
            <FiZoomIn className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Browser Settings Bar */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-3">
          {/* Browser Selector */}
          <div className="flex items-center space-x-2">
            <label className="text-xs text-gray-600">Browser:</label>
            <select
              value={currentBrowser}
              onChange={(e) => onBrowserChange?.(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
            >
              {browsers.map((browser) => (
                <option key={browser} value={browser}>
                  {browser}
                </option>
              ))}
            </select>
          </div>

          {/* Resolution Selector */}
          <div className="flex items-center space-x-2">
            <label className="text-xs text-gray-600">Resolution:</label>
            <select
              value={currentResolution}
              onChange={(e) => onResolutionChange?.(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
            >
              {resolutions.map((res) => (
                <option key={res} value={res}>
                  {res}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Additional Controls */}
        <div className="flex items-center space-x-2">
          <button
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="Dark mode"
          >
            <FiMoon className="h-4 w-4 text-gray-600" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="Screenshot"
          >
            <FiCamera className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-200 transition-colors flex items-center space-x-1"
          >
            <FiSettings className="h-3 w-3" />
            <span>Advanced Settings</span>
          </button>
        </div>
      </div>

      {/* Advanced Settings Panel */}
      {showSettings && (
        <div className="px-4 py-3 bg-white border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-gray-600 mb-1">Location:</label>
              <select className="w-full border border-gray-300 rounded px-2 py-1 bg-white">
                <option>London, UK</option>
                <option>New York, US</option>
                <option>Tokyo, Japan</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Network:</label>
              <select className="w-full border border-gray-300 rounded px-2 py-1 bg-white">
                <option>No throttling</option>
                <option>3G</option>
                <option>4G</option>
                <option>WiFi</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};









