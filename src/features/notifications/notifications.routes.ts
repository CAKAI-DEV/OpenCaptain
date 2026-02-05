import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../../shared/middleware/error-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { buildVisibilityContext } from '../visibility/visibility.service';
import { getActivityFeed, getUserActivityFeed } from './activity-feed.service';
import {
  getUnreadCount,
  getUserNotifications,
  markAllRead,
  markNotificationRead,
} from './notifications.service';
import { listNotificationsSchema } from './notifications.types';

const app = new Hono();

app.use('*', authMiddleware);

// Get user's notifications
app.get('/', zValidator('query', listNotificationsSchema), async (c) => {
  const user = c.get('user');
  const { unreadOnly, limit, offset } = c.req.valid('query');

  const notifications = await getUserNotifications(user.sub, unreadOnly, limit, offset);

  return c.json({ data: notifications });
});

// Get unread count
app.get('/unread-count', async (c) => {
  const user = c.get('user');
  const count = await getUnreadCount(user.sub);
  return c.json({ data: { count } });
});

// Mark notification as read
app.patch('/:id/read', async (c) => {
  const notificationId = c.req.param('id');
  const user = c.get('user');

  const success = await markNotificationRead(notificationId, user.sub);
  if (!success) {
    throw new ApiError(
      404,
      'notifications/not-found',
      'Notification Not Found',
      'The specified notification does not exist or does not belong to you'
    );
  }

  return c.json({ data: { read: true } });
});

// Mark all as read
app.post('/read-all', async (c) => {
  const user = c.get('user');
  const count = await markAllRead(user.sub);
  return c.json({ data: { markedRead: count } });
});

// Activity feed query schema
const activityQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// Get activity feed across all visible projects
app.get('/activity', zValidator('query', activityQuerySchema), async (c) => {
  const user = c.get('user');
  const { limit, offset } = c.req.valid('query');

  // Build visibility context to get visible project IDs
  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  const visibleProjectIds = visibilityContext.visibleProjectIds;

  const feed = await getUserActivityFeed(visibleProjectIds, limit, offset);
  return c.json({ data: feed });
});

// Get activity feed for a specific project
app.get('/activity/project/:projectId', zValidator('query', activityQuerySchema), async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');
  const { limit, offset } = c.req.valid('query');

  // Build visibility context and verify project access
  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  const visibleProjectIds = visibilityContext.visibleProjectIds;

  if (!visibleProjectIds.includes(projectId)) {
    throw new ApiError(
      403,
      'notifications/access-denied',
      'Access Denied',
      'You do not have access to this project'
    );
  }

  const feed = await getActivityFeed(projectId, limit, offset);
  return c.json({ data: feed });
});

export default app;
