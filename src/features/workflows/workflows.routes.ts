import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { createResponse } from '../../shared/types';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import { getWorkflow, saveWorkflow } from './workflows.service';
import { saveWorkflowBodySchema } from './workflows.types';

const workflows = new Hono();

// All routes require authentication and visibility
workflows.use('*', authMiddleware);
workflows.use('*', visibilityMiddleware);

/**
 * GET /projects/:projectId/workflows
 * Get workflow configuration for a project.
 */
workflows.get('/:projectId/workflows', async (c) => {
  const projectId = c.req.param('projectId');

  const workflow = await getWorkflow(projectId);

  // Return empty workflow if none exists (new project)
  if (!workflow) {
    return c.json(
      createResponse({
        workflow: null,
        nodes: [],
        edges: [],
      })
    );
  }

  return c.json(
    createResponse({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        createdAt: workflow.createdAt.toISOString(),
        updatedAt: workflow.updatedAt.toISOString(),
      },
      nodes: workflow.nodes,
      edges: workflow.edges,
    })
  );
});

/**
 * POST /projects/:projectId/workflows
 * Save (create or update) workflow configuration.
 * Requires admin or PM role.
 */
workflows.post('/:projectId/workflows', zValidator('json', saveWorkflowBodySchema), async (c) => {
  const projectId = c.req.param('projectId');
  const body = c.req.valid('json');

  // TODO: In future, check if user is admin/PM for this project
  // For now, visibility middleware ensures user can see the project

  const workflow = await saveWorkflow(projectId, body);

  return c.json(
    createResponse({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        createdAt: workflow.createdAt.toISOString(),
        updatedAt: workflow.updatedAt.toISOString(),
      },
      nodes: workflow.nodes,
      edges: workflow.edges,
    }),
    201
  );
});

export { workflows as workflowsRoutes };
