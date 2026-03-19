import React from 'react';
import { Handle, Position } from 'reactflow';
import { FiActivity } from 'react-icons/fi';
import type { NodeProps } from 'reactflow';

interface TestStepNodeData {
  label: string;
  action?: string;
  description?: string;
}

export const TestStepNode: React.FC<NodeProps<TestStepNodeData>> = ({ data }) => {
  return (
    <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 border-l-4 border-l-gray-400 min-w-[200px] max-w-[240px] transition-all duration-200 hover:shadow-md">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !border-2 !border-white !bg-slate-500"
      />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1 bg-slate-900 rounded-lg flex-shrink-0">
            <FiActivity className="h-3 w-3 text-slate-400" />
          </div>
          {data.action && (
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-medium text-slate-400 uppercase">
              {data.action}
            </span>
          )}
        </div>
        <div className="font-medium text-slate-200 text-xs leading-snug line-clamp-2">
          {data.label}
        </div>
        {data.description && data.description !== data.label && (
          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {data.description}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !border-2 !border-white !bg-slate-500"
      />
    </div>
  );
};
