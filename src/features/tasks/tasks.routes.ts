import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../../shared/middleware/error-handler';
import { createPaginatedResponse, createResponse } from '../../shared/types';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import * as tasksService from './tasks.service';

const tasks = new Hono();

// All routes require authentication and visibility
tasks.use('*', authMiddleware);
tasks.use('*', visibilityMiddleware);

// Validation schemas
const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  squadId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().uuid().optional(),
  dueDate: z
    .string()
    .datetime()
    .transform((s) => new Date(s))
    .optional(),
  customFieldValues: z.record(z.string(), z.unknown()).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .datetime()
    .transform((s) => new Date(s))
    .nullable()
    .optional(),
  squadId: z.string().uuid().nullable().optional(),
  customFieldValues: z.record(z.string(), z.unknown()).optional(),
});

const listTasksQuerySchema = z.object({
  projectId: z.string().uuid(),
  squadId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  parentTaskId: z
    .string()
    .transform((val) => (val === 'null' ? null : val))
    .optional(),
  page: z
    .string()
    .default('1')
    .transform((val) => Number.parseInt(val, 10)),
  limit: z
    .string()
    .default('20')
    .transform((val) => Math.min(Number.parseInt(val, 10), 100)),
});

const taskIdParamSchema = z.object({
  taskId: z.string().uuid(),
});

// POST / - Create task
tasks.post('/', zValidator('json', createTaskSchema), async (c) => {
  const input = c.req.valid('json');
  const user = c.get('user');

  const task = await tasksService.createTask(input, user.sub);

  return c.json(createResponse(task), 201);
});

// GET / - List tasks
tasks.get('/', zValidator('query', listTasksQuerySchema), async (c) => {
  const { projectId, squadId, assigneeId, status, parentTaskId, page, limit } =
    c.req.valid('query');

  const result = await tasksService.listTasks(
    projectId,
    {
      squadId,
      assigneeId,
      status,
      parentTaskId,
    },
    { page, limit }
  );

  return c.json(
    createPaginatedResponse(result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    })
  );
});

// GET /:taskId - Get single task with subtasks
tasks.get('/:taskId', zValidator('param', taskIdParamSchema), async (c) => {
  const { taskId } = c.req.valid('param');

  const task = await tasksService.getTask(taskId);

  if (!task) {
    throw new ApiError(
      404,
      'tasks/not-found',
      'Task Not Found',
      'The requested task does not exist'
    );
  }

  return c.json(createResponse(task));
});

// PATCH /:taskId - Update task
tasks.patch(
  '/:taskId',
  zValidator('param', taskIdParamSchema),
  zValidator('json', updateTaskSchema),
  async (c) => {
    const { taskId } = c.req.valid('param');
    const input = c.req.valid('json');
    const user = c.get('user');

    const task = await tasksService.updateTask(taskId, input, user.sub);

    return c.json(createResponse(task));
  }
);

// DELETE /:taskId - Delete task
tasks.delete('/:taskId', zValidator('param', taskIdParamSchema), async (c) => {
  const { taskId } = c.req.valid('param');
  const user = c.get('user');

  await tasksService.deleteTask(taskId, user.sub);

  return c.body(null, 204);
});

export { tasks as tasksRoutes };
