'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PaginatedResponse } from '@/types/api';
import type { Task } from '@/types/task';

interface UseTasksOptions {
  projectId: string;
  status?: Task['status'];
  assigneeId?: string;
  squadId?: string;
}

export function useTasks({ projectId, status, assigneeId, squadId }: UseTasksOptions) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        projectId,
        limit: '100', // Get all for board view
        parentTaskId: 'null', // Only top-level tasks
      });
      if (status) params.set('status', status);
      if (assigneeId) params.set('assigneeId', assigneeId);
      if (squadId) params.set('squadId', squadId);

      const response = await fetch(`/api/v1/tasks?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch tasks');

      const data: PaginatedResponse<Task> = await response.json();
      setTasks(data.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [projectId, status, assigneeId, squadId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, error, refetch: fetchTasks, setTasks };
}
