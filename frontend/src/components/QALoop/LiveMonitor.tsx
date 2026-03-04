/**
 * LiveMonitor — browser screenshot preview + AI thinking panel + tool-call feed
 * extracted from QALoopPage (5.1).
 */
import React from 'react';
import { Card } from '../common/Card';
import {
  FiImage,
  FiActivity,
  FiTerminal,
  FiMaximize2,
  FiMinimize2,
} from 'react-icons/fi';

export interface LiveMonitorProps {
  currentScreenshot: string | null;
  currentUrl: string | null;
  thinkingText: string;
  toolCalls: Array<{ tool: string; input: any; result?: any; timestamp: string }>;
  isRunning: boolean;
  showThinking: boolean;
  setShowThinking: (v: boolean) => void;
  showToolCalls: boolean;
  setShowToolCalls: (v: boolean) => void;
  expandedPreview: boolean;
  setExpandedPreview: (v: boolean) => void;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  currentScreenshot,
  currentUrl,
  thinkingText,
  toolCalls,
  isRunning,
  showThinking,
  setShowThinking,
  showToolCalls,
  setShowToolCalls,
  expandedPreview,
  setExpandedPreview,
}) => (
  <>
    {/* Browser preview + AI thinking side-by-side (collapses when preview is expanded) */}
    <div className={`grid gap-6 ${expandedPreview ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
      {/* Browser screenshot */}
      <Card className={`p-4 ${expandedPreview ? 'col-span-full' : ''}`}>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <FiImage className="text-blue-500" />
          Live Browser Preview
          <button
            onClick={() => setExpandedPreview(!expandedPreview)}
            className="ml-auto text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
            title={expandedPreview ? 'Minimize' : 'Maximize'}
          >
            {expandedPreview ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
          </button>
        </h3>
        <div className={`bg-gray-100 rounded-lg overflow-hidden ${expandedPreview ? 'h-96' : 'aspect-video'}`}>
          {currentScreenshot ? (
            <img
              src={currentScreenshot}
              alt="Browser preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
              {isRunning ? (
                <>
                  <FiActivity className="text-2xl mb-2 animate-pulse text-blue-500" />
                  <span className="text-sm">Preview will appear after the first page loads...</span>
                </>
              ) : (
                <>
                  <FiImage className="text-2xl mb-2 opacity-50" />
                  <span className="text-sm">No preview available</span>
                </>
              )}
            </div>
          )}
        </div>
        {currentUrl && (
          <div className="mt-2 text-xs text-gray-500 truncate">{currentUrl}</div>
        )}
      </Card>

      {/* AI thinking — hidden when preview is expanded */}
      {!expandedPreview && (
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FiTerminal className="text-green-500" />
            AI Thinking
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="ml-auto text-sm text-gray-500 hover:text-gray-700"
            >
              {showThinking ? 'Hide' : 'Show'}
            </button>
          </h3>
          {showThinking && (
            <div className="h-48 overflow-y-auto bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400">
              {thinkingText || 'Waiting for AI response...'}
            </div>
          )}
        </Card>
      )}
    </div>

    {/* Tool call feed */}
    <Card className="p-4">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <FiActivity className="text-purple-500" />
        Recent Tool Calls
        <button
          onClick={() => setShowToolCalls(!showToolCalls)}
          className="ml-auto text-sm text-gray-500 hover:text-gray-700"
        >
          {showToolCalls ? 'Hide' : 'Show'}
        </button>
      </h3>
      {showToolCalls && (
        <div className="max-h-48 overflow-y-auto space-y-2">
          {toolCalls.length === 0 ? (
            <div className="text-gray-500 text-sm">No tool calls yet</div>
          ) : (
            toolCalls.slice(-10).reverse().map((call, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                <span className="font-mono text-purple-600">{call.tool}</span>
                {call.result && <span className="text-green-500">✓</span>}
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  </>
);
