'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/types/task';

interface BoardColumnProps {
  status: TaskStatus;
  children: React.ReactNode;
}

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

const statusColors: Record<TaskStatus, string> = {
  todo: 'border-t-slate-400',
  in_progress: 'border-t-blue-500',
  done: 'border-t-green-500',
};

export function BoardColumn({ status, children }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-80 shrink-0 bg-muted/50 rounded-lg border-t-4',
        statusColors[status],
        isOver && 'bg-muted'
      )}
    >
      <div className="p-3 font-semibold text-sm">{statusLabels[status]}</div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]">{children}</div>
    </div>
  );
}
