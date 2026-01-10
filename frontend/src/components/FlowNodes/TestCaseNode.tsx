import React from 'react';
import { Handle, Position } from 'reactflow';
import { FiFileText, FiChevronDown, FiChevronRight, FiPlay } from 'react-icons/fi';
import type { NodeProps } from 'reactflow';

interface TestCaseNodeData {
  label: string;
  description?: string;
  stepCount?: number;
  testCaseId: string;
  isExpanded?: boolean;
  isRunning?: boolean;
  onToggleExpand?: (testCaseId: string) => void;
  onRun?: (testCaseId: string) => void;
}

export const TestCaseNode: React.FC<NodeProps<TestCaseNodeData>> = ({ data }) => {
  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onToggleExpand?.(data.testCaseId);
  };

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.isRunning) {
      data.onRun?.(data.testCaseId);
    }
  };

  return (
    <div 
      className="px-4 py-3 bg-purple-100 border-2 border-purple-300 rounded-lg shadow-md min-w-[200px] cursor-pointer hover:border-purple-400 transition-colors"
      onClick={handleToggleExpand}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        {data.stepCount && data.stepCount > 0 ? (
          <button
            onClick={handleToggleExpand}
            className="p-0.5 hover:bg-purple-200 rounded transition-colors"
            title={data.isExpanded ? 'Collapse steps' : 'Expand steps'}
          >
            {data.isExpanded ? (
              <FiChevronDown className="h-4 w-4 text-purple-600" />
            ) : (
              <FiChevronRight className="h-4 w-4 text-purple-600" />
            )}
          </button>
        ) : null}
        <FiFileText className="h-5 w-5 text-purple-600" />
        <div className="font-semibold text-purple-900 flex-1 truncate">{data.label}</div>
        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className={`p-1.5 rounded transition-colors ${
            data.isRunning 
              ? 'bg-purple-200 cursor-not-allowed' 
              : 'hover:bg-purple-200 hover:scale-110'
          }`}
          title={data.isRunning ? 'Test running...' : 'Run test case'}
        >
          <FiPlay className={`h-4 w-4 ${data.isRunning ? 'text-purple-400 animate-pulse' : 'text-purple-600'}`} />
        </button>
      </div>
      {data.description && (
        <div className="text-xs text-purple-700 mt-1 line-clamp-2">{data.description}</div>
      )}
      {data.stepCount !== undefined && (
        <div className="text-xs text-purple-600 mt-1">
          {data.stepCount} steps {data.isExpanded ? '(expanded)' : '(click to expand)'}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};








