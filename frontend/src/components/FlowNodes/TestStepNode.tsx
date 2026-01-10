import React from 'react';
import { Handle, Position } from 'reactflow';
import { FiCircle } from 'react-icons/fi';
import type { NodeProps } from 'reactflow';

interface TestStepNodeData {
  label: string;
  action?: string;
  description?: string;
}

export const TestStepNode: React.FC<NodeProps<TestStepNodeData>> = ({ data }) => {
  return (
    <div className="px-3 py-2 bg-gray-100 border-2 border-gray-300 rounded-lg shadow-sm min-w-[180px]">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        <FiCircle className="h-4 w-4 text-gray-600" />
        <div className="font-medium text-gray-900 text-sm">{data.label}</div>
      </div>
      {data.action && (
        <div className="text-xs text-gray-600 mt-1 font-mono">{data.action}</div>
      )}
      {data.description && (
        <div className="text-xs text-gray-700 mt-1 line-clamp-2">{data.description}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};








