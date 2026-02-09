'use client';

import { AlertTriangle, Clock, Eye, Shield } from 'lucide-react';
import type { DragEvent } from 'react';
import type { WorkflowNodeType } from '@/lib/workflow/types';

interface BlockDefinition {
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: typeof Clock;
  color: string;
}

const BLOCKS: BlockDefinition[] = [
  {
    type: 'checkIn',
    label: 'Check-in',
    description: 'Scheduled status updates',
    icon: Clock,
    color: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  },
  {
    type: 'escalation',
    label: 'Escalation',
    description: 'Automatic notifications',
    icon: AlertTriangle,
    color: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  },
  {
    type: 'role',
    label: 'Role',
    description: 'Team permissions',
    icon: Shield,
    color: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  },
  {
    type: 'visibility',
    label: 'Visibility',
    description: 'Access control',
    icon: Eye,
    color: 'bg-green-500/20 text-green-600 dark:text-green-400',
  },
];

export function WorkflowSidebar() {
  const onDragStart = (event: DragEvent, nodeType: WorkflowNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 border-r bg-card p-4">
      <h2 className="text-sm font-semibold mb-4">Block Palette</h2>
      <div className="space-y-2">
        {BLOCKS.map((block) => {
          const Icon = block.icon;
          return (
            <button
              key={block.type}
              type="button"
              draggable
              onDragStart={(e) => onDragStart(e, block.type)}
              className="w-full text-left flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted cursor-grab active:cursor-grabbing transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div className={`p-2 rounded ${block.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{block.label}</div>
                <div className="text-xs text-muted-foreground">{block.description}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-6 pt-4 border-t">
        <p className="text-xs text-muted-foreground">
          Drag blocks onto the canvas to configure your workflow.
        </p>
      </div>
    </div>
  );
}
