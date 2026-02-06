import { KanbanBoard } from '@/components/board/kanban-board';
import { apiClient } from '@/lib/api.server';
import type { PaginatedResponse } from '@/types/api';
import type { Task } from '@/types/task';

export default async function BoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  // Fetch all top-level tasks for the project
  const response = await apiClient<PaginatedResponse<Task>>(
    `/tasks?projectId=${projectId}&limit=100&parentTaskId=null`
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Board</h1>
        {/* TODO: Add create task button */}
      </div>
      <div className="flex-1 -mx-6 -mb-6">
        <KanbanBoard initialTasks={response.data} />
      </div>
    </div>
  );
}
