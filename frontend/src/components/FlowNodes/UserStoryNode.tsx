import React from 'react';
import { Handle, Position } from 'reactflow';
import { FiBook } from 'react-icons/fi';
import type { NodeProps } from 'reactflow';

interface UserStoryNodeData {
  label: string;
  story?: string;
  website_url?: string;
}

export const UserStoryNode: React.FC<NodeProps<UserStoryNodeData>> = ({ data }) => {
  return (
    <div className="px-4 py-3 bg-green-100 border-2 border-green-300 rounded-lg shadow-md min-w-[200px]">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        <FiBook className="h-5 w-5 text-green-600" />
        <div className="font-semibold text-green-900">User Story</div>
      </div>
      <div className="text-sm text-green-800 mt-1 line-clamp-3">{data.label}</div>
      {data.website_url && (
        <div className="text-xs text-green-600 mt-1 truncate">{data.website_url}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};








