'use client';

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
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
import { useState } from 'react';
import { useOptimisticTasks } from '@/hooks/use-optimistic-tasks';
import type { Task, TaskStatus } from '@/types/task';
import { BoardColumn } from './board-column';
import { BoardTaskCard } from './board-task-card';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done'];

interface KanbanBoardProps {
  initialTasks: Task[];
}

export function KanbanBoard({ initialTasks }: KanbanBoardProps) {
  const { tasks, updateTask, isPending } = useOptimisticTasks(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Handle drag over columns for visual feedback
    // The actual status change happens on dragEnd
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    if (COLUMNS.includes(overId as TaskStatus)) {
      const newStatus = overId as TaskStatus;
      const task = tasks.find((t) => t.id === taskId);

      if (task && task.status !== newStatus) {
        updateTask(taskId, { status: newStatus });
      }
    }
  };

  const getTasksByStatus = (status: TaskStatus) => tasks.filter((task) => task.status === status);

  return (
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
                  <BoardTaskCard key={task.id} task={task} />
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
  );
}
