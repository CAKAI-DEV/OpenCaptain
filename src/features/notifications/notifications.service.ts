import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { notificationQueue } from '../../shared/lib/queue/client';
import type {
  NotificationJobData,
  NotificationResult,
  StandardNotificationJobData,
} from './notifications.types';

/**
 * Queue a notification for processing
 */
export async function queueNotification(data: NotificationJobData): Promise<void> {
  await notificationQueue.add('notification', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
  logger.info({ type: data.type, userId: data.userId }, 'Notification queued');
}

/**
 * Store notification in database (for standard notifications only)
 */
export async function storeNotification(data: StandardNotificationJobData): Promise<string> {
  const [notification] = await db
    .insert(schema.notifications)
    .values({
      userId: data.userId,
      type: data.type,
      actorId: data.actorId,
      targetType: data.targetType,
      targetId: data.targetId,
      projectId: data.projectId,
      commentId: data.commentId ?? null,
      read: false,
    })
    .returning({ id: schema.notifications.id });

  if (!notification) {
    throw new Error('Failed to store notification');
  }

  return notification.id;
}

/**
 * Get user's notifications with pagination
 */
export async function getUserNotifications(
  userId: string,
  unreadOnly = false,
  limit = 50,
  offset = 0
): Promise<NotificationResult[]> {
  // Use raw SQL for complex join
  const result = await db.execute<{
    id: string;
    user_id: string;
    type: string;
    actor_id: string | null;
    actor_email: string | null;
    target_type: string;
    target_id: string;
    target_title: string | null;
    project_id: string;
    project_name: string | null;
    comment_id: string | null;
    read: boolean;
    created_at: Date;
  }>(sql`
    SELECT
      n.id,
      n.user_id,
      n.type,
      n.actor_id,
      u.email as actor_email,
      n.target_type,
      n.target_id,
      COALESCE(t.title, d.title) as target_title,
      n.project_id,
      p.name as project_name,
      n.comment_id,
      n.read,
      n.created_at
    FROM notifications n
    LEFT JOIN users u ON n.actor_id = u.id
    LEFT JOIN tasks t ON n.target_type = 'task' AND n.target_id = t.id
    LEFT JOIN deliverables d ON n.target_type = 'deliverable' AND n.target_id = d.id
    LEFT JOIN projects p ON n.project_id = p.id
    WHERE n.user_id = ${userId}
    ${unreadOnly ? sql`AND n.read = false` : sql``}
    ORDER BY n.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  return (result as unknown as Array<typeof result extends Array<infer T> ? T : never>).map(
    (r) => ({
      id: r.id,
      userId: r.user_id,
      type: r.type as NotificationResult['type'],
      actorId: r.actor_id,
      actorEmail: r.actor_email ?? undefined,
      targetType: r.target_type as 'task' | 'deliverable',
      targetId: r.target_id,
      targetTitle: r.target_title ?? undefined,
      projectId: r.project_id,
      projectName: r.project_name ?? undefined,
      commentId: r.comment_id,
      read: r.read,
      createdAt: r.created_at,
    })
  );
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.read, false)));

  return Number(result?.count ?? 0);
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .update(schema.notifications)
    .set({ read: true })
    .where(
      and(eq(schema.notifications.id, notificationId), eq(schema.notifications.userId, userId))
    )
    .returning({ id: schema.notifications.id });

  return result.length > 0;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllRead(userId: string): Promise<number> {
  const result = await db
    .update(schema.notifications)
    .set({ read: true })
    .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.read, false)))
    .returning({ id: schema.notifications.id });

  return result.length;
}
