import { z } from 'zod';

export const notificationTypes = [
  'mention', // @mentioned in comment
  'comment', // Comment on assigned item
  'assignment', // Assigned to task/deliverable
  'status_change', // Status changed on assigned item
  'due_soon', // Upcoming deadline
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export interface NotificationJobData {
  type: NotificationType;
  userId: string;
  actorId: string | null; // null for system notifications
  targetType: 'task' | 'deliverable';
  targetId: string;
  projectId: string;
  commentId?: string;
  extra?: Record<string, unknown>;
}

export interface NotificationResult {
  id: string;
  userId: string;
  type: NotificationType;
  actorId: string | null;
  actorEmail?: string;
  targetType: 'task' | 'deliverable';
  targetId: string;
  targetTitle?: string;
  projectId: string;
  projectName?: string;
  commentId: string | null;
  read: boolean;
  createdAt: Date;
}

export const listNotificationsSchema = z.object({
  unreadOnly: z.coerce.boolean().default(false),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;
