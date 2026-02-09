import type { ApiResponse } from '@/types/api';
import type { Notification } from '@/types/notification';
import { api } from './index';

export const notificationsApi = {
  list(params?: { unreadOnly?: boolean; limit?: number; offset?: number }) {
    const search = new URLSearchParams();
    if (params?.unreadOnly) search.set('unreadOnly', 'true');
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.offset) search.set('offset', String(params.offset));
    return api.get<ApiResponse<Notification[]>>(`/notifications?${search}`);
  },

  unreadCount() {
    return api.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
  },

  markAsRead(notificationId: string) {
    return api.patch<ApiResponse<{ read: true }>>(`/notifications/${notificationId}/read`, {});
  },

  markAllAsRead() {
    return api.post<ApiResponse<{ markedRead: number }>>('/notifications/read-all');
  },
};
