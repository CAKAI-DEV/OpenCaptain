'use client';

import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOptimisticTasks } from '@/hooks/use-optimistic-tasks';
import type { Task } from '@/types/task';
import { TaskRow } from './task-row';

interface TaskListProps {
  initialTasks: Task[];
}

export function TaskList({ initialTasks }: TaskListProps) {
  const { tasks, updateTask } = useOptimisticTasks(initialTasks);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No tasks found</p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your filters or create a new task
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Title</TableHead>
            <TableHead className="w-[15%]">Status</TableHead>
            <TableHead className="w-[12%]">Priority</TableHead>
            <TableHead className="w-[18%]">Due Date</TableHead>
            <TableHead className="w-[15%]">Assignee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onStatusChange={updateTask} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
