import type { ApiResponse, PaginatedResponse } from '@/types/api';
import type { Comment } from '@/types/comment';
import type { CreateTaskInput, Task, UpdateTaskInput } from '@/types/task';
import { api } from './index';

export const tasksApi = {
  list(params: {
    projectId: string;
    status?: string;
    assigneeId?: string;
    squadId?: string;
    parentTaskId?: string;
    page?: number;
    limit?: number;
  }) {
    const search = new URLSearchParams();
    search.set('projectId', params.projectId);
    if (params.status) search.set('status', params.status);
    if (params.assigneeId) search.set('assigneeId', params.assigneeId);
    if (params.squadId) search.set('squadId', params.squadId);
    if (params.parentTaskId) search.set('parentTaskId', params.parentTaskId);
    search.set('page', String(params.page || 1));
    search.set('limit', String(params.limit || 100));
    return api.get<PaginatedResponse<Task>>(`/tasks?${search}`);
  },

  get(taskId: string) {
    return api.get<ApiResponse<Task>>(`/tasks/${taskId}`);
  },

  create(data: CreateTaskInput) {
    return api.post<ApiResponse<Task>>('/tasks', data);
  },

  update(taskId: string, data: UpdateTaskInput) {
    return api.patch<ApiResponse<Task>>(`/tasks/${taskId}`, data);
  },

  delete(taskId: string) {
    return api.del(`/tasks/${taskId}`);
  },

  // Comments
  getComments(taskId: string) {
    return api.get<ApiResponse<Comment[]>>(`/comments?targetType=task&targetId=${taskId}`);
  },

  addComment(taskId: string, content: string) {
    return api.post<ApiResponse<Comment>>('/comments', {
      targetType: 'task',
      targetId: taskId,
      content,
    });
  },
};
