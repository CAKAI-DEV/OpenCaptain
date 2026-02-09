/**
 * Linear webhook handler with signature verification.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { db, schema } from '../../../shared/db';
import { logger } from '../../../shared/lib/logger';
import { getValue, setValue } from '../../../shared/lib/redis';
import { syncFromLinear } from './linear.sync';
import type { LinearWebhookPayload } from './linear.types';

/**
 * Verifies Linear webhook signature using HMAC SHA256 with timing-safe comparison.
 */
export function verifyLinearWebhook(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(body);
    const digest = hmac.digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature, 'hex');
    const digestBuffer = Buffer.from(digest, 'hex');

    if (signatureBuffer.length !== digestBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, digestBuffer);
  } catch (error) {
    logger.error({ error }, 'Error verifying Linear webhook signature');
    return false;
  }
}

/**
 * Handles incoming Linear webhook events.
 * Returns 200 immediately to avoid blocking Linear.
 */
export async function handleLinearWebhook(c: Context): Promise<Response> {
  const requestId = c.get('requestId');
  const signature = c.req.header('linear-signature') ?? c.req.header('x-linear-signature');

  // Get raw body for signature verification
  const rawBody = await c.req.text();

  let payload: LinearWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    logger.warn({ requestId }, 'Invalid Linear webhook payload');
    return c.json({ error: 'Invalid payload' }, 400);
  }

  const { action, type, data, webhookId, organizationId } = payload;
  const logContext = { requestId, webhookId, action, type, organizationId };

  logger.info(logContext, 'Received Linear webhook');

  // Find integration by organization ID (from webhook payload)
  // Note: We need to find which project this belongs to
  const integration = await findIntegrationByWebhook(organizationId, data.team?.id);

  if (!integration) {
    logger.warn({ ...logContext, teamId: data.team?.id }, 'No integration found for webhook');
    // Return 200 to acknowledge receipt even if we don't process
    return c.json({ received: true, processed: false });
  }

  // Verify signature
  if (integration.webhookSecret && signature) {
    const isValid = verifyLinearWebhook(rawBody, signature, integration.webhookSecret);
    if (!isValid) {
      logger.warn(logContext, 'Invalid Linear webhook signature');
      return c.json({ error: 'Invalid signature' }, 401);
    }
  }

  // Check idempotency - prevent duplicate processing
  const idempotencyKey = `linear:webhook:${webhookId}`;
  const alreadyProcessed = await getValue<boolean>(idempotencyKey);
  if (alreadyProcessed.success && alreadyProcessed.data) {
    logger.debug(logContext, 'Webhook already processed (idempotent)');
    return c.json({ received: true, duplicate: true });
  }

  // Mark as processing (5 minute TTL)
  await setValue(idempotencyKey, true, 300);

  // Return 200 immediately, process asynchronously
  // This prevents Linear from retrying while we process
  processWebhookAsync(payload, integration.projectId, integration.statusMappings || [], logContext);

  return c.json({ received: true });
}

/**
 * Processes webhook asynchronously after returning 200 to Linear.
 */
async function processWebhookAsync(
  payload: LinearWebhookPayload,
  projectId: string,
  statusMappings: Array<{
    blockbotStatus: 'todo' | 'in_progress' | 'done';
    linearStateId: string;
    linearStateName: string;
  }>,
  logContext: Record<string, unknown>
): Promise<void> {
  const { action, type, data } = payload;

  try {
    // Only process Issue events
    if (type !== 'Issue') {
      logger.debug({ ...logContext, type }, 'Ignoring non-Issue webhook');
      return;
    }

    switch (action) {
      case 'create':
        // Issue created in Linear - we only sync issues WE created
        // So ignore create events (they're for issues created in Linear directly)
        logger.debug(logContext, 'Ignoring Linear issue create event');
        break;

      case 'update':
        // Issue updated in Linear - sync to local if we track it
        await syncFromLinear(data, projectId, statusMappings);
        break;

      case 'remove':
        // Issue deleted in Linear - archive local task (don't delete)
        await handleIssueRemoved(data.id, logContext);
        break;

      default:
        logger.debug({ ...logContext, action }, 'Unknown webhook action');
    }
  } catch (error) {
    logger.error({ ...logContext, error }, 'Error processing Linear webhook');
  }
}

/**
 * Handles Linear issue removal by archiving the local task.
 */
async function handleIssueRemoved(
  linearIssueId: string,
  logContext: Record<string, unknown>
): Promise<void> {
  const syncMetadata = await db.query.linearSyncMetadata.findFirst({
    where: eq(schema.linearSyncMetadata.linearIssueId, linearIssueId),
  });

  if (!syncMetadata) {
    logger.debug({ ...logContext, linearIssueId }, 'No sync metadata for removed issue');
    return;
  }

  // Archive task by setting status to done
  // Note: We don't delete - just mark as done to preserve history
  await db
    .update(schema.tasks)
    .set({
      status: 'done',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, syncMetadata.taskId));

  logger.info(
    { ...logContext, taskId: syncMetadata.taskId, linearIssueId },
    'Archived task from Linear removal'
  );
}

/**
 * Finds integration configuration by organization ID and team ID.
 */
async function findIntegrationByWebhook(_organizationId: string, teamId?: string) {
  // First try to find by team ID (more specific)
  if (teamId) {
    const integration = await db.query.linearIntegrations.findFirst({
      where: eq(schema.linearIntegrations.teamId, teamId),
    });
    if (integration) {
      return integration;
    }
  }

  // Fallback: find any integration (in a multi-project setup, this would need enhancement)
  // For now, we assume one integration per Linear team
  return db.query.linearIntegrations.findFirst({
    where: eq(schema.linearIntegrations.enabled, true),
  });
}
