'use client';

import { useCallback, useOptimistic, useTransition } from 'react';
import type { Task, UpdateTaskInput } from '@/types/task';

type OptimisticAction = {
  type: 'update';
  taskId: string;
  changes: Partial<Task>;
};

export function useOptimisticTasks(initialTasks: Task[]) {
  const [isPending, startTransition] = useTransition();

  const [optimisticTasks, addOptimisticUpdate] = useOptimistic(
    initialTasks,
    (state: Task[], action: OptimisticAction) => {
      switch (action.type) {
        case 'update':
          return state.map((task) =>
            task.id === action.taskId ? { ...task, ...action.changes } : task
          );
        default:
          return state;
      }
    }
  );

  const updateTask = useCallback(
    async (taskId: string, changes: UpdateTaskInput) => {
      startTransition(async () => {
        // Optimistically update UI
        addOptimisticUpdate({ type: 'update', taskId, changes });

        try {
          const response = await fetch(`/api/v1/tasks/${taskId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(changes),
          });

          if (!response.ok) {
            throw new Error('Failed to update task');
          }

          // On success, the optimistic state becomes permanent
          // React will reconcile when transition completes
        } catch (error) {
          // On error, React will revert to the original state
          // because the transition didn't complete successfully
          console.error('Task update failed:', error);
          // Optionally show a toast notification
        }
      });
    },
    [addOptimisticUpdate]
  );

  return {
    tasks: optimisticTasks,
    updateTask,
    isPending,
  };
}
