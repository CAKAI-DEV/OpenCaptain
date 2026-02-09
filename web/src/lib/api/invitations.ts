import type { ApiResponse } from '@/types/api';
import { api } from './index';

export const invitationsApi = {
  sendEmail(email: string, role?: string) {
    return api.post<ApiResponse<{ id: string }>>('/invitations', { email, role });
  },

  createLink(role?: string) {
    return api.post<ApiResponse<{ token: string; url: string }>>('/invitations/links', { role });
  },

  accept(token: string) {
    return api.post<ApiResponse<{ success: true; orgId: string }>>('/invitations/accept', {
      token,
    });
  },
};
