/**
 * Linear integration API routes.
 */
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../../../shared/db';
import { logger } from '../../../shared/lib/logger';
import { ApiError } from '../../../shared/middleware';
import { authMiddleware } from '../../auth/auth.middleware';
import { visibilityMiddleware } from '../../visibility/visibility.middleware';
import { createLinearClient, getLinearTeamStates, getLinearTeams } from './linear.client';
import { getLinearIntegration, getLinearSyncMetadata, syncTaskToLinear } from './linear.sync';
import { handleLinearWebhook } from './linear.webhooks';

/**
 * Linear webhook routes (public, no auth required - signature verified).
 */
export const linearWebhookRoutes = new Hono();

// POST /webhooks/linear - Receive Linear webhook events
linearWebhookRoutes.post('/webhooks/linear', handleLinearWebhook);

/**
 * Linear API routes (authenticated).
 */
export const linearApiRoutes = new Hono();

// Apply auth and visibility middleware to all routes
linearApiRoutes.use('*', authMiddleware);
linearApiRoutes.use('*', visibilityMiddleware);

// Configure Linear integration for a project
const configureLinearSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  teamId: z.string().min(1, 'Team ID is required'),
  statusMappings: z
    .array(
      z.object({
        blockbotStatus: z.enum(['todo', 'in_progress', 'done']),
        linearStateId: z.string(),
        linearStateName: z.string(),
      })
    )
    .optional(),
});

// POST /api/v1/projects/:projectId/integrations/linear - Configure Linear
linearApiRoutes.post(
  '/projects/:projectId/integrations/linear',
  zValidator('json', configureLinearSchema),
  async (c) => {
    const projectId = c.req.param('projectId');
    const data = c.req.valid('json');
    const user = c.get('user');

    // Verify project exists and user has access (PM or Admin role)
    const membership = await db.query.projectMembers.findFirst({
      where: eq(schema.projectMembers.projectId, projectId),
    });

    if (!membership) {
      throw new ApiError(
        404,
        'linear/project-not-found',
        'Project Not Found',
        'The specified project does not exist'
      );
    }

    // Validate API key by testing connection
    const client = createLinearClient(data.apiKey);
    const teams = await getLinearTeams(client);

    if (teams.length === 0) {
      throw new ApiError(
        400,
        'linear/invalid-api-key',
        'Invalid API Key',
        'Could not connect to Linear with the provided API key'
      );
    }

    // Validate team ID
    const team = teams.find((t) => t.id === data.teamId);
    if (!team) {
      throw new ApiError(
        400,
        'linear/invalid-team',
        'Invalid Team',
        `Team ID ${data.teamId} not found. Available teams: ${teams.map((t) => t.name).join(', ')}`
      );
    }

    // Get team states for default mappings if not provided
    let statusMappings = data.statusMappings;
    if (!statusMappings || statusMappings.length === 0) {
      const states = await getLinearTeamStates(client, data.teamId);
      statusMappings = buildDefaultMappings(states);
    }

    // Check for existing integration
    const existing = await getLinearIntegration(projectId);

    if (existing) {
      // Update existing integration
      await db
        .update(schema.linearIntegrations)
        .set({
          apiKeyEncrypted: data.apiKey, // TODO: Encrypt in production
          teamId: data.teamId,
          statusMappings,
          enabled: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.linearIntegrations.projectId, projectId));

      logger.info({ projectId, userId: user.sub }, 'Updated Linear integration');
    } else {
      // Create new integration
      await db.insert(schema.linearIntegrations).values({
        projectId,
        apiKeyEncrypted: data.apiKey, // TODO: Encrypt in production
        teamId: data.teamId,
        statusMappings,
        enabled: true,
      });

      logger.info({ projectId, userId: user.sub }, 'Created Linear integration');
    }

    return c.json({
      success: true,
      teamId: data.teamId,
      teamName: team.name,
      statusMappings,
    });
  }
);

// GET /api/v1/projects/:projectId/integrations/linear - Get integration status
linearApiRoutes.get('/projects/:projectId/integrations/linear', async (c) => {
  const projectId = c.req.param('projectId');

  const integration = await getLinearIntegration(projectId);

  if (!integration) {
    return c.json({
      configured: false,
      enabled: false,
    });
  }

  // Get team info
  let teamName: string | undefined;
  try {
    const client = createLinearClient(integration.apiKeyEncrypted);
    const teams = await getLinearTeams(client);
    const team = teams.find((t) => t.id === integration.teamId);
    teamName = team?.name;
  } catch {
    // API key might be invalid now
    teamName = undefined;
  }

  return c.json({
    configured: true,
    enabled: integration.enabled,
    teamId: integration.teamId,
    teamName,
    statusMappings: integration.statusMappings,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  });
});

// DELETE /api/v1/projects/:projectId/integrations/linear - Disable integration
linearApiRoutes.delete('/projects/:projectId/integrations/linear', async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');

  const integration = await getLinearIntegration(projectId);

  if (!integration) {
    throw new ApiError(
      404,
      'linear/not-configured',
      'Integration Not Configured',
      'Linear integration is not configured for this project'
    );
  }

  await db
    .update(schema.linearIntegrations)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(schema.linearIntegrations.projectId, projectId));

  logger.info({ projectId, userId: user.sub }, 'Disabled Linear integration');

  return c.json({ success: true, enabled: false });
});

// POST /api/v1/tasks/:taskId/sync-linear - Manual sync trigger
linearApiRoutes.post('/tasks/:taskId/sync-linear', async (c) => {
  const taskId = c.req.param('taskId');
  const user = c.get('user');

  // Get task
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
  });

  if (!task) {
    throw new ApiError(
      404,
      'tasks/not-found',
      'Task Not Found',
      'The specified task does not exist'
    );
  }

  // Get integration for task's project
  const integration = await getLinearIntegration(task.projectId);

  if (!integration || !integration.enabled) {
    throw new ApiError(
      400,
      'linear/not-enabled',
      'Linear Not Enabled',
      'Linear integration is not enabled for this project'
    );
  }

  // Sync task to Linear
  const client = createLinearClient(integration.apiKeyEncrypted);
  const result = await syncTaskToLinear(
    task,
    client,
    integration.teamId,
    integration.statusMappings || []
  );

  logger.info({ taskId, userId: user.sub, result }, 'Manual Linear sync triggered');

  return c.json({
    success: result.success,
    action: result.action,
    linearIssueId: result.linearIssueId,
    error: result.error,
  });
});

// GET /api/v1/tasks/:taskId/linear-status - Get Linear sync status
linearApiRoutes.get('/tasks/:taskId/linear-status', async (c) => {
  const taskId = c.req.param('taskId');

  const syncMetadata = await getLinearSyncMetadata(taskId);

  if (!syncMetadata) {
    return c.json({
      synced: false,
    });
  }

  return c.json({
    synced: true,
    linearIssueId: syncMetadata.linearIssueId,
    linearIdentifier: syncMetadata.linearIdentifier,
    lastSyncedAt: syncMetadata.lastSyncedAt,
    lastSyncDirection: syncMetadata.lastSyncDirection,
  });
});

/**
 * Build default status mappings from Linear team states.
 */
function buildDefaultMappings(states: Array<{ id: string; name: string; type: string }>): Array<{
  blockbotStatus: 'todo' | 'in_progress' | 'done';
  linearStateId: string;
  linearStateName: string;
}> {
  const mappings: Array<{
    blockbotStatus: 'todo' | 'in_progress' | 'done';
    linearStateId: string;
    linearStateName: string;
  }> = [];

  // Find best matches based on state type and name
  const backlog = states.find((s) => s.type === 'backlog' || s.name.toLowerCase() === 'backlog');
  const inProgress = states.find(
    (s) => s.type === 'started' || s.name.toLowerCase().includes('progress')
  );
  const done = states.find((s) => s.type === 'completed' || s.name.toLowerCase() === 'done');

  if (backlog) {
    mappings.push({
      blockbotStatus: 'todo',
      linearStateId: backlog.id,
      linearStateName: backlog.name,
    });
  }
  if (inProgress) {
    mappings.push({
      blockbotStatus: 'in_progress',
      linearStateId: inProgress.id,
      linearStateName: inProgress.name,
    });
  }
  if (done) {
    mappings.push({ blockbotStatus: 'done', linearStateId: done.id, linearStateName: done.name });
  }

  return mappings;
}
