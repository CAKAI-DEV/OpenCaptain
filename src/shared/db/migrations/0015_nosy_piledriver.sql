CREATE TYPE "public"."coding_request_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."linear_sync_direction" AS ENUM('to_linear', 'from_linear', 'bidirectional');--> statement-breakpoint
CREATE TABLE "blockers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"reported_by_id" uuid NOT NULL,
	"task_id" uuid,
	"description" text NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"resolved_by_id" uuid,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"escalation_block_id" uuid NOT NULL,
	"trigger_type" varchar(50) NOT NULL,
	"blocker_id" uuid,
	"target_user_id" uuid NOT NULL,
	"task_id" uuid,
	"current_step" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_escalated_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_in_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"cron_pattern" varchar(50) NOT NULL,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"questions" jsonb NOT NULL,
	"template_id" varchar(50),
	"target_type" varchar(20) DEFAULT 'all' NOT NULL,
	"target_squad_id" uuid,
	"target_role" varchar(50),
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_in_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_in_block_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"responses" jsonb,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"trigger_type" varchar(50) NOT NULL,
	"deadline_warning_days" integer,
	"output_threshold" integer,
	"output_period_days" integer,
	"target_type" varchar(20) DEFAULT 'all' NOT NULL,
	"target_squad_id" uuid,
	"target_role" varchar(50),
	"escalation_steps" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "linked_repos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"owner" varchar(255) NOT NULL,
	"repo" varchar(255) NOT NULL,
	"installation_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text DEFAULT 'Default Workflow' NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflows_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_instances" ADD CONSTRAINT "escalation_instances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_instances" ADD CONSTRAINT "escalation_instances_escalation_block_id_escalation_blocks_id_fk" FOREIGN KEY ("escalation_block_id") REFERENCES "public"."escalation_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_instances" ADD CONSTRAINT "escalation_instances_blocker_id_blockers_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."blockers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_instances" ADD CONSTRAINT "escalation_instances_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_instances" ADD CONSTRAINT "escalation_instances_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_blocks" ADD CONSTRAINT "check_in_blocks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_blocks" ADD CONSTRAINT "check_in_blocks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_blocks" ADD CONSTRAINT "check_in_blocks_target_squad_id_squads_id_fk" FOREIGN KEY ("target_squad_id") REFERENCES "public"."squads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_responses" ADD CONSTRAINT "check_in_responses_check_in_block_id_check_in_blocks_id_fk" FOREIGN KEY ("check_in_block_id") REFERENCES "public"."check_in_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_responses" ADD CONSTRAINT "check_in_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_blocks" ADD CONSTRAINT "escalation_blocks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_blocks" ADD CONSTRAINT "escalation_blocks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalation_blocks" ADD CONSTRAINT "escalation_blocks_target_squad_id_squads_id_fk" FOREIGN KEY ("target_squad_id") REFERENCES "public"."squads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_requests" ADD CONSTRAINT "coding_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_requests" ADD CONSTRAINT "coding_requests_linked_repo_id_linked_repos_id_fk" FOREIGN KEY ("linked_repo_id") REFERENCES "public"."linked_repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coding_requests" ADD CONSTRAINT "coding_requests_authorized_by_id_users_id_fk" FOREIGN KEY ("authorized_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_repos" ADD CONSTRAINT "linked_repos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_integrations" ADD CONSTRAINT "linear_integrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_sync_metadata" ADD CONSTRAINT "linear_sync_metadata_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blockers_project_id_idx" ON "blockers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "blockers_reported_by_id_idx" ON "blockers" USING btree ("reported_by_id");--> statement-breakpoint
CREATE INDEX "blockers_status_idx" ON "blockers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blockers_task_id_idx" ON "blockers" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "blockers_created_at_idx" ON "blockers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "escalation_instances_project_id_idx" ON "escalation_instances" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "escalation_instances_blocker_id_idx" ON "escalation_instances" USING btree ("blocker_id");--> statement-breakpoint
CREATE INDEX "escalation_instances_status_idx" ON "escalation_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "escalation_instances_target_user_id_idx" ON "escalation_instances" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "escalation_instances_started_at_idx" ON "escalation_instances" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "check_in_blocks_project_id_idx" ON "check_in_blocks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "check_in_blocks_enabled_idx" ON "check_in_blocks" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "check_in_responses_block_id_idx" ON "check_in_responses" USING btree ("check_in_block_id");--> statement-breakpoint
CREATE INDEX "check_in_responses_user_id_idx" ON "check_in_responses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "check_in_responses_status_idx" ON "check_in_responses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "check_in_responses_sent_at_idx" ON "check_in_responses" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "escalation_blocks_project_id_idx" ON "escalation_blocks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "escalation_blocks_trigger_type_idx" ON "escalation_blocks" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "escalation_blocks_enabled_idx" ON "escalation_blocks" USING btree ("enabled");