import type { ApiResponse } from '@/types/api';
import type { Blocker, EscalationBlock } from '@/types/escalation';
import { api } from './index';

export const escalationsApi = {
  listBlocks(projectId: string) {
    return api.get<ApiResponse<EscalationBlock[]>>(
      `/escalations/projects/${projectId}/escalation-blocks`
    );
  },

  createBlock(
    projectId: string,
    data: {
      name: string;
      triggerType: string;
      escalationSteps: EscalationBlock['escalationSteps'];
      description?: string;
      enabled?: boolean;
    }
  ) {
    return api.post<ApiResponse<EscalationBlock>>(
      `/escalations/projects/${projectId}/escalation-blocks`,
      data
    );
  },

  updateBlock(projectId: string, blockId: string, data: Partial<EscalationBlock>) {
    return api.patch<ApiResponse<EscalationBlock>>(
      `/escalations/projects/${projectId}/escalation-blocks/${blockId}`,
      data
    );
  },

  deleteBlock(projectId: string, blockId: string) {
    return api.del(`/escalations/projects/${projectId}/escalation-blocks/${blockId}`);
  },

  listBlockers(projectId: string, status?: string) {
    const search = status ? `?status=${status}` : '';
    return api.get<ApiResponse<Blocker[]>>(`/escalations/projects/${projectId}/blockers${search}`);
  },

  reportBlocker(projectId: string, data: { taskId?: string; description: string }) {
    return api.post<ApiResponse<Blocker>>(`/escalations/projects/${projectId}/blockers`, data);
  },

  resolveBlocker(projectId: string, blockerId: string, resolutionNote?: string) {
    return api.post<ApiResponse<Blocker>>(
      `/escalations/projects/${projectId}/blockers/${blockerId}/resolve`,
      { resolutionNote }
    );
  },
};
