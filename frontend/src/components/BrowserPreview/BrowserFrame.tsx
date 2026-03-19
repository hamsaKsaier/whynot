import React from 'react';
import { FiLoader } from 'react-icons/fi';

interface BrowserFrameProps {
  imageUrl?: string;
  isLoading?: boolean;
  error?: string;
  url?: string;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  imageUrl,
  isLoading = false,
  error,
  url,
}) => {
  return (
    <div className="flex-1 bg-slate-800 flex items-center justify-center overflow-auto p-4">
      {isLoading && !imageUrl && (
        <div className="flex flex-col items-center justify-center space-y-4">
          <FiLoader className="h-8 w-8 text-slate-500 animate-spin" />
          <p className="text-sm text-slate-400">Connecting to browser stream...</p>
          {url && (
            <p className="text-xs text-slate-500">URL: {url}</p>
          )}
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center space-y-4 p-8">
          <div className="text-red-500 text-lg">⚠️</div>
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <p className="text-xs text-slate-400 mt-2">
            Check browser console for more details. Make sure WebSocket server is running.
          </p>
        </div>
      )}

      {!isLoading && !error && imageUrl && (
        <div className="relative max-w-full">
          <img
            src={imageUrl}
            alt="Browser preview"
            className="max-w-full h-auto rounded-lg shadow-lg border border-slate-600"
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          />
          {isLoading && (
            <div className="absolute inset-0 bg-slate-800 bg-opacity-50 flex items-center justify-center rounded-lg">
              <FiLoader className="h-6 w-6 text-slate-500 animate-spin" />
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && !imageUrl && (
        <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center">
          <div className="text-slate-500 text-4xl">🌐</div>
          <p className="text-sm text-slate-400">
            Waiting for browser frames...
          </p>
          {url && (
            <p className="text-xs text-slate-500 mt-2">
              URL: {url}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Frames will appear here once WebSocket connection is established and test execution begins
          </p>
        </div>
      )}
    </div>
  );
};

