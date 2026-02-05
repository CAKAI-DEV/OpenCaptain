import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { queueNotification } from '../notifications';
import type { CommentResult, CreateCommentInput, ParsedMention } from './comments.types';

// Regex to match @mentions - handles @email or @username format
const MENTION_REGEX = /@([a-zA-Z0-9._+-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)/g;

/**
 * Parse @mentions from comment text
 */
export function parseMentions(content: string): ParsedMention[] {
  const matches = [...content.matchAll(MENTION_REGEX)];
  return matches
    .filter((match) => match[1] !== undefined)
    .map((match) => ({
      raw: match[0],
      identifier: match[1] as string,
      userId: null,
    }));
}

/**
 * Resolve parsed mentions to user IDs within an organization
 */
export async function resolveMentions(
  mentions: ParsedMention[],
  organizationId: string
): Promise<ParsedMention[]> {
  if (mentions.length === 0) return [];

  const resolved: ParsedMention[] = [];

  for (const mention of mentions) {
    // Try to find user by email within org
    const user = await db.query.users.findFirst({
      where: and(
        eq(schema.users.orgId, organizationId),
        eq(schema.users.email, mention.identifier)
      ),
      columns: { id: true },
    });

    resolved.push({
      ...mention,
      userId: user?.id ?? null,
    });
  }

  return resolved;
}

/**
 * Create a comment with @mention parsing
 */
export async function createComment(
  input: CreateCommentInput,
  authorId: string,
  projectId: string,
  organizationId: string
): Promise<CommentResult> {
  // Parse and resolve mentions
  const parsedMentions = parseMentions(input.content);
  const resolvedMentions = await resolveMentions(parsedMentions, organizationId);
  const mentionUserIds = resolvedMentions
    .filter((m) => m.userId !== null)
    .map((m) => m.userId as string);

  // Create comment
  const [comment] = await db
    .insert(schema.comments)
    .values({
      targetType: input.targetType,
      targetId: input.targetId,
      content: input.content,
      authorId,
      projectId,
      mentions: mentionUserIds,
    })
    .returning();

  if (!comment) {
    throw new Error('Failed to create comment');
  }

  logger.info(
    {
      commentId: comment.id,
      targetType: input.targetType,
      targetId: input.targetId,
      mentions: mentionUserIds.length,
    },
    'Comment created'
  );

  // Queue notifications for mentioned users
  for (const mentionUserId of mentionUserIds) {
    if (mentionUserId !== authorId) {
      // Don't notify yourself
      await queueNotification({
        type: 'mention',
        userId: mentionUserId,
        actorId: authorId,
        targetType: input.targetType,
        targetId: input.targetId,
        projectId,
        commentId: comment.id,
      });
    }
  }

  // Notify assignee if commenting on their item (except self)
  let assigneeId: string | null = null;
  if (input.targetType === 'task') {
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, input.targetId),
      columns: { assigneeId: true },
    });
    assigneeId = task?.assigneeId ?? null;
  } else {
    const deliverable = await db.query.deliverables.findFirst({
      where: eq(schema.deliverables.id, input.targetId),
      columns: { assigneeId: true },
    });
    assigneeId = deliverable?.assigneeId ?? null;
  }

  // Notify assignee only if not author and not already mentioned
  if (assigneeId && assigneeId !== authorId && !mentionUserIds.includes(assigneeId)) {
    await queueNotification({
      type: 'comment',
      userId: assigneeId,
      actorId: authorId,
      targetType: input.targetType,
      targetId: input.targetId,
      projectId,
      commentId: comment.id,
    });
  }

  return {
    id: comment.id,
    targetType: comment.targetType as 'task' | 'deliverable',
    targetId: comment.targetId,
    content: comment.content,
    authorId: comment.authorId,
    projectId: comment.projectId,
    mentions: mentionUserIds,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

/**
 * List comments for a target item
 */
export async function listComments(
  targetType: 'task' | 'deliverable',
  targetId: string,
  limit = 50,
  offset = 0
): Promise<CommentResult[]> {
  const comments = await db.query.comments.findMany({
    where: and(eq(schema.comments.targetType, targetType), eq(schema.comments.targetId, targetId)),
    orderBy: [desc(schema.comments.createdAt)],
    limit,
    offset,
    with: {
      author: {
        columns: { email: true },
      },
    },
  });

  return comments.map((c) => ({
    id: c.id,
    targetType: c.targetType as 'task' | 'deliverable',
    targetId: c.targetId,
    content: c.content,
    authorId: c.authorId,
    projectId: c.projectId,
    authorEmail: c.author?.email,
    mentions: (c.mentions as string[]) ?? [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

/**
 * Get a single comment by ID
 */
export async function getComment(commentId: string): Promise<CommentResult | null> {
  const comment = await db.query.comments.findFirst({
    where: eq(schema.comments.id, commentId),
    with: {
      author: {
        columns: { email: true },
      },
    },
  });

  if (!comment) return null;

  return {
    id: comment.id,
    targetType: comment.targetType as 'task' | 'deliverable',
    targetId: comment.targetId,
    content: comment.content,
    authorId: comment.authorId,
    projectId: comment.projectId,
    authorEmail: comment.author?.email,
    mentions: (comment.mentions as string[]) ?? [],
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

/**
 * Delete a comment (only author can delete)
 */
export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(schema.comments)
    .where(and(eq(schema.comments.id, commentId), eq(schema.comments.authorId, userId)))
    .returning({ id: schema.comments.id });

  return result.length > 0;
}
