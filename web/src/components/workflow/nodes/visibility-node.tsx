'use client';

import type { Node } from '@xyflow/react';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VisibilityNodeData } from '@/lib/workflow/types';

type VisibilityNodeType = Node<VisibilityNodeData, 'visibility'>;

const SCOPE_LABELS: Record<string, string> = {
  project: 'Project-wide',
  squad: 'Squad-only',
  custom: 'Custom',
};

export function VisibilityNode({ data, selected }: NodeProps<VisibilityNodeType>) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm min-w-[180px]',
        selected && 'ring-2 ring-primary'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-green-100 text-green-600">
          <Eye className="h-4 w-4" />
        </div>
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Scope:</span>
          <span className="font-medium">{SCOPE_LABELS[data.scope] || data.scope}</span>
        </div>
        {data.grants.length > 0 && (
          <div className="flex justify-between">
            <span>Grants:</span>
            <span className="font-medium">{data.grants.length} squads</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
}
