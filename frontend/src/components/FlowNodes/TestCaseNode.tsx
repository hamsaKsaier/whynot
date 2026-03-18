import React from 'react';
import { Handle, Position } from 'reactflow';
import { FiFileText, FiChevronDown, FiChevronRight, FiPlay, FiLoader } from 'react-icons/fi';
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
      className="bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500 min-w-[240px] max-w-[280px] cursor-pointer transition-all duration-200 hover:shadow-md"
      onClick={handleToggleExpand}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !border-2 !border-white !bg-purple-500"
      />
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-1.5 bg-purple-50 rounded-lg flex-shrink-0">
            <FiFileText className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">
            Test Case
          </span>
          <div className="ml-auto flex items-center gap-1">
            {data.stepCount != null && data.stepCount > 0 && (
              <button
                onClick={handleToggleExpand}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                title={data.isExpanded ? 'Collapse steps' : 'Expand steps'}
              >
                {data.isExpanded ? (
                  <FiChevronDown className="h-3.5 w-3.5 text-gray-500" />
                ) : (
                  <FiChevronRight className="h-3.5 w-3.5 text-gray-500" />
                )}
              </button>
            )}
            <button
              onClick={handleRun}
              disabled={data.isRunning}
              className={`p-1 rounded-lg transition-all ${
                data.isRunning
                  ? 'bg-purple-100 cursor-not-allowed'
                  : 'hover:bg-purple-50 hover:scale-110'
              }`}
              title={data.isRunning ? 'Running...' : 'Run test'}
            >
              {data.isRunning ? (
                <FiLoader className="h-3.5 w-3.5 text-purple-400 animate-spin" />
              ) : (
                <FiPlay className="h-3.5 w-3.5 text-purple-600" />
              )}
            </button>
          </div>
        </div>
        <div className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">
          {data.label}
        </div>
        {data.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
            {data.description}
          </p>
        )}
        {data.stepCount != null && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-purple-50 text-[10px] font-medium text-purple-700">
              {data.stepCount} {data.stepCount === 1 ? 'step' : 'steps'}
            </span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !border-2 !border-white !bg-purple-500"
      />
    </div>
  );
};
