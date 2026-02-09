import type { ApiResponse } from '@/types/api';
import type { CreateDeliverableInput, Deliverable, DeliverableType } from '@/types/deliverable';
import { api } from './index';

export const deliverablesApi = {
  // Deliverable Types
  listTypes(projectId: string) {
    return api.get<ApiResponse<DeliverableType[]>>(`/deliverables/types?projectId=${projectId}`);
  },

  createType(data: {
    projectId: string;
    name: string;
    description?: string;
    icon?: string;
    config: DeliverableType['config'];
  }) {
    return api.post<ApiResponse<DeliverableType>>('/deliverables/types', data);
  },

  createTypeFromPreset(projectId: string, preset: string) {
    return api.post<ApiResponse<DeliverableType>>('/deliverables/types/from-preset', {
      projectId,
      preset,
    });
  },

  deleteType(typeId: string) {
    return api.del(`/deliverables/types/${typeId}`);
  },

  // Deliverables
  list(params: {
    projectId: string;
    squadId?: string;
    assigneeId?: string;
    status?: string;
    deliverableTypeId?: string;
  }) {
    const search = new URLSearchParams();
    search.set('projectId', params.projectId);
    if (params.squadId) search.set('squadId', params.squadId);
    if (params.assigneeId) search.set('assigneeId', params.assigneeId);
    if (params.status) search.set('status', params.status);
    if (params.deliverableTypeId) search.set('deliverableTypeId', params.deliverableTypeId);
    return api.get<ApiResponse<Deliverable[]>>(`/deliverables?${search}`);
  },

  get(deliverableId: string) {
    return api.get<ApiResponse<Deliverable>>(`/deliverables/${deliverableId}`);
  },

  create(data: CreateDeliverableInput) {
    return api.post<ApiResponse<Deliverable>>('/deliverables', data);
  },

  update(deliverableId: string, data: Partial<CreateDeliverableInput> & { status?: string }) {
    return api.patch<ApiResponse<Deliverable>>(`/deliverables/${deliverableId}`, data);
  },

  delete(deliverableId: string) {
    return api.del(`/deliverables/${deliverableId}`);
  },
};
