import React from 'react';
import { Handle, Position } from 'reactflow';
import { FiBook, FiGlobe } from 'react-icons/fi';
import type { NodeProps } from 'reactflow';
import { parseUserStoryLabel } from '../../utils/parseUserStoryLabel';

interface UserStoryNodeData {
  label: string;
  story?: string;
  website_url?: string;
}

export const UserStoryNode: React.FC<NodeProps<UserStoryNodeData>> = ({ data }) => {
  const { story: parsedStory, url: parsedUrl } = parseUserStoryLabel(data.label);
  const displayUrl = data.website_url || parsedUrl;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-green-500 min-w-[240px] max-w-[280px] transition-all duration-200 hover:shadow-md">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !border-2 !border-white !bg-green-500"
      />
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-1.5 bg-green-50 rounded-lg flex-shrink-0">
            <FiBook className="h-3.5 w-3.5 text-green-600" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600">
            User Story
          </span>
        </div>
        <div className="text-sm text-gray-800 leading-snug line-clamp-3">
          {parsedStory}
        </div>
        {displayUrl && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
            <FiGlobe className="h-3 w-3 text-gray-400 flex-shrink-0" />
            <span className="text-[11px] text-green-600 truncate">
              {displayUrl}
            </span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !border-2 !border-white !bg-green-500"
      />
    </div>
  );
};
