import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../../shared/middleware/error-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { getDeliverable } from '../deliverables/deliverables.service';
import { getTask } from '../tasks/tasks.service';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import { buildVisibilityContext } from '../visibility/visibility.service';
import { createComment, deleteComment, getComment, listComments } from './comments.service';
import { createCommentSchema } from './comments.types';

const comments = new Hono();

// All routes require auth + visibility context
comments.use('*', authMiddleware);
comments.use('*', visibilityMiddleware);

// Query schema for listing comments
const listCommentsQuerySchema = z.object({
  targetType: z.enum(['task', 'deliverable']),
  targetId: z.string().uuid(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// Create comment on a target
comments.post('/', zValidator('json', createCommentSchema), async (c) => {
  const input = c.req.valid('json');
  const user = c.get('user');

  // Build visibility context to get visible project IDs
  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  const visibleProjectIds = visibilityContext.visibleProjectIds;

  // Get target to find projectId and verify visibility
  let projectId: string;

  if (input.targetType === 'task') {
    const task = await getTask(input.targetId);
    if (!task) {
      throw new ApiError(
        404,
        'comments/task-not-found',
        'Task Not Found',
        'The specified task does not exist'
      );
    }
    if (!visibleProjectIds.includes(task.projectId)) {
      throw new ApiError(
        403,
        'comments/access-denied',
        'Access Denied',
        'You do not have access to this task'
      );
    }
    projectId = task.projectId;
  } else {
    const deliverable = await getDeliverable(input.targetId);
    if (!deliverable) {
      throw new ApiError(
        404,
        'comments/deliverable-not-found',
        'Deliverable Not Found',
        'The specified deliverable does not exist'
      );
    }
    if (!visibleProjectIds.includes(deliverable.projectId)) {
      throw new ApiError(
        403,
        'comments/access-denied',
        'Access Denied',
        'You do not have access to this deliverable'
      );
    }
    projectId = deliverable.projectId;
  }

  const comment = await createComment(input, user.sub, projectId, user.org);

  return c.json({ data: comment }, 201);
});

// List comments for a target
comments.get('/', zValidator('query', listCommentsQuerySchema), async (c) => {
  const { targetType, targetId, limit, offset } = c.req.valid('query');
  const user = c.get('user');

  // Build visibility context to get visible project IDs
  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  const visibleProjectIds = visibilityContext.visibleProjectIds;

  // Verify target visibility
  if (targetType === 'task') {
    const task = await getTask(targetId);
    if (!task) {
      throw new ApiError(
        404,
        'comments/task-not-found',
        'Task Not Found',
        'The specified task does not exist'
      );
    }
    if (!visibleProjectIds.includes(task.projectId)) {
      throw new ApiError(
        403,
        'comments/access-denied',
        'Access Denied',
        'You do not have access to this task'
      );
    }
  } else {
    const deliverable = await getDeliverable(targetId);
    if (!deliverable) {
      throw new ApiError(
        404,
        'comments/deliverable-not-found',
        'Deliverable Not Found',
        'The specified deliverable does not exist'
      );
    }
    if (!visibleProjectIds.includes(deliverable.projectId)) {
      throw new ApiError(
        403,
        'comments/access-denied',
        'Access Denied',
        'You do not have access to this deliverable'
      );
    }
  }

  const commentsList = await listComments(targetType, targetId, limit, offset);

  return c.json({ data: commentsList });
});

// Get single comment
comments.get('/:id', async (c) => {
  const commentId = c.req.param('id');
  const user = c.get('user');

  // Build visibility context to get visible project IDs
  const visibilityContext = await buildVisibilityContext(user.sub, user.org);
  const visibleProjectIds = visibilityContext.visibleProjectIds;

  const comment = await getComment(commentId);
  if (!comment) {
    throw new ApiError(
      404,
      'comments/not-found',
      'Comment Not Found',
      'The specified comment does not exist'
    );
  }

  if (!visibleProjectIds.includes(comment.projectId)) {
    throw new ApiError(
      403,
      'comments/access-denied',
      'Access Denied',
      'You do not have access to this comment'
    );
  }

  return c.json({ data: comment });
});

// Delete comment (author only)
comments.delete('/:id', async (c) => {
  const commentId = c.req.param('id');
  const user = c.get('user');

  const deleted = await deleteComment(commentId, user.sub);
  if (!deleted) {
    throw new ApiError(
      404,
      'comments/not-found-or-unauthorized',
      'Comment Not Found or Unauthorized',
      'The comment does not exist or you are not authorized to delete it'
    );
  }

  return c.json({ data: { deleted: true } });
});

export { comments as commentsRoutes };
