CREATE TABLE "visibility_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grantee_user_id" uuid NOT NULL,
	"squad_id" uuid NOT NULL,
	"granted_by_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visibility_grants_grantee_user_id_squad_id_unique" UNIQUE("grantee_user_id","squad_id")
);
--> statement-breakpoint
ALTER TABLE "visibility_grants" ADD CONSTRAINT "visibility_grants_grantee_user_id_users_id_fk" FOREIGN KEY ("grantee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visibility_grants" ADD CONSTRAINT "visibility_grants_squad_id_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "public"."squads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visibility_grants" ADD CONSTRAINT "visibility_grants_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;