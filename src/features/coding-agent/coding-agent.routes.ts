/**
 * Coding agent API routes.
 *
 * Endpoints:
 * - POST /api/v1/projects/:projectId/repos - Link GitHub repo (admin only)
 * - GET /api/v1/projects/:projectId/repos - List linked repos
 * - DELETE /api/v1/projects/:projectId/repos/:repoId - Unlink repo
 * - POST /api/v1/tasks/:taskId/fix - Request coding fix (lead/admin/pm only)
 * - GET /api/v1/tasks/:taskId/fix - Get coding request status
 */
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db, schema } from '../../shared/db';
import { logger } from '../../shared/lib/logger';
import { getRoleTier } from '../../shared/lib/permissions';
import { ApiError } from '../../shared/middleware';
import { createResponse } from '../../shared/types';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import {
  getLatestCodingRequestForTask,
  isGitHubAppConfigured,
  requestCodingFix,
} from './coding-agent.service';

const codingAgent = new Hono();

// All routes require authentication and visibility
codingAgent.use('*', authMiddleware);
codingAgent.use('*', visibilityMiddleware);

// --- Repo linking routes ---

const linkRepoSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repo name is required'),
  installationId: z.number().int().positive('Installation ID must be a positive integer'),
});

/**
 * POST /projects/:projectId/repos
 *
 * Link a GitHub repository to a project.
 * Requires admin role.
 */
codingAgent.post('/projects/:projectId/repos', zValidator('json', linkRepoSchema), async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');
  const body = c.req.valid('json');

  // Verify GitHub App is configured
  if (!isGitHubAppConfigured()) {
    throw new ApiError(
      503,
      'coding-agent/not-configured',
      'GitHub App Not Configured',
      'GitHub App is not configured. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.'
    );
  }

  // Verify project exists
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });

  if (!project) {
    throw new ApiError(
      404,
      'coding-agent/project-not-found',
      'Project Not Found',
      'The specified project does not exist'
    );
  }

  // Verify user is admin
  const membership = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.projectId, projectId),
      eq(schema.projectMembers.userId, user.sub)
    ),
  });

  if (!membership || membership.role !== 'admin') {
    throw new ApiError(
      403,
      'coding-agent/admin-required',
      'Admin Required',
      'Only project admins can link GitHub repositories'
    );
  }

  // Check if repo is already linked
  const existingRepo = await db.query.linkedRepos.findFirst({
    where: and(
      eq(schema.linkedRepos.projectId, projectId),
      eq(schema.linkedRepos.owner, body.owner),
      eq(schema.linkedRepos.repo, body.repo)
    ),
  });

  if (existingRepo) {
    throw new ApiError(
      409,
      'coding-agent/repo-already-linked',
      'Repository Already Linked',
      'This repository is already linked to the project'
    );
  }

  // Create linked repo
  const [linkedRepo] = await db
    .insert(schema.linkedRepos)
    .values({
      projectId,
      owner: body.owner,
      repo: body.repo,
      installationId: body.installationId,
    })
    .returning();

  if (!linkedRepo) {
    throw new ApiError(500, 'coding-agent/link-failed', 'Link Failed', 'Failed to link repository');
  }

  logger.info(
    { projectId, owner: body.owner, repo: body.repo, userId: user.sub },
    'GitHub repository linked'
  );

  return c.json(
    createResponse({
      id: linkedRepo.id,
      owner: linkedRepo.owner,
      repo: linkedRepo.repo,
      installationId: linkedRepo.installationId,
      createdAt: linkedRepo.createdAt.toISOString(),
    }),
    201
  );
});

/**
 * GET /projects/:projectId/repos
 *
 * List all linked repositories for a project.
 */
codingAgent.get('/projects/:projectId/repos', async (c) => {
  const projectId = c.req.param('projectId');

  // Verify project exists
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });

  if (!project) {
    throw new ApiError(
      404,
      'coding-agent/project-not-found',
      'Project Not Found',
      'The specified project does not exist'
    );
  }

  const repos = await db.query.linkedRepos.findMany({
    where: eq(schema.linkedRepos.projectId, projectId),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  return c.json(
    createResponse({
      repos: repos.map((r) => ({
        id: r.id,
        owner: r.owner,
        repo: r.repo,
        installationId: r.installationId,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  );
});

/**
 * DELETE /projects/:projectId/repos/:repoId
 *
 * Unlink a repository from a project.
 * Requires admin role.
 */
codingAgent.delete('/projects/:projectId/repos/:repoId', async (c) => {
  const projectId = c.req.param('projectId');
  const repoId = c.req.param('repoId');
  const user = c.get('user');

  // Verify user is admin
  const membership = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.projectId, projectId),
      eq(schema.projectMembers.userId, user.sub)
    ),
  });

  if (!membership || membership.role !== 'admin') {
    throw new ApiError(
      403,
      'coding-agent/admin-required',
      'Admin Required',
      'Only project admins can unlink repositories'
    );
  }

  // Find the linked repo
  const linkedRepo = await db.query.linkedRepos.findFirst({
    where: and(eq(schema.linkedRepos.id, repoId), eq(schema.linkedRepos.projectId, projectId)),
  });

  if (!linkedRepo) {
    throw new ApiError(
      404,
      'coding-agent/repo-not-found',
      'Repository Not Found',
      'The specified repository is not linked to this project'
    );
  }

  // Delete the linked repo
  await db.delete(schema.linkedRepos).where(eq(schema.linkedRepos.id, repoId));

  logger.info(
    { projectId, repoId, owner: linkedRepo.owner, repo: linkedRepo.repo, userId: user.sub },
    'GitHub repository unlinked'
  );

  return c.json(createResponse({ success: true }));
});

// --- Coding fix routes ---

const requestFixSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters'),
});

/**
 * POST /tasks/:taskId/fix
 *
 * Request a coding fix for a task.
 * Requires lead/admin/pm role.
 */
codingAgent.post('/tasks/:taskId/fix', zValidator('json', requestFixSchema), async (c) => {
  const taskId = c.req.param('taskId');
  const user = c.get('user');
  const body = c.req.valid('json');

  // Get the task to check project membership
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

  // Verify user role (lead/admin/pm) - role check is in service
  const membership = await db.query.projectMembers.findFirst({
    where: and(
      eq(schema.projectMembers.projectId, task.projectId),
      eq(schema.projectMembers.userId, user.sub)
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
  if (userTier > 2) {
    throw new ApiError(
      403,
      'coding-agent/unauthorized-role',
      'Unauthorized Role',
      'Only Admin, PM, or Squad Lead can authorize coding fixes'
    );
  }

  // Request the fix
  const requestId = await requestCodingFix({
    taskId,
    description: body.description,
    authorizedById: user.sub,
  });

  logger.info({ taskId, requestId, userId: user.sub }, 'Coding fix requested');

  return c.json(
    createResponse({
      requestId,
      status: 'pending',
      message: 'Coding fix request queued for processing',
    }),
    202
  );
});

/**
 * GET /tasks/:taskId/fix
 *
 * Get the latest coding request status for a task.
 */
codingAgent.get('/tasks/:taskId/fix', async (c) => {
  const taskId = c.req.param('taskId');

  // Get the task
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

  // Get the latest coding request
  const request = await getLatestCodingRequestForTask(taskId);

  if (!request) {
    return c.json(
      createResponse({
        hasRequest: false,
      })
    );
  }

  return c.json(
    createResponse({
      hasRequest: true,
      request: {
        id: request.id,
        status: request.status,
        branchName: request.branchName,
        prNumber: request.prNumber,
        prUrl: request.prUrl,
        errorMessage: request.errorMessage,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
      },
    })
  );
});

export { codingAgent as codingAgentRoutes };
