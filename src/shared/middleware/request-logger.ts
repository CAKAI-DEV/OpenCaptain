import type { Context, Next } from 'hono';
import { logger } from '../lib/logger';

/**
 * Logs all incoming requests with method, path, status, and timing.
 */
export async function requestLoggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = c.get('requestId') || 'unknown';

  // Log request start
  logger.info(
    {
      requestId,
      method,
      path,
      userAgent: c.req.header('user-agent'),
    },
    'Incoming request'
  );

  try {
    await next();
  } catch (err) {
    const duration = Date.now() - start;
    logger.error(
      {
        requestId,
        method,
        path,
        duration,
        err,
      },
      'Request failed'
    );
    throw err;
  }

  const duration = Date.now() - start;
  const status = c.res.status;

  // Log based on status code
  const logData = {
    requestId,
    method,
    path,
    status,
    duration,
  };

  if (status >= 500) {
    logger.error(logData, 'Request completed with server error');
  } else if (status >= 400) {
    logger.warn(logData, 'Request completed with client error');
  } else {
    logger.info(logData, 'Request completed');
  }
}
