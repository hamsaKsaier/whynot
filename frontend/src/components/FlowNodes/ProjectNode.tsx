import React from 'react';
import { Handle, Position } from 'reactflow';
import { FiFolder } from 'react-icons/fi';
import type { NodeProps } from 'reactflow';

interface ProjectNodeData {
  label: string;
  description?: string;
  website_url?: string;
}

export const ProjectNode: React.FC<NodeProps<ProjectNodeData>> = ({ data }) => {
  return (
    <div className="px-4 py-3 bg-blue-100 border-2 border-blue-300 rounded-lg shadow-md min-w-[200px]">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        <FiFolder className="h-5 w-5 text-blue-600" />
        <div className="font-semibold text-blue-900">{data.label}</div>
      </div>
      {data.description && (
        <div className="text-xs text-blue-700 mt-1 line-clamp-2">{data.description}</div>
      )}
      {data.website_url && (
        <div className="text-xs text-blue-600 mt-1 truncate">{data.website_url}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};








