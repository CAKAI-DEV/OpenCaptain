import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../../shared/middleware/error-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { createProject, getProjectById, getProjectsByOrg } from './projects.service';

const projects = new Hono();

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

// POST /projects - Create project (auth required)
projects.post('/', authMiddleware, zValidator('json', createProjectSchema), async (c) => {
  const { name, description } = c.req.valid('json');
  const user = c.get('user');

  const project = await createProject({
    orgId: user.org,
    name,
    description,
  });

  return c.json(project, 201);
});

// GET /projects - List projects for org (auth required)
projects.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const projectList = await getProjectsByOrg(user.org);
  return c.json(projectList);
});

// GET /projects/:id - Get project by ID (auth required)
projects.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const project = await getProjectById(id, user.org);

  if (!project) {
    throw new ApiError(
      404,
      'projects/not-found',
      'Project Not Found',
      'The requested project does not exist or you do not have access to it'
    );
  }

  return c.json(project);
});

export { projects as projectRoutes };
