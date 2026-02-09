import { swaggerUI } from '@hono/swagger-ui';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  AuthResponseSchema,
  ErrorSchema,
  HealthResponseSchema,
  LoginRequestSchema,
  MagicLinkRequestSchema,
  RefreshRequestSchema,
  RegisterRequestSchema,
  SimpleHealthSchema,
  TokensSchema,
} from '../../shared/openapi';

const docs = new OpenAPIHono();

// Define OpenAPI routes for documentation
const registerRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/register',
  tags: ['Authentication'],
  summary: 'Register a new user',
  description: 'Creates a new user account and organization',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RegisterRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: {
        'application/json': {
          schema: AuthResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/problem+json': {
          schema: ErrorSchema,
        },
      },
    },
    409: {
      description: 'Email already exists',
      content: {
        'application/problem+json': {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const loginRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['Authentication'],
  summary: 'Login with email and password',
  description: 'Authenticates a user and returns access/refresh tokens',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: AuthResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/problem+json': {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/refresh',
  tags: ['Authentication'],
  summary: 'Refresh access token',
  description: 'Exchanges a refresh token for new access/refresh tokens',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RefreshRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Tokens refreshed',
      content: {
        'application/json': {
          schema: TokensSchema,
        },
      },
    },
    401: {
      description: 'Invalid refresh token',
      content: {
        'application/problem+json': {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['Authentication'],
  summary: 'Logout user',
  description: 'Revokes all refresh tokens for the authenticated user',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Logged out successfully',
      content: {
        'application/json': {
          schema: SimpleHealthSchema,
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/problem+json': {
          schema: ErrorSchema,
        },
      },
    },
  },
});

const magicLinkRequestRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/magic-link/request',
  tags: ['Authentication'],
  summary: 'Request a magic link',
  description: 'Sends a magic link to the user email for passwordless login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: MagicLinkRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Magic link sent (or user does not exist)',
      content: {
        'application/json': {
          schema: SimpleHealthSchema,
        },
      },
    },
  },
});

const healthRoute = createRoute({
  method: 'get',
  path: '/api/v1/health',
  tags: ['Health'],
  summary: 'Detailed health check',
  description: 'Returns detailed health status of all services',
  responses: {
    200: {
      description: 'Health status',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

// Register route definitions (for OpenAPI spec generation only)
docs.openapi(registerRoute, (c) => c.json({} as never));
docs.openapi(loginRoute, (c) => c.json({} as never));
docs.openapi(refreshRoute, (c) => c.json({} as never));
docs.openapi(logoutRoute, (c) => c.json({} as never));
docs.openapi(magicLinkRequestRoute, (c) => c.json({} as never));
docs.openapi(healthRoute, (c) => c.json({} as never));

// OpenAPI JSON endpoint
docs.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'OpenCaptain API',
    version: '0.1.0',
    description: 'Self-hosted project management agent API',
    contact: {
      name: 'OpenCaptain',
      url: 'https://opencaptain.dev',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  tags: [
    { name: 'Authentication', description: 'User authentication endpoints' },
    { name: 'Health', description: 'Health check endpoints' },
  ],
});

// Swagger UI
docs.get(
  '/',
  swaggerUI({
    url: '/docs/openapi.json',
  })
);

export { docs as docsRoutes };
