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
  onResolutionChange,
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
    <div className="bg-slate-900 border-b border-slate-700">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        {/* Navigation Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onNavigate?.('back')}
            className="p-1.5 rounded hover:bg-slate-700 transition-colors"
            title="Back"
          >
            <FiChevronLeft className="h-4 w-4 text-slate-400" />
          </button>
          <button
            onClick={() => onNavigate?.('forward')}
            className="p-1.5 rounded hover:bg-slate-700 transition-colors"
            title="Forward"
          >
            <FiChevronRight className="h-4 w-4 text-slate-400" />
          </button>
          <button
            onClick={() => onNavigate?.('refresh')}
            className="p-1.5 rounded hover:bg-slate-700 transition-colors"
            title="Refresh"
          >
            <FiRefreshCw className="h-4 w-4 text-slate-400" />
          </button>
          <button
            onClick={() => onNavigate?.('home')}
            className="p-1.5 rounded hover:bg-slate-700 transition-colors"
            title="Home"
          >
            <FiHome className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* URL Bar */}
        <div className="flex-1 mx-4">
          <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 flex items-center">
            <div className="flex-1 text-sm text-slate-200 truncate">
              {url || 'about:blank'}
            </div>
            <div className="ml-2 flex items-center space-x-1">
              <div className="h-3 w-3 rounded-full bg-green-500" title="Secure connection"></div>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">{currentZoom}%</span>
          <button
            onClick={() => onZoomChange?.(Math.max(25, currentZoom - 25))}
            className="p-1.5 rounded hover:bg-slate-700 transition-colors"
            title="Zoom out"
          >
            <FiZoomOut className="h-4 w-4 text-slate-400" />
          </button>
          <button
            onClick={() => onZoomChange?.(Math.min(200, currentZoom + 25))}
            className="p-1.5 rounded hover:bg-slate-700 transition-colors"
            title="Zoom in"
          >
            <FiZoomIn className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Browser Settings Bar */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-3">
          {/* Browser Selector */}
          <div className="flex items-center space-x-2">
            <label className="text-xs text-slate-400">Browser:</label>
            <select
              value={currentBrowser}
              onChange={(e) => onBrowserChange?.(e.target.value)}
              className="text-xs border border-slate-600 rounded px-2 py-1 bg-slate-800"
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
            <label className="text-xs text-slate-400">Resolution:</label>
            <select
              value={currentResolution}
              onChange={(e) => onResolutionChange?.(e.target.value)}
              className="text-xs border border-slate-600 rounded px-2 py-1 bg-slate-800"
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
            className="p-1.5 rounded hover:bg-slate-700 transition-colors"
            title="Dark mode"
          >
            <FiMoon className="h-4 w-4 text-slate-400" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-slate-700 transition-colors"
            title="Screenshot"
          >
            <FiCamera className="h-4 w-4 text-slate-400" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-2 py-1 text-xs border border-slate-600 rounded hover:bg-slate-700 transition-colors flex items-center space-x-1"
          >
            <FiSettings className="h-3 w-3" />
            <span>Advanced Settings</span>
          </button>
        </div>
      </div>

      {/* Advanced Settings Panel */}
      {showSettings && (
        <div className="px-4 py-3 bg-slate-800 border-t border-slate-700">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Location:</label>
              <select className="w-full border border-slate-600 rounded px-2 py-1 bg-slate-800">
                <option>London, UK</option>
                <option>New York, US</option>
                <option>Tokyo, Japan</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Network:</label>
              <select className="w-full border border-slate-600 rounded px-2 py-1 bg-slate-800">
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

























