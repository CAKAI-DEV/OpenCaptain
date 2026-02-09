import type { Squad, SquadMember } from '@/types/squad';
import { api } from './index';

export const squadsApi = {
  list(projectId: string) {
    return api.get<Squad[]>(`/projects/${projectId}/squads`);
  },

  get(squadId: string) {
    return api.get<Squad>(`/squads/${squadId}`);
  },

  create(data: { projectId: string; name: string; parentSquadId?: string; leadUserId?: string }) {
    return api.post<Squad>('/squads', data);
  },

  update(squadId: string, data: { name?: string; leadUserId?: string | null }) {
    return api.patch<Squad>(`/squads/${squadId}`, data);
  },

  delete(squadId: string) {
    return api.del(`/squads/${squadId}`);
  },

  listMembers(squadId: string) {
    return api.get<SquadMember[]>(`/squads/${squadId}/members`);
  },

  addMember(squadId: string, userId: string) {
    return api.post<SquadMember>(`/squads/${squadId}/members`, { userId });
  },

  removeMember(squadId: string, userId: string) {
    return api.del(`/squads/${squadId}/members/${userId}`);
  },
};
