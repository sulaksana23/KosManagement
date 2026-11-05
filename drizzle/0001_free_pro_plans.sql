CREATE TYPE "public"."organization_plan" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."plan_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "plan" "organization_plan" DEFAULT 'free' NOT NULL;--> statement-breakpoint
CREATE TABLE "plan_request" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"requested_by" text NOT NULL,
	"status" "plan_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "plan_request" ADD CONSTRAINT "plan_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_request" ADD CONSTRAINT "plan_request_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_request" ADD CONSTRAINT "plan_request_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_request_organization_status_created_idx" ON "plan_request" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "plan_request_requester_idx" ON "plan_request" USING btree ("requested_by");
