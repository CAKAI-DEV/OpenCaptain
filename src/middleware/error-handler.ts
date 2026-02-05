import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { logger } from '../lib/logger.ts';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

export class ApiError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public type: string,
    public title: string,
    public detail?: string
  ) {
    super(title);
    this.name = 'ApiError';
  }

  toProblemDetails(instance?: string): ProblemDetails {
    return {
      type: `https://blockbot.dev/errors/${this.type}`,
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance,
    };
  }
}

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    const instance = c.req.path;

    // Check for ApiError by name property (more reliable across module boundaries)
    if (err instanceof Error && err.name === 'ApiError') {
      const apiErr = err as ApiError;
      logger.warn({ err, path: instance }, 'API error');
      c.header('Content-Type', 'application/problem+json');
      return c.json(apiErr.toProblemDetails(instance), apiErr.status);
    }

    if (err instanceof HTTPException) {
      const problem: ProblemDetails = {
        type: 'https://blockbot.dev/errors/http-exception',
        title: err.message || 'HTTP Exception',
        status: err.status,
        instance,
      };
      c.header('Content-Type', 'application/problem+json');
      return c.json(problem, err.status);
    }

    // Unexpected error
    logger.error({ err, path: instance }, 'Unexpected error');
    const problem: ProblemDetails = {
      type: 'https://blockbot.dev/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      instance,
    };
    c.header('Content-Type', 'application/problem+json');
    return c.json(problem, 500);
  }
}
