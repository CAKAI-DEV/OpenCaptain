import { Suspense } from 'react';
import { TaskFilters } from '@/components/list/task-filters';
import { TaskList } from '@/components/list/task-list';
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api.server';
import type { PaginatedResponse } from '@/types/api';
import type { Task, TaskPriority, TaskStatus } from '@/types/task';

interface ListPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    status?: string;
    priority?: string;
    search?: string;
  }>;
}

async function TaskListContainer({
  projectId,
  status,
  priority,
  search,
}: {
  projectId: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
}) {
  let tasks: Task[] = [];
  try {
    const params = new URLSearchParams({
      projectId,
      limit: '100',
      parentTaskId: 'null',
    });

    if (status) params.set('status', status);

    const response = await apiClient<PaginatedResponse<Task>>(`/tasks?${params.toString()}`);
    tasks = response.data;
  } catch {
    // Will show empty list
  }

  if (priority) {
    tasks = tasks.filter((task) => task.priority === priority);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    tasks = tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower)
    );
  }

  return <TaskList initialTasks={tasks} />;
}

export default async function ListPage({ params, searchParams }: ListPageProps) {
  const { projectId } = await params;
  const { status, priority, search } = await searchParams;

  const validStatus =
    status && ['todo', 'in_progress', 'done'].includes(status) ? (status as TaskStatus) : undefined;

  const validPriority =
    priority && ['low', 'medium', 'high', 'urgent'].includes(priority)
      ? (priority as TaskPriority)
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <CreateTaskDialog projectId={projectId} />
      </div>

      <Suspense fallback={<Skeleton className="h-10 w-full" />}>
        <TaskFilters />
      </Suspense>

      <Suspense
        fallback={
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        }
      >
        <TaskListContainer
          projectId={projectId}
          status={validStatus}
          priority={validPriority}
          search={search}
        />
      </Suspense>
    </div>
  );
}
