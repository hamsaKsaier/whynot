import React from 'react';
import { Handle, Position } from 'reactflow';
import { FiFolder, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import type { NodeProps } from 'reactflow';

interface FolderNodeData {
  label: string;
  folderId: string;
  color?: string;
  userStoryCount?: number;
  isExpanded?: boolean;
  onToggleExpand?: (folderId: string) => void;
}

export const FolderNode: React.FC<NodeProps<FolderNodeData>> = ({ data }) => {
  const folderColor = data.color || '#0284c7';

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onToggleExpand?.(data.folderId);
  };

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-[220px] max-w-[260px] cursor-pointer transition-all duration-200 hover:shadow-md"
      style={{ borderLeftWidth: '4px', borderLeftColor: folderColor }}
      onClick={handleToggleExpand}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ backgroundColor: folderColor }}
        className="!w-2.5 !h-2.5 !border-2 !border-white"
      />
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className="p-1.5 rounded-lg flex-shrink-0"
            style={{ backgroundColor: `${folderColor}15` }}
          >
            <FiFolder className="h-3.5 w-3.5" style={{ color: folderColor }} />
          </div>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: folderColor }}
          >
            Folder
          </span>
          {data.userStoryCount != null && data.userStoryCount > 0 && (
            <button
              onClick={handleToggleExpand}
              className="ml-auto p-0.5 rounded hover:bg-gray-100 transition-colors"
              title={data.isExpanded ? 'Collapse folder' : 'Expand folder'}
            >
              {data.isExpanded ? (
                <FiChevronDown className="h-3.5 w-3.5 text-gray-500" />
              ) : (
                <FiChevronRight className="h-3.5 w-3.5 text-gray-500" />
              )}
            </button>
          )}
        </div>
        <div className="font-bold text-gray-900 text-sm leading-snug">
          {data.label}
        </div>
        {data.userStoryCount != null && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                backgroundColor: `${folderColor}15`,
                color: folderColor,
              }}
            >
              {data.userStoryCount} {data.userStoryCount === 1 ? 'story' : 'stories'}
            </span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ backgroundColor: folderColor }}
        className="!w-2.5 !h-2.5 !border-2 !border-white"
      />
    </div>
  );
};
