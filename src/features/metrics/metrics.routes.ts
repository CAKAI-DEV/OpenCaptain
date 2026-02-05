import { zValidator } from '@hono/zod-validator';
import dayjs from 'dayjs';
import { Hono } from 'hono';
import { z } from 'zod';
import { createResponse } from '../../shared/types';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import * as metricsService from './metrics.service';

const metrics = new Hono();

// All routes require authentication and visibility
metrics.use('*', authMiddleware);
metrics.use('*', visibilityMiddleware);

// Helper to parse date string to Date object
const dateString = z.string().transform((s) => dayjs(s).toDate());

// Validation schemas
const outputQuerySchema = z.object({
  projectId: z.string().uuid(),
  startDate: dateString,
  endDate: dateString,
  squadId: z.string().uuid().optional(),
});

const velocityQuerySchema = z.object({
  projectId: z.string().uuid(),
  periodDays: z
    .string()
    .default('7')
    .transform((s) => Number.parseInt(s, 10))
    .pipe(z.number().min(1).max(90)),
  numPeriods: z
    .string()
    .default('4')
    .transform((s) => Number.parseInt(s, 10))
    .pipe(z.number().min(1).max(52)),
});

const burndownQuerySchema = z.object({
  projectId: z.string().uuid(),
  startDate: dateString,
  endDate: dateString,
  squadId: z.string().uuid().optional(),
});

const personalQuerySchema = z.object({
  projectId: z.string().uuid(),
  startDate: dateString,
  endDate: dateString,
});

// GET /output - Get output metrics (completed tasks/deliverables)
metrics.get('/output', zValidator('query', outputQuerySchema), async (c) => {
  const { projectId, startDate, endDate, squadId } = c.req.valid('query');

  const result = await metricsService.getOutputMetrics(projectId, startDate, endDate, squadId);

  return c.json(createResponse(result));
});

// GET /velocity - Get velocity over time periods
metrics.get('/velocity', zValidator('query', velocityQuerySchema), async (c) => {
  const { projectId, periodDays, numPeriods } = c.req.valid('query');

  const result = await metricsService.getVelocity(projectId, periodDays, numPeriods);

  // Convert dates to ISO strings for JSON serialization
  const serialized = result.map((period) => ({
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString(),
    velocity: period.velocity,
  }));

  return c.json(createResponse(serialized));
});

// GET /burndown - Get burndown chart data
metrics.get('/burndown', zValidator('query', burndownQuerySchema), async (c) => {
  const { projectId, startDate, endDate, squadId } = c.req.valid('query');

  const result = await metricsService.getBurndownData(projectId, startDate, endDate, squadId);

  return c.json(createResponse(result));
});

// GET /personal - Get personal metrics for current user
metrics.get('/personal', zValidator('query', personalQuerySchema), async (c) => {
  const { projectId, startDate, endDate } = c.req.valid('query');
  const user = c.get('user');

  const result = await metricsService.getPersonalMetrics(user.sub, projectId, startDate, endDate);

  return c.json(createResponse(result));
});

export { metrics as metricsRoutes };
