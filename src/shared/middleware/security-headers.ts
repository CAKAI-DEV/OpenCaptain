import type { Context, Next } from 'hono';

/**
 * Adds security headers to all responses.
 * Similar to helmet.js but lightweight.
 */
export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next();

  // Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');

  // Enable XSS filter in older browsers
  c.header('X-XSS-Protection', '1; mode=block');

  // Disable caching for API responses
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');

  // Referrer policy
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (disable sensitive features)
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

  // Content Security Policy for API (restrictive)
  c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

  // Strict Transport Security (HTTPS only)
  // Only set in production to avoid issues during local development
  if (process.env.NODE_ENV === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}
