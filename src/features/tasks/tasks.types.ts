import type { tasks } from '../../shared/db/schema/tasks';

/**
 * Input for creating a new task
 */
export interface CreateTaskInput {
  projectId: string;
  squadId?: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assigneeId?: string;
  dueDate?: Date;
  customFieldValues?: Record<string, unknown>;
}

/**
 * Input for updating an existing task
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'todo' | 'in_progress' | 'done';
  assigneeId?: string | null;
  dueDate?: Date | null;
  squadId?: string | null;
  customFieldValues?: Record<string, unknown>;
}

/**
 * Task result from database queries
 */
export type TaskResult = typeof tasks.$inferSelect;

/**
 * Task with its subtasks (one level deep)
 */
export interface TaskWithSubtasks extends TaskResult {
  subtasks: TaskResult[];
}

/**
 * Filters for listing tasks
 */
export interface TaskFilters {
  squadId?: string;
  assigneeId?: string;
  status?: 'todo' | 'in_progress' | 'done';
  parentTaskId?: string | null; // null = top-level tasks only
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
