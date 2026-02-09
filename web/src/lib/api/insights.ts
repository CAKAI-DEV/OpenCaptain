import type { ApiResponse } from '@/types/api';
import type { Insight, Suggestion } from '@/types/insight';
import { api } from './index';

export const insightsApi = {
  get(projectId: string, params?: { startDate?: string; endDate?: string }) {
    const search = new URLSearchParams();
    if (params?.startDate) search.set('startDate', params.startDate);
    if (params?.endDate) search.set('endDate', params.endDate);
    return api.get<ApiResponse<{ insights: Insight[] }>>(
      `/projects/${projectId}/insights?${search}`
    );
  },

  getSuggestions(projectId: string) {
    return api.get<ApiResponse<{ suggestions: Suggestion[] }>>(
      `/projects/${projectId}/insights/suggestions`
    );
  },

  generate(projectId: string, params?: { startDate?: string; endDate?: string }) {
    return api.post<ApiResponse<{ insights: Insight[] }>>(
      `/projects/${projectId}/insights/generate`,
      params
    );
  },
};
