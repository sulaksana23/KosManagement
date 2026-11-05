CREATE TYPE "public"."reminder_log_status" AS ENUM('processing', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "invoice_reminder_log" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"days_from_due" integer NOT NULL,
	"scheduled_for" date NOT NULL,
	"status" "reminder_log_status" DEFAULT 'processing' NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "private_file" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"payment_id" text,
	"ticket_id" text,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "private_file_single_parent_check" CHECK (("private_file"."payment_id" IS NOT NULL) <> ("private_file"."ticket_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "reminders_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "reminder_days_before" integer[] DEFAULT '{3}' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "reminder_days_after" integer[] DEFAULT '{1,7}' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_reminder_log" ADD CONSTRAINT "invoice_reminder_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reminder_log" ADD CONSTRAINT "invoice_reminder_log_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_file" ADD CONSTRAINT "private_file_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_file" ADD CONSTRAINT "private_file_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_file" ADD CONSTRAINT "private_file_ticket_id_maintenance_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."maintenance_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_file" ADD CONSTRAINT "private_file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_reminder_occurrence_unique" ON "invoice_reminder_log" USING btree ("invoice_id","days_from_due","scheduled_for");--> statement-breakpoint
CREATE INDEX "invoice_reminder_organization_date_idx" ON "invoice_reminder_log" USING btree ("organization_id","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "private_file_payment_unique" ON "private_file" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "private_file_ticket_unique" ON "private_file" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "private_file_organization_idx" ON "private_file" USING btree ("organization_id","created_at");