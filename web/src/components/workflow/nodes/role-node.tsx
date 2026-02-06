'use client';

import type { Node } from '@xyflow/react';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoleNodeData } from '@/lib/workflow/types';

type RoleNodeType = Node<RoleNodeData, 'role'>;

export function RoleNode({ data, selected }: NodeProps<RoleNodeType>) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm min-w-[180px]',
        selected && 'ring-2 ring-primary'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-purple-100 text-purple-600">
          <Shield className="h-4 w-4" />
        </div>
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Role:</span>
          <span className="font-medium">{data.roleName || 'Not set'}</span>
        </div>
        <div className="flex justify-between">
          <span>Tier:</span>
          <span className="font-medium">{data.tier}</span>
        </div>
        <div className="flex justify-between">
          <span>Capabilities:</span>
          <span className="font-medium">{data.capabilities.length}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
}
