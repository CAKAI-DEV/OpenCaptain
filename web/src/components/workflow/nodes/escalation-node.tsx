'use client';

import { Handle, type NodeProps, Position } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EscalationNode as EscalationNodeType } from '@/lib/workflow/types';

const TRIGGER_LABELS: Record<string, string> = {
  missed_checkin: 'Missed Check-in',
  blocked_task: 'Blocked Task',
  overdue_task: 'Overdue Task',
};

export function EscalationNode({ data, selected }: NodeProps<EscalationNodeType>) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm min-w-[180px]',
        selected && 'ring-2 ring-primary'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-orange-100 text-orange-600">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Trigger:</span>
          <span className="font-medium">
            {TRIGGER_LABELS[data.triggerType] || data.triggerType}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Steps:</span>
          <span className="font-medium">{data.steps.length} configured</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
}
