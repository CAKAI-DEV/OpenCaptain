import type { ApiResponse } from '@/types/api';
import type { CheckInBlock, CheckInTemplate } from '@/types/checkin';
import { api } from './index';

export const checkinsApi = {
  listTemplates() {
    return api.get<ApiResponse<CheckInTemplate[]>>('/check-ins/templates');
  },

  getTemplate(templateId: string) {
    return api.get<ApiResponse<CheckInTemplate>>(`/check-ins/templates/${templateId}`);
  },

  listBlocks(projectId: string) {
    return api.get<ApiResponse<CheckInBlock[]>>(`/check-ins/projects/${projectId}/check-in-blocks`);
  },

  createBlock(
    projectId: string,
    data: {
      name: string;
      templateId: string;
      cronExpression: string;
      timezone: string;
      targetSquadId?: string;
      enabled?: boolean;
    }
  ) {
    return api.post<ApiResponse<CheckInBlock>>(
      `/check-ins/projects/${projectId}/check-in-blocks`,
      data
    );
  },

  updateBlock(projectId: string, blockId: string, data: Partial<CheckInBlock>) {
    return api.patch<ApiResponse<CheckInBlock>>(
      `/check-ins/projects/${projectId}/check-in-blocks/${blockId}`,
      data
    );
  },

  deleteBlock(projectId: string, blockId: string) {
    return api.del(`/check-ins/projects/${projectId}/check-in-blocks/${blockId}`);
  },
};
