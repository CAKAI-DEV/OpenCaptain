import { z } from 'zod';

export const createCommentSchema = z.object({
  targetType: z.enum(['task', 'deliverable']),
  targetId: z.string().uuid(),
  content: z.string().min(1).max(10000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export interface CommentResult {
  id: string;
  targetType: 'task' | 'deliverable';
  targetId: string;
  content: string;
  authorId: string;
  authorEmail?: string;
  mentions: string[];
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParsedMention {
  raw: string; // @john@example.com or @john
  identifier: string; // john@example.com or john
  userId: string | null; // Resolved user ID
}
