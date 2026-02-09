import type { ApiResponse } from '@/types/api';
import type { ProjectMember, ProjectRole } from '@/types/member';
import { api } from './index';

export const membersApi = {
  list(projectId: string) {
    return api.get<ApiResponse<ProjectMember[]>>(`/projects/${projectId}/members`);
  },

  assign(projectId: string, data: { userId: string; role: ProjectRole; reportsToUserId?: string }) {
    return api.post<ApiResponse<ProjectMember>>(`/projects/${projectId}/members`, data);
  },

  remove(projectId: string, userId: string) {
    return api.del(`/projects/${projectId}/members/${userId}`);
  },
};
