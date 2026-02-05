import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  RESEND_API_KEY: z.string().startsWith('re_'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  // LiteLLM configuration
  LITELLM_URL: z.string().url().default('http://localhost:4010'),
  LITELLM_API_KEY: z.string().default('sk-test-key-for-development'),
  // Provider API keys (optional - users may only configure one provider)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(Bun.env);
export type Env = z.infer<typeof envSchema>;
