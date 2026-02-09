'use client';

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useCallback, useState } from 'react';
import { TaskDetailSheet } from '@/components/tasks/task-detail-sheet';
import type { Task, TaskStatus } from '@/types/task';
import { BoardColumn } from './board-column';
import { BoardTaskCard } from './board-task-card';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done'];

interface KanbanBoardProps {
  initialTasks: Task[];
}

export function KanbanBoard({ initialTasks }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));

    try {
      const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update task');
    } catch (error) {
      console.error('Task update failed:', error);
      // Revert - refetch would be better but this is simpler
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: t.status } : t)));
    }
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = () => {};

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    if (COLUMNS.includes(overId as TaskStatus)) {
      const newStatus = overId as TaskStatus;
      const task = tasks.find((t) => t.id === taskId);

      if (task && task.status !== newStatus) {
        updateTaskStatus(taskId, newStatus);
      }
    }
  };

  const handleTaskClick = (task: Task) => {
    if (!activeTask) {
      setSelectedTask(task);
      setSheetOpen(true);
    }
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    setSelectedTask(updatedTask);
  };

  const _handleTaskCreated = (newTask: Task) => {
    setTasks((prev) => [...prev, newTask]);
  };

  const getTasksByStatus = (status: TaskStatus) => tasks.filter((task) => task.status === status);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full overflow-x-auto p-4">
          {COLUMNS.map((status) => {
            const columnTasks = getTasksByStatus(status);
            return (
              <BoardColumn key={status} status={status}>
                <SortableContext
                  items={columnTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {columnTasks.map((task) => (
                    <BoardTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => handleTaskClick(task)}
                    />
                  ))}
                </SortableContext>
                {columnTasks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">No tasks</div>
                )}
              </BoardColumn>
            );
          })}
        </div>

        <DragOverlay>{activeTask && <BoardTaskCard task={activeTask} isDragging />}</DragOverlay>
      </DndContext>

      <TaskDetailSheet
        task={selectedTask}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onTaskUpdate={handleTaskUpdate}
      />
    </>
  );
}
