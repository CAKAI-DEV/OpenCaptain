import { randomBytes } from 'node:crypto';
import type { Context, Next } from 'hono';

const REQUEST_ID_HEADER = 'X-Request-ID';

/**
 * Generates a unique request ID or uses the one provided in the request header.
 * The request ID is set on the context and added to the response headers.
 */
export async function requestIdMiddleware(c: Context, next: Next) {
  const existingId = c.req.header(REQUEST_ID_HEADER);
  const requestId = existingId || generateRequestId();

  // Set on context for use in logging and other middleware
  c.set('requestId', requestId);

  // Add to response headers
  c.header(REQUEST_ID_HEADER, requestId);

  await next();
}

function generateRequestId(): string {
  return randomBytes(16).toString('hex');
}

// Type augmentation for Hono context
declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}
