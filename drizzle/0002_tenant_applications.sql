CREATE TYPE "public"."tenant_application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "tenant_application" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"room_id" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text NOT NULL,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"desired_move_in" date NOT NULL,
	"note" text,
	"status" "tenant_application_status" DEFAULT 'pending' NOT NULL,
	"tenant_id" text,
	"review_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_application" ADD CONSTRAINT "tenant_application_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_application" ADD CONSTRAINT "tenant_application_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_application" ADD CONSTRAINT "tenant_application_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_application" ADD CONSTRAINT "tenant_application_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_application" ADD CONSTRAINT "tenant_application_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_application_org_status_created_idx" ON "tenant_application" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "tenant_application_room_status_movein_idx" ON "tenant_application" USING btree ("room_id","status","desired_move_in");