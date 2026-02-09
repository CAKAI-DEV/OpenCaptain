import { KanbanBoard } from '@/components/board/kanban-board';
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog';
import { apiClient } from '@/lib/api.server';
import type { PaginatedResponse } from '@/types/api';
import type { Task } from '@/types/task';

export default async function BoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  let tasks: Task[] = [];
  try {
    const response = await apiClient<PaginatedResponse<Task>>(
      `/tasks?projectId=${projectId}&limit=100&parentTaskId=null`
    );
    tasks = response.data;
  } catch {
    // Will show empty board
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Board</h1>
        <CreateTaskDialog projectId={projectId} />
      </div>
      <div className="flex-1 -mx-6 -mb-6">
        <KanbanBoard initialTasks={tasks} />
      </div>
    </div>
  );
}
