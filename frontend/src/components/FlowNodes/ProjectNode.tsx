import React from 'react';
import { Handle, Position } from 'reactflow';
import { FiGlobe } from 'react-icons/fi';
import type { NodeProps } from 'reactflow';

interface ProjectNodeData {
  label: string;
  description?: string;
  website_url?: string;
}

export const ProjectNode: React.FC<NodeProps<ProjectNodeData>> = ({ data }) => {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border border-s-4 border-s-sky-500 min-w-[240px] max-w-[280px] transition-colors duration-150 hover:bg-muted/50">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !border-2 !border-white !bg-sky-900/200"
      />
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-1.5 bg-sky-900/20 rounded-lg flex-shrink-0">
            <FiGlobe className="h-3.5 w-3.5 text-sky-600" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-600">
            Project
          </span>
        </div>
        <div className="font-bold text-foreground text-sm leading-snug">
          {data.label}
        </div>
        {data.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {data.description}
          </p>
        )}
        {data.website_url && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
            <FiGlobe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-[11px] text-sky-600 truncate">
              {data.website_url}
            </span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !border-2 !border-white !bg-sky-900/200"
      />
    </div>
  );
};
