'use client';

import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import type { Task, TaskPriority, TaskStatus, UpdateTaskInput } from '@/types/task';

interface TaskRowProps {
  task: Task;
  onStatusChange: (taskId: string, changes: UpdateTaskInput) => void;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export function TaskRow({ task, onStatusChange }: TaskRowProps) {
  const handleStatusChange = (newStatus: TaskStatus) => {
    onStatusChange(task.id, { status: newStatus });
  };

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'done';

  return (
    <TableRow>
      <TableCell className="font-medium">{task.title}</TableCell>
      <TableCell>
        <Select value={task.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={PRIORITY_STYLES[task.priority]}>
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </Badge>
      </TableCell>
      <TableCell>
        {dueDate ? (
          <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : ''}`}>
            <CalendarIcon className="h-4 w-4" />
            <span>{format(dueDate, 'MMM d, yyyy')}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {task.assigneeId ? (
          <span className="text-sm">{task.assigneeId.slice(0, 8)}...</span>
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        )}
      </TableCell>
    </TableRow>
  );
}
