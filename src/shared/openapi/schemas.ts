import { z } from '@hono/zod-openapi';

// Common schemas
export const ErrorSchema = z.object({
  type: z.string().openapi({ example: 'https://opencaptain.dev/errors/auth/invalid-credentials' }),
  title: z.string().openapi({ example: 'Invalid Credentials' }),
  status: z.number().openapi({ example: 401 }),
  detail: z.string().optional().openapi({ example: 'Email or password is incorrect' }),
  instance: z.string().optional().openapi({ example: '/api/v1/auth/login' }),
});

export const UserSchema = z.object({
  id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  orgId: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174001' }),
});

export const TokensSchema = z.object({
  accessToken: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIs...' }),
  refreshToken: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIs...' }),
});

export const AuthResponseSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});

// Auth request schemas
export const RegisterRequestSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com' }),
  password: z.string().min(8).openapi({ example: 'securepassword123' }),
  orgName: z.string().min(1).max(255).openapi({ example: 'My Organization' }),
});

export const LoginRequestSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com' }),
  password: z.string().openapi({ example: 'securepassword123' }),
});

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIs...' }),
});

export const MagicLinkRequestSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com' }),
});

// Health schemas
export const HealthCheckSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  latency: z.number().optional(),
  error: z.string().optional(),
});

export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  version: z.string(),
  checks: z.object({
    database: HealthCheckSchema,
    redis: HealthCheckSchema,
  }),
});

export const SimpleHealthSchema = z.object({
  status: z.string().openapi({ example: 'ok' }),
  timestamp: z.string().optional(),
});
