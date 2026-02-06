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
  // S3-compatible storage (optional - file uploads disabled if not configured)
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  // Telegram Bot (optional - messaging disabled if not configured)
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  // WhatsApp Cloud API (optional - messaging disabled if not configured)
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  // Linear Integration (optional - bidirectional sync disabled if not configured)
  LINEAR_WEBHOOK_SECRET: z.string().optional(),
  // GitHub App (optional - coding agent disabled if not configured)
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
});

export const env = envSchema.parse(Bun.env);
export type Env = z.infer<typeof envSchema>;
