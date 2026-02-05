import { S3Client } from 'bun';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { env } from '../../shared/lib/env';
import { ApiError } from '../../shared/middleware/error-handler';
import type { AttachmentResult, CreateUploadInput, PresignedUploadResult } from './uploads.types';

/**
 * Check if S3 is configured. All four env vars are required for S3 to work.
 */
function isS3Configured(): boolean {
  return Boolean(
    env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_BUCKET && env.S3_ENDPOINT
  );
}

/**
 * Get S3 client. Throws 503 if not configured.
 */
function getS3Client(): S3Client {
  if (!isS3Configured()) {
    throw new ApiError(
      503,
      'uploads/not-configured',
      'File Uploads Not Available',
      'S3 storage is not configured. Please set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, and S3_ENDPOINT environment variables.'
    );
  }

  // Safe to use as string after isS3Configured() check
  return new S3Client({
    accessKeyId: env.S3_ACCESS_KEY_ID as string,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
    bucket: env.S3_BUCKET as string,
    endpoint: env.S3_ENDPOINT as string,
  });
}

/**
 * Generate presigned URL for file upload.
 * Creates a pending attachment record and returns URL for direct S3 upload.
 */
export async function createUploadUrl(
  input: CreateUploadInput,
  userId: string
): Promise<PresignedUploadResult> {
  const s3 = getS3Client();

  // Generate s3 key with structure: attachments/{targetType}/{targetId}/{filename}
  const s3Key = `attachments/${input.targetType}/${input.targetId}/${crypto.randomUUID()}/${input.filename}`;

  const expiresIn = 3600; // 1 hour
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Generate presigned PUT URL
  const uploadUrl = s3.presign(s3Key, {
    method: 'PUT',
    expiresIn,
    type: input.contentType,
  });

  // Create pending attachment record
  const [attachment] = await db
    .insert(schema.attachments)
    .values({
      targetType: input.targetType,
      targetId: input.targetId,
      filename: input.filename,
      contentType: input.contentType,
      s3Key,
      uploadedById: userId,
      status: 'pending',
    })
    .returning();

  if (!attachment) {
    throw new ApiError(
      500,
      'uploads/creation-failed',
      'Upload Creation Failed',
      'Failed to create attachment record'
    );
  }

  return {
    uploadUrl,
    attachmentId: attachment.id,
    expiresAt,
  };
}

/**
 * Confirm upload completed and get download URL.
 * Verifies file exists in S3 and marks attachment as completed.
 */
export async function confirmUpload(attachmentId: string): Promise<string> {
  const s3 = getS3Client();

  const attachment = await db.query.attachments.findFirst({
    where: eq(schema.attachments.id, attachmentId),
  });

  if (!attachment) {
    throw new ApiError(
      404,
      'uploads/not-found',
      'Attachment Not Found',
      'The specified attachment does not exist'
    );
  }

  if (attachment.status !== 'pending') {
    throw new ApiError(
      400,
      'uploads/invalid-status',
      'Invalid Attachment Status',
      `Attachment is already ${attachment.status}`
    );
  }

  // Verify file exists in S3
  const s3File = s3.file(attachment.s3Key);
  const exists = await s3File.exists();

  if (!exists) {
    throw new ApiError(
      400,
      'uploads/file-not-found',
      'File Not Uploaded',
      'The file was not uploaded to the provided URL. Please try uploading again.'
    );
  }

  // Get file size from S3
  const fileSize = s3File.size;

  // Update attachment status
  await db
    .update(schema.attachments)
    .set({
      status: 'completed',
      fileSize: typeof fileSize === 'number' ? fileSize : null,
      completedAt: new Date(),
    })
    .where(eq(schema.attachments.id, attachmentId));

  // Generate presigned GET URL (7 day expiry)
  const downloadUrl = s3.presign(attachment.s3Key, {
    method: 'GET',
    expiresIn: 86400 * 7, // 7 days
  });

  return downloadUrl;
}

/**
 * Get download URL for a completed attachment.
 */
export async function getDownloadUrl(attachmentId: string): Promise<string> {
  const s3 = getS3Client();

  const attachment = await db.query.attachments.findFirst({
    where: eq(schema.attachments.id, attachmentId),
  });

  if (!attachment) {
    throw new ApiError(
      404,
      'uploads/not-found',
      'Attachment Not Found',
      'The specified attachment does not exist'
    );
  }

  if (attachment.status !== 'completed') {
    throw new ApiError(
      400,
      'uploads/not-completed',
      'Attachment Not Completed',
      'The file upload has not been confirmed yet'
    );
  }

  // Generate presigned GET URL (7 day expiry)
  const downloadUrl = s3.presign(attachment.s3Key, {
    method: 'GET',
    expiresIn: 86400 * 7, // 7 days
  });

  return downloadUrl;
}

/**
 * Delete an attachment and its S3 file.
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  const s3 = getS3Client();

  const attachment = await db.query.attachments.findFirst({
    where: eq(schema.attachments.id, attachmentId),
  });

  if (!attachment) {
    throw new ApiError(
      404,
      'uploads/not-found',
      'Attachment Not Found',
      'The specified attachment does not exist'
    );
  }

  // Delete from S3 (ignore errors if file doesn't exist)
  try {
    await s3.file(attachment.s3Key).delete();
  } catch {
    // File may not exist in S3, continue with database deletion
  }

  // Delete from database
  await db.delete(schema.attachments).where(eq(schema.attachments.id, attachmentId));
}

/**
 * List completed attachments for a target (task or deliverable).
 */
export async function listAttachments(
  targetType: 'task' | 'deliverable',
  targetId: string
): Promise<AttachmentResult[]> {
  const attachments = await db.query.attachments.findMany({
    where: and(
      eq(schema.attachments.targetType, targetType),
      eq(schema.attachments.targetId, targetId),
      eq(schema.attachments.status, 'completed')
    ),
    orderBy: (attachments, { desc }) => [desc(attachments.createdAt)],
  });

  return attachments;
}
