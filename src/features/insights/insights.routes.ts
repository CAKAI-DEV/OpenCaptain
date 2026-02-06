/**
 * Insights API routes for accessing generated insights and suggestions.
 *
 * Endpoints:
 * - GET /api/v1/projects/:projectId/insights - Get insights for project (role-scoped)
 * - GET /api/v1/projects/:projectId/insights/suggestions - Get suggestions for user
 * - POST /api/v1/projects/:projectId/insights/generate - Trigger insight generation (admin only)
 */
import { zValidator } from '@hono/zod-validator';
import dayjs from 'dayjs';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError } from '../../shared/middleware';
import { createResponse } from '../../shared/types';
import { authMiddleware } from '../auth/auth.middleware';
import { visibilityMiddleware } from '../visibility/visibility.middleware';
import {
  generateInsights,
  generateSuggestions,
  getInsightsForRole,
  getUserProjectRole,
  getUserSquad,
} from './insights.service';
import type { SuggestionContext } from './insights.types';

const insights = new Hono();

// All routes require authentication and visibility
insights.use('*', authMiddleware);
insights.use('*', visibilityMiddleware);

// Helper to parse date string to Date object
const dateString = z.string().transform((s) => dayjs(s).toDate());

// Query schema for insights
const insightsQuerySchema = z.object({
  startDate: dateString.optional(),
  endDate: dateString.optional(),
});

// Body schema for generate endpoint
const generateBodySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * GET /projects/:projectId/insights
 *
 * Get insights for a project, scoped by user role:
 * - Admin/PM: All project insights
 * - Squad lead: Squad insights
 * - Member: Personal insights
 */
insights.get('/:projectId/insights', zValidator('query', insightsQuerySchema), async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');
  const query = c.req.valid('query');

  // Default to last 7 days if not specified
  const endDate = query.endDate ?? new Date();
  const startDate = query.startDate ?? dayjs(endDate).subtract(7, 'day').toDate();

  // Get user's role and appropriate scope
  const role = await getUserProjectRole(projectId, user.sub);
  const squadId = await getUserSquad(projectId, user.sub);
  const { scopeType, scopeId } = await getInsightsForRole(projectId, user.sub, role, squadId);

  // Generate insights for this scope
  const insightsResult = await generateInsights({
    projectId,
    scopeType,
    scopeId,
    timeRange: { start: startDate, end: endDate },
  });

  // Serialize dates for JSON
  const serialized = insightsResult.map((insight) => ({
    ...insight,
    timeRange: {
      start: insight.timeRange.start.toISOString(),
      end: insight.timeRange.end.toISOString(),
    },
    createdAt: insight.createdAt.toISOString(),
  }));

  return c.json(
    createResponse({
      insights: serialized,
      scope: { type: scopeType, id: scopeId },
      role,
    })
  );
});

/**
 * GET /projects/:projectId/insights/suggestions
 *
 * Get actionable suggestions for the current user based on recent insights.
 */
insights.get('/:projectId/insights/suggestions', async (c) => {
  const projectId = c.req.param('projectId');
  const user = c.get('user');

  // Get user's role and squad
  const role = await getUserProjectRole(projectId, user.sub);
  const squadId = await getUserSquad(projectId, user.sub);

  // Get recent insights for context
  const endDate = new Date();
  const startDate = dayjs(endDate).subtract(7, 'day').toDate();
  const { scopeType, scopeId } = await getInsightsForRole(projectId, user.sub, role, squadId);

  const recentInsights = await generateInsights({
    projectId,
    scopeType,
    scopeId,
    timeRange: { start: startDate, end: endDate },
  });

  // Generate suggestions
  const context: SuggestionContext = {
    projectId,
    userId: user.sub,
    role,
    recentInsights,
    squadId,
  };

  const suggestions = await generateSuggestions(context);

  return c.json(createResponse({ suggestions }));
});

/**
 * POST /projects/:projectId/insights/generate
 *
 * Manually trigger insight generation for a project.
 * Restricted to admin/PM roles.
 */
insights.post(
  '/:projectId/insights/generate',
  zValidator('json', generateBodySchema),
  async (c) => {
    const projectId = c.req.param('projectId');
    const user = c.get('user');
    const body = c.req.valid('json');

    // Check if user is admin/PM
    const role = await getUserProjectRole(projectId, user.sub);
    if (role !== 'admin' && role !== 'pm') {
      throw new ApiError(403, 'Forbidden', 'Only admin or PM can trigger insight generation');
    }

    // Parse dates or default to last 7 days
    const endDate = body.endDate ? dayjs(body.endDate).toDate() : new Date();
    const startDate = body.startDate
      ? dayjs(body.startDate).toDate()
      : dayjs(endDate).subtract(7, 'day').toDate();

    // Generate project-wide insights
    const insightsResult = await generateInsights({
      projectId,
      scopeType: 'project',
      scopeId: projectId,
      timeRange: { start: startDate, end: endDate },
    });

    // Serialize dates for JSON
    const serialized = insightsResult.map((insight) => ({
      ...insight,
      timeRange: {
        start: insight.timeRange.start.toISOString(),
        end: insight.timeRange.end.toISOString(),
      },
      createdAt: insight.createdAt.toISOString(),
    }));

    return c.json(
      createResponse({
        insights: serialized,
        generated: insightsResult.length,
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      }),
      201
    );
  }
);

export { insights as insightsRoutes };
