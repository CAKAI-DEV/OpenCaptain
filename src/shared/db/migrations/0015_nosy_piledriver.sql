-- Phase 8: Workflow Builder & Integrations
-- New tables only (check_in_*, escalation_*, blockers already created in 0013/0014)

CREATE TYPE "public"."coding_request_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."linear_sync_direction" AS ENUM('to_linear', 'from_linear', 'bidirectional');--> statement-breakpoint

CREATE TABLE "coding_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"linked_repo_id" uuid NOT NULL,
	"authorized_by_id" uuid NOT NULL,
	"description" text NOT NULL,
	"status" "coding_request_status" DEFAULT 'pending' NOT NULL,
	"branch_name" varchar(255),
	"pr_number" integer,
	"pr_url" varchar(500),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "linked_repos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"owner" varchar(255) NOT NULL,
	"repo" varchar(255) NOT NULL,
	"installation_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "linear_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"team_id" varchar(100) NOT NULL,
	"status_mappings" jsonb DEFAULT '[]'::jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"webhook_id" varchar(100),
	"webhook_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "linear_integrations_project_id_unique" UNIQUE("project_id")
);--> statement-breakpoint

CREATE TABLE "linear_sync_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"linear_issue_id" varchar(100) NOT NULL,
	"linear_team_id" varchar(100) NOT NULL,
	"linear_identifier" varchar(50),
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_direction" "linear_sync_direction" DEFAULT 'to_linear' NOT NULL,
	"last_local_updated_at" timestamp with time zone,
	"last_linear_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "linear_sync_metadata_task_id_unique" UNIQUE("task_id"),
	CONSTRAINT "linear_sync_metadata_linear_issue_id_unique" UNIQUE("linear_issue_id")
);--> statement-breakpoint

CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text DEFAULT 'Default Workflow' NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflows_project_id_unique" UNIQUE("project_id")
);--> statement-breakpoint

-- Foreign keys for new tables
ALTER TABLE "coding_requests" ADD CONSTRAINT "coding_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_requests" ADD CONSTRAINT "coding_requests_linked_repo_id_linked_repos_id_fk" FOREIGN KEY ("linked_repo_id") REFERENCES "public"."linked_repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_requests" ADD CONSTRAINT "coding_requests_authorized_by_id_users_id_fk" FOREIGN KEY ("authorized_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_repos" ADD CONSTRAINT "linked_repos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_integrations" ADD CONSTRAINT "linear_integrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_sync_metadata" ADD CONSTRAINT "linear_sync_metadata_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
