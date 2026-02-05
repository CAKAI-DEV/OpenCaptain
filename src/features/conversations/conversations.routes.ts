import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../../shared/middleware/error-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import { buildVisibilityContext } from '../visibility/visibility.service';
import {
  createConversation,
  getConversation,
  getMessages,
  listConversations,
  sendMessage,
} from './conversations.service';

const conversationsRouter = new Hono();

// All routes require auth + visibility context
conversationsRouter.use('*', authMiddleware);
conversationsRouter.use('*', visibilityMiddleware);

// Validation schemas
const createConversationSchema = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().max(255).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(32000),
});

// POST /conversations - Create new conversation
conversationsRouter.post('/', zValidator('json', createConversationSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');

  const conversationId = await createConversation({
    organizationId: user.org,
    userId: user.sub,
    projectId: body.projectId,
    title: body.title,
  });

  return c.json({ id: conversationId }, 201);
});

// GET /conversations - List user's conversations
conversationsRouter.get('/', async (c) => {
  const user = c.get('user');
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
  const offset = Number(c.req.query('offset')) || 0;

  const convos = await listConversations(user.sub, user.org, limit, offset);

  return c.json({ data: convos });
});

// GET /conversations/:id - Get conversation with messages
conversationsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const conversationId = c.req.param('id');

  const conversation = await getConversation(conversationId, user.sub);
  if (!conversation) {
    throw new ApiError(
      404,
      'conversations/not-found',
      'Conversation Not Found',
      'The conversation does not exist or you do not have access'
    );
  }

  const messages = await getMessages(conversationId);

  return c.json({
    id: conversation.id,
    title: conversation.title,
    projectId: conversation.projectId,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
});

// POST /conversations/:id/messages - Send message and get response
conversationsRouter.post('/:id/messages', zValidator('json', sendMessageSchema), async (c) => {
  const user = c.get('user');
  const conversationId = c.req.param('id');
  const { content } = c.req.valid('json');

  // Verify conversation exists and user owns it
  const conversation = await getConversation(conversationId, user.sub);
  if (!conversation) {
    throw new ApiError(
      404,
      'conversations/not-found',
      'Conversation Not Found',
      'The conversation does not exist or you do not have access'
    );
  }

  // Get user's visible projects for RAG query security
  const visibilityContext = await buildVisibilityContext(user.sub, user.org);

  const response = await sendMessage(
    conversationId,
    content,
    user.org,
    user.sub,
    visibilityContext.visibleProjectIds,
    conversation.projectId ?? undefined
  );

  return c.json(response, 201);
});

export { conversationsRouter as conversationRoutes };
