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
  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onToggleExpand?.(data.folderId);
  };

  // Use provided color or default
  const folderColor = data.color || '#6366f1';

  // Generate color classes based on the color prop
  const getBgColor = () => {
    // Simple mapping for common colors, fallback to inline style
    return 'bg-indigo-50';
  };

  return (
    <div
      className="px-4 py-3 rounded-lg shadow-md min-w-[200px] cursor-pointer hover:shadow-lg transition-all"
      style={{
        backgroundColor: `${folderColor}20`,
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: `${folderColor}60`
      }}
      onClick={handleToggleExpand}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        {data.userStoryCount && data.userStoryCount > 0 ? (
          <button
            onClick={handleToggleExpand}
            className="p-0.5 rounded transition-colors"
            style={{ backgroundColor: `${folderColor}30` }}
            title={data.isExpanded ? 'Collapse folder' : 'Expand folder'}
          >
            {data.isExpanded ? (
              <FiChevronDown className="h-4 w-4" style={{ color: folderColor }} />
            ) : (
              <FiChevronRight className="h-4 w-4" style={{ color: folderColor }} />
            )}
          </button>
        ) : null}
        <FiFolder className="h-5 w-5" style={{ color: folderColor }} />
        <div className="font-semibold text-gray-900 flex-1">{data.label}</div>
      </div>
      {data.userStoryCount !== undefined && (
        <div className="text-xs mt-1" style={{ color: `${folderColor}` }}>
          {data.userStoryCount} user {data.userStoryCount === 1 ? 'story' : 'stories'}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};






