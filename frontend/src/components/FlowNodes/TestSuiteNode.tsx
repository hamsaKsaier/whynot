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
    <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 border-l-4 border-l-orange-500 min-w-[220px] max-w-[260px] transition-all duration-200 hover:shadow-md">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !border-2 !border-white !bg-orange-500"
      />
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-1.5 bg-orange-900/20 rounded-lg flex-shrink-0">
            <FiPackage className="h-3.5 w-3.5 text-orange-600" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600">
            Test Suite
          </span>
        </div>
        <div className="font-bold text-white text-sm leading-snug truncate">
          {data.label}
        </div>
        {data.description && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {data.description}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !border-2 !border-white !bg-orange-500"
      />
    </div>
  );
};
