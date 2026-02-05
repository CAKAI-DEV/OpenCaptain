ALTER TABLE "organizations" ADD COLUMN "llm_model" text DEFAULT 'gpt-4o';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "llm_fallback_model" text DEFAULT 'claude-3-5-sonnet';