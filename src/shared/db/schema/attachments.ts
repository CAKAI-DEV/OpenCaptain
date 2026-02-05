import { integer, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export const attachmentStatusEnum = pgEnum('attachment_status', ['pending', 'completed', 'failed']);

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Target type: 'task' or 'deliverable'
  targetType: varchar('target_type', { length: 20 }).notNull(),
  targetId: uuid('target_id').notNull(),

  // File metadata
  filename: varchar('filename', { length: 500 }).notNull(),
  contentType: varchar('content_type', { length: 255 }).notNull(),
  s3Key: varchar('s3_key', { length: 1000 }).notNull(),
  fileSize: integer('file_size'), // Set after upload confirmation

  // Upload status
  status: attachmentStatusEnum('status').notNull().default('pending'),

  // User tracking
  uploadedById: uuid('uploaded_by_id')
    .notNull()
    .references(() => users.id),

  // Timestamps
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
