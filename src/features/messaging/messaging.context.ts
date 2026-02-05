/**
 * User context management for messaging channels.
 *
 * Handles project context tracking and switching for Telegram/WhatsApp users.
 */
import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { buildVisibilityContext } from '../visibility';
import type { MessageContext } from './messaging.types';

/**
 * Get or create user messaging context.
 *
 * Loads user's organization, current project context, and visible projects.
 *
 * @param userId - User ID to load context for
 * @returns MessageContext or null if user not found
 */
export async function getUserContext(userId: string): Promise<MessageContext | null> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { id: true, orgId: true },
  });

  if (!user) {
    logger.warn({ userId }, 'User not found for messaging context');
    return null;
  }

  // Get user's messaging preferences
  const userMessaging = await db.query.userMessaging.findFirst({
    where: eq(schema.userMessaging.userId, userId),
  });

  // Get visible projects via visibility service
  const visibilityContext = await buildVisibilityContext(userId, user.orgId);
  const visibleProjectIds = visibilityContext.visibleProjectIds;

  // Validate last project is still visible
  let currentProjectId = userMessaging?.lastProjectId ?? null;
  if (currentProjectId && !visibleProjectIds.includes(currentProjectId)) {
    currentProjectId = null;
  }

  return {
    userId,
    organizationId: user.orgId,
    currentProjectId,
    visibleProjectIds,
    conversationId: null, // Will be set per conversation
  };
}

/**
 * Switch user's current project context.
 *
 * @param userId - User ID
 * @param projectId - Project ID to switch to
 * @returns Success status and optional error
 */
export async function switchProject(
  userId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const context = await getUserContext(userId);
  if (!context) {
    return { success: false, error: 'User not found' };
  }

  if (!context.visibleProjectIds.includes(projectId)) {
    return { success: false, error: 'Project not visible to user' };
  }

  await db
    .insert(schema.userMessaging)
    .values({
      userId,
      lastProjectId: projectId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.userMessaging.userId,
      set: {
        lastProjectId: projectId,
        updatedAt: new Date(),
      },
    });

  logger.info({ userId, projectId }, 'Project context switched');
  return { success: true };
}

/**
 * Get projects user can switch to.
 *
 * @param visibleProjectIds - Array of project IDs user can access
 * @returns Array of project objects with id and name
 */
export async function getAvailableProjects(
  visibleProjectIds: string[]
): Promise<Array<{ id: string; name: string }>> {
  if (visibleProjectIds.length === 0) {
    return [];
  }

  const projects = await db.query.projects.findMany({
    where: inArray(schema.projects.id, visibleProjectIds),
    columns: { id: true, name: true },
  });

  return projects;
}
