CREATE TYPE "public"."work_record_kind" AS ENUM('program', 'public_work', 'policy', 'institutional', 'international', 'other');--> statement-breakpoint
CREATE TYPE "public"."work_record_status" AS ENUM('announced', 'in_progress', 'completed', 'cancelled', 'unknown');--> statement-breakpoint
ALTER TYPE "public"."claim_type" ADD VALUE 'work_record_item';--> statement-breakpoint
CREATE TABLE "work_record_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"politician_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "work_record_kind" NOT NULL,
	"status" "work_record_status" DEFAULT 'unknown' NOT NULL,
	"topic" text NOT NULL,
	"office" text,
	"description" text NOT NULL,
	"start_date" date,
	"start_date_precision" date_precision,
	"end_date" date,
	"end_date_precision" date_precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_record_items_start_precision" CHECK (("work_record_items"."start_date" is null) = ("work_record_items"."start_date_precision" is null)),
	CONSTRAINT "work_record_items_end_precision" CHECK (("work_record_items"."end_date" is null) = ("work_record_items"."end_date_precision" is null)),
	CONSTRAINT "work_record_items_period_order" CHECK ("work_record_items"."start_date" is null or "work_record_items"."end_date" is null or "work_record_items"."end_date" >= "work_record_items"."start_date")
);
--> statement-breakpoint
ALTER TABLE "work_record_items" ADD CONSTRAINT "work_record_items_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_record_items_politician_id_index" ON "work_record_items" USING btree ("politician_id");