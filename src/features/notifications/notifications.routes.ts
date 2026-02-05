import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { ApiError } from '../../shared/middleware/error-handler';
import { authMiddleware } from '../auth/auth.middleware';
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

export default app;
