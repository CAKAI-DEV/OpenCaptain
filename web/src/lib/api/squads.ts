import type { ApiResponse } from '@/types/api';
import type { Squad, SquadMember } from '@/types/squad';
import { api } from './index';

export const squadsApi = {
  list(projectId: string) {
    return api.get<ApiResponse<Squad[]>>(`/projects/${projectId}/squads`);
  },

  get(squadId: string) {
    return api.get<ApiResponse<Squad>>(`/squads/${squadId}`);
  },

  create(data: { projectId: string; name: string; parentSquadId?: string; leadUserId?: string }) {
    return api.post<ApiResponse<Squad>>('/squads', data);
  },

  update(squadId: string, data: { name?: string; leadUserId?: string | null }) {
    return api.patch<ApiResponse<Squad>>(`/squads/${squadId}`, data);
  },

  delete(squadId: string) {
    return api.del(`/squads/${squadId}`);
  },

  listMembers(squadId: string) {
    return api.get<ApiResponse<SquadMember[]>>(`/squads/${squadId}/members`);
  },

  addMember(squadId: string, userId: string) {
    return api.post<ApiResponse<SquadMember>>(`/squads/${squadId}/members`, { userId });
  },

  removeMember(squadId: string, userId: string) {
    return api.del(`/squads/${squadId}/members/${userId}`);
  },
};
