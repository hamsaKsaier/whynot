import React from 'react';
import { Handle, Position } from 'reactflow';
import { FiPackage } from 'react-icons/fi';
import type { NodeProps } from 'reactflow';

interface TestSuiteNodeData {
  label: string;
  description?: string;
}

export const TestSuiteNode: React.FC<NodeProps<TestSuiteNodeData>> = ({ data }) => {
  return (
    <div className="px-4 py-3 bg-orange-100 border-2 border-orange-300 rounded-lg shadow-md min-w-[200px]">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        <FiPackage className="h-5 w-5 text-orange-600" />
        <div className="font-semibold text-orange-900">{data.label}</div>
      </div>
      {data.description && (
        <div className="text-xs text-orange-700 mt-1 line-clamp-2">{data.description}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};








