import { Suspense } from 'react';
import { TaskFilters } from '@/components/list/task-filters';
import { TaskList } from '@/components/list/task-list';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
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
  // Build query params for API
  const params = new URLSearchParams({
    projectId,
    limit: '100',
    parentTaskId: 'null',
  });

  if (status) params.set('status', status);
  // Note: priority and search filtering handled client-side
  // Backend doesn't support these filters yet

  const response = await apiClient<PaginatedResponse<Task>>(`/tasks?${params.toString()}`);

  // Apply client-side filtering for priority and search
  let tasks = response.data;

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

  // Validate status if provided
  const validStatus =
    status && ['todo', 'in_progress', 'done'].includes(status) ? (status as TaskStatus) : undefined;

  // Validate priority if provided
  const validPriority =
    priority && ['low', 'medium', 'high', 'urgent'].includes(priority)
      ? (priority as TaskPriority)
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        {/* TODO: Add create task button */}
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
