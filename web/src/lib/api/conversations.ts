import type { ApiResponse } from '@/types/api';
import type { Conversation, Message } from '@/types/conversation';
import { api } from './index';

export const conversationsApi = {
  list(params?: { limit?: number; offset?: number }) {
    const search = new URLSearchParams();
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.offset) search.set('offset', String(params.offset));
    return api.get<ApiResponse<Conversation[]>>(`/conversations?${search}`);
  },

  get(conversationId: string) {
    return api.get<ApiResponse<Conversation>>(`/conversations/${conversationId}`);
  },

  create(data?: { projectId?: string; title?: string }) {
    return api.post<ApiResponse<{ id: string }>>('/conversations', data || {});
  },

  sendMessage(conversationId: string, content: string) {
    return api.post<ApiResponse<{ message: Message }>>(
      `/conversations/${conversationId}/messages`,
      { content }
    );
  },
};
