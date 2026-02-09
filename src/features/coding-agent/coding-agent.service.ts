/**
 * Coding agent service.
 *
 * Orchestrates coding fix requests from authorization to PR creation.
 * All changes require PR review - never auto-merge.
 */
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { getRoleTier } from '../../shared/lib/permissions';
import { ApiError } from '../../shared/middleware';
import type { GitHubAppConfig } from '../integrations/github';
import {
  createBranch,
  createGitHubAppClient,
  createPullRequest,
  getDefaultBranch,
} from '../integrations/github';
import { chatCompletion } from '../llm/llm.service';
import { codingAgentQueue, queueNotification } from './coding-agent.queue';
import type {
  CodingAgentJobData,
  CodingAgentResult,
  CodingRequest,
  RequestCodingFixInput,
} from './coding-agent.types';

/**
 * Role tiers that can authorize coding fixes.
 * Admin (0), PM (1), Squad Lead (2) can authorize.
 */
const AUTHORIZED_TIER_THRESHOLD = 2;

/**
 * Check if GitHub App is configured.
 */
export function isGitHubAppConfigured(): boolean {
  return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

/**
 * Request a coding fix for a task.
 *
 * Validates authorization, creates request record, and queues for async processing.
 *
 * @param input - Request input with taskId, description, and authorizedById
 * @returns Created coding request ID
 */
export async function requestCodingFix(input: RequestCodingFixInput): Promise<string> {
  const { taskId, description, authorizedById } = input;

  // 1. Validate GitHub App is configured
  if (!isGitHubAppConfigured()) {
    throw new ApiError(
      503,
      'coding-agent/not-configured',
      'Coding Agent Not Configured',
      'GitHub App is not configured. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.'
    );
  }

  // 2. Get the task
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
  });

  if (!task) {
    throw new ApiError(
      404,
      'coding-agent/task-not-found',
      'Task Not Found',
      'The specified task does not exist'
    );
  }

  // 3. Validate user has authorization (lead/admin/pm role)
  const membership = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.projectId, task.projectId),
      eq(schema.projectMembers.userId, authorizedById)
    ),
  });

  if (!membership) {
    throw new ApiError(
      403,
      'coding-agent/not-member',
      'Not Project Member',
      'You must be a project member to request coding fixes'
    );
  }

  const userTier = getRoleTier(membership.role);
  if (userTier > AUTHORIZED_TIER_THRESHOLD) {
    throw new ApiError(
      403,
      'coding-agent/unauthorized-role',
      'Unauthorized Role',
      'Only Admin, PM, or Squad Lead can authorize coding fixes'
    );
  }

  // 4. Get linked repo for this project
  const linkedRepo = await db.query.linkedRepos.findFirst({
    where: eq(schema.linkedRepos.projectId, task.projectId),
  });

  if (!linkedRepo) {
    throw new ApiError(
      400,
      'coding-agent/no-linked-repo',
      'No Linked Repository',
      'This project has no linked GitHub repository. An admin must link a repo first.'
    );
  }

  // 5. Create coding request record
  const [codingRequest] = await db
    .insert(schema.codingRequests)
    .values({
      taskId,
      linkedRepoId: linkedRepo.id,
      authorizedById,
      description,
      status: 'pending',
    })
    .returning();

  if (!codingRequest) {
    throw new ApiError(
      500,
      'coding-agent/create-failed',
      'Request Creation Failed',
      'Failed to create coding request'
    );
  }

  // 6. Queue job for async processing
  await codingAgentQueue.add('process-fix', {
    requestId: codingRequest.id,
  } satisfies CodingAgentJobData);

  logger.info({ requestId: codingRequest.id, taskId, authorizedById }, 'Coding fix request queued');

  return codingRequest.id;
}

/**
 * Process a coding request.
 *
 * Called by the worker. Creates branch and PR with proposed fix.
 * CRITICAL: PR only, never auto-merge.
 *
 * @param requestId - Coding request ID
 * @returns Processing result
 */
export async function processCodingRequest(requestId: string): Promise<CodingAgentResult> {
  // 1. Get the request
  const request = await db.query.codingRequests.findFirst({
    where: eq(schema.codingRequests.id, requestId),
  });

  if (!request) {
    return { success: false, error: 'Coding request not found' };
  }

  // 2. Update status to in_progress
  await db
    .update(schema.codingRequests)
    .set({ status: 'in_progress', updatedAt: new Date() })
    .where(eq(schema.codingRequests.id, requestId));

  try {
    // 3. Get task and linked repo details
    const task = await db.query.tasks.findFirst({
      where: eq(schema.tasks.id, request.taskId),
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const linkedRepo = await db.query.linkedRepos.findFirst({
      where: eq(schema.linkedRepos.id, request.linkedRepoId),
    });

    if (!linkedRepo) {
      throw new Error('Linked repo not found');
    }

    // 4. Create GitHub client
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
      throw new Error('GitHub App not configured');
    }

    const config: GitHubAppConfig = {
      appId,
      privateKey,
      installationId: linkedRepo.installationId,
    };

    const octokit = await createGitHubAppClient(config);

    // 5. Create a new branch
    const defaultBranch = await getDefaultBranch(octokit, linkedRepo.owner, linkedRepo.repo);

    const branchName = `opencaptain/fix-${task.id.slice(0, 8)}-${Date.now()}`;

    await createBranch(octokit, linkedRepo.owner, linkedRepo.repo, defaultBranch, branchName);

    // 6. Use LLM to analyze task and generate fix strategy
    // For MVP: Generate a description of proposed changes
    const analysisPrompt = `Analyze this bug fix request and describe what changes would be needed.

Task Title: ${task.title}
Task Description: ${task.description || 'No description'}

Fix Request: ${request.description}

Provide a detailed description of:
1. The likely root cause
2. Files that probably need changes
3. The proposed fix approach
4. Testing recommendations

Format as markdown for a PR description.`;

    const analysisResult = await chatCompletion(
      [
        {
          role: 'system',
          content:
            'You are a senior software engineer analyzing bug reports. Provide clear, actionable analysis for PR descriptions.',
        },
        { role: 'user', content: analysisPrompt },
      ],
      { model: 'gpt-4o-mini', maxTokens: 1000 }
    );

    // 7. Create draft PR with proposed fix description
    const prBody = `## Automated Fix Request

**Task:** ${task.title}

**Fix Description:** ${request.description}

---

## Analysis

${analysisResult.content}

---

> **Note:** This is a draft PR created by OpenCaptain's coding agent.
> A human developer should review, implement the actual changes, and approve.
>
> **CRITICAL:** Never auto-merge. All changes require human review.

---

*Requested by: OpenCaptain Coding Agent*
*Task ID: ${task.id}*`;

    const prResult = await createPullRequest(octokit, {
      owner: linkedRepo.owner,
      repo: linkedRepo.repo,
      title: `[OpenCaptain] Fix: ${task.title}`,
      body: prBody,
      head: branchName,
      base: defaultBranch,
      draft: true, // Always create as draft
    });

    // 8. Update request with success
    await db
      .update(schema.codingRequests)
      .set({
        status: 'completed',
        branchName,
        prNumber: prResult.number,
        prUrl: prResult.htmlUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.codingRequests.id, requestId));

    // 9. Notify the user who requested the fix
    await queueNotification({
      userId: request.authorizedById,
      type: 'coding_fix_complete',
      title: 'Coding Fix PR Created',
      body: `A draft PR has been created for "${task.title}". Review it at: ${prResult.htmlUrl}`,
    });

    logger.info(
      { requestId, prNumber: prResult.number, prUrl: prResult.htmlUrl },
      'Coding fix PR created'
    );

    return {
      success: true,
      prUrl: prResult.htmlUrl,
      prNumber: prResult.number,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update request with failure
    await db
      .update(schema.codingRequests)
      .set({
        status: 'failed',
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(schema.codingRequests.id, requestId));

    logger.error({ requestId, error: errorMessage }, 'Coding fix request failed');

    return { success: false, error: errorMessage };
  }
}

/**
 * Get the status of a coding request.
 *
 * @param requestId - Coding request ID
 * @returns Coding request status
 */
export async function getCodingRequestStatus(requestId: string): Promise<CodingRequest | null> {
  const request = await db.query.codingRequests.findFirst({
    where: eq(schema.codingRequests.id, requestId),
  });

  if (!request) {
    return null;
  }

  return {
    id: request.id,
    taskId: request.taskId,
    linkedRepoId: request.linkedRepoId,
    authorizedById: request.authorizedById,
    description: request.description,
    status: request.status as CodingRequest['status'],
    branchName: request.branchName,
    prNumber: request.prNumber,
    prUrl: request.prUrl,
    errorMessage: request.errorMessage,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

/**
 * Get the latest coding request for a task.
 *
 * @param taskId - Task ID
 * @returns Latest coding request or null
 */
export async function getLatestCodingRequestForTask(taskId: string): Promise<CodingRequest | null> {
  const request = await db.query.codingRequests.findFirst({
    where: eq(schema.codingRequests.taskId, taskId),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  if (!request) {
    return null;
  }

  return {
    id: request.id,
    taskId: request.taskId,
    linkedRepoId: request.linkedRepoId,
    authorizedById: request.authorizedById,
    description: request.description,
    status: request.status as CodingRequest['status'],
    branchName: request.branchName,
    prNumber: request.prNumber,
    prUrl: request.prUrl,
    errorMessage: request.errorMessage,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}
