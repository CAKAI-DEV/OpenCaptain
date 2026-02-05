import type { attachments } from '../../shared/db/schema/attachments';

export interface CreateUploadInput {
  filename: string;
  contentType: string;
  targetType: 'task' | 'deliverable';
  targetId: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  attachmentId: string;
  expiresAt: Date;
}

export type AttachmentResult = typeof attachments.$inferSelect;
