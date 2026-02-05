CREATE TABLE "dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_type" varchar(20) NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_type" varchar(20) NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dependencies_blocker_type_blocker_id_blocked_type_blocked_id_unique" UNIQUE("blocker_type","blocker_id","blocked_type","blocked_id")
);
--> statement-breakpoint
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;