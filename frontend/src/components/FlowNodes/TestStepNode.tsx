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
    <div className="bg-card rounded-xl shadow-sm border border-border border-s-4 border-s-gray-400 min-w-[200px] max-w-[240px] transition-colors duration-150 hover:bg-muted/50">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !border-2 !border-white !bg-muted-foreground"
      />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1 bg-muted rounded-lg flex-shrink-0">
            <FiActivity className="h-3 w-3 text-muted-foreground" />
          </div>
          {data.action && (
            <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono font-medium text-muted-foreground uppercase">
              {data.action}
            </span>
          )}
        </div>
        <div className="font-medium text-foreground text-xs leading-snug line-clamp-2">
          {data.label}
        </div>
        {data.description && data.description !== data.label && (
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
            {data.description}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !border-2 !border-white !bg-muted-foreground"
      />
    </div>
  );
};
