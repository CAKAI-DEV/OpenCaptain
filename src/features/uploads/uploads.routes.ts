import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { createResponse } from '../../shared/types';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import * as uploadsService from './uploads.service';

const uploads = new Hono();

// All routes require authentication and visibility
uploads.use('*', authMiddleware);
uploads.use('*', visibilityMiddleware);

// Validation schemas
const presignSchema = z.object({
  filename: z.string().min(1).max(500),
  contentType: z.string().min(1).max(255),
  targetType: z.enum(['task', 'deliverable']),
  targetId: z.string().uuid(),
});

const attachmentIdParamSchema = z.object({
  attachmentId: z.string().uuid(),
});

const listQuerySchema = z.object({
  targetType: z.enum(['task', 'deliverable']),
  targetId: z.string().uuid(),
});

// POST /presign - Get presigned upload URL
uploads.post('/presign', zValidator('json', presignSchema), async (c) => {
  const input = c.req.valid('json');
  const user = c.get('user');

  const result = await uploadsService.createUploadUrl(input, user.sub);

  return c.json(
    createResponse({
      uploadUrl: result.uploadUrl,
      attachmentId: result.attachmentId,
      expiresAt: result.expiresAt.toISOString(),
    }),
    201
  );
});

// POST /:attachmentId/confirm - Confirm upload completed
uploads.post('/:attachmentId/confirm', zValidator('param', attachmentIdParamSchema), async (c) => {
  const { attachmentId } = c.req.valid('param');

  const downloadUrl = await uploadsService.confirmUpload(attachmentId);

  return c.json(createResponse({ downloadUrl }));
});

// GET /:attachmentId/download - Get download URL
uploads.get('/:attachmentId/download', zValidator('param', attachmentIdParamSchema), async (c) => {
  const { attachmentId } = c.req.valid('param');

  const downloadUrl = await uploadsService.getDownloadUrl(attachmentId);

  return c.json(createResponse({ downloadUrl }));
});

// DELETE /:attachmentId - Delete attachment
uploads.delete('/:attachmentId', zValidator('param', attachmentIdParamSchema), async (c) => {
  const { attachmentId } = c.req.valid('param');

  await uploadsService.deleteAttachment(attachmentId);

  return c.body(null, 204);
});

// GET / - List attachments for target
uploads.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { targetType, targetId } = c.req.valid('query');

  const attachments = await uploadsService.listAttachments(targetType, targetId);

  return c.json(createResponse(attachments));
});

export { uploads as uploadsRoutes };
