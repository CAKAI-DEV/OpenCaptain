'use client';

import type { Node } from '@xyflow/react';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CheckInNodeData } from '@/lib/workflow/types';

type CheckInNodeType = Node<CheckInNodeData, 'checkIn'>;

export function CheckInNode({ data, selected }: NodeProps<CheckInNodeType>) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm min-w-[180px]',
        selected && 'ring-2 ring-primary'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-blue-100 text-blue-600">
          <Clock className="h-4 w-4" />
        </div>
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Frequency:</span>
          <span className="font-medium capitalize">{data.frequency}</span>
        </div>
        <div className="flex justify-between">
          <span>Time:</span>
          <span className="font-medium">{data.time}</span>
        </div>
        {data.squadName && (
          <div className="flex justify-between">
            <span>Squad:</span>
            <span className="font-medium truncate max-w-[100px]">{data.squadName}</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
}
