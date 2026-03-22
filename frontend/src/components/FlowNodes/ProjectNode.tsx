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
    <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 border-l-4 border-l-sky-500 min-w-[240px] max-w-[280px] transition-all duration-200 hover:shadow-md">
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
        <div className="font-bold text-white text-sm leading-snug">
          {data.label}
        </div>
        {data.description && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {data.description}
          </p>
        )}
        {data.website_url && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-700">
            <FiGlobe className="h-3 w-3 text-slate-500 flex-shrink-0" />
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
