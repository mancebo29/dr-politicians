CREATE TYPE "public"."ranking_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."refresh_proposal_status" AS ENUM('pending', 'approved', 'dismissed');--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outlet_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "page_views_daily" (
	"politician_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "page_views_daily_politician_id_day_pk" PRIMARY KEY("politician_id","day")
);
--> statement-breakpoint
CREATE TABLE "ranking_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" date NOT NULL,
	"status" "ranking_run_status" DEFAULT 'running' NOT NULL,
	"trigger" text NOT NULL,
	"source" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"articles_ingested" integer,
	"politicians_ranked" integer,
	"refresh_proposed" integer,
	"warnings" text[] DEFAULT '{}'::text[] NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"politician_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"profile_updated_at" timestamp with time zone NOT NULL,
	"status" "refresh_proposal_status" DEFAULT 'pending' NOT NULL,
	"job_id" uuid,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_proposals_decision" CHECK (("refresh_proposals"."status" = 'pending') = ("refresh_proposals"."decided_at" is null))
);
--> statement-breakpoint
ALTER TABLE "popularity_snapshots" ADD COLUMN "no_recent_data" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "page_views_daily" ADD CONSTRAINT "page_views_daily_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_proposals" ADD CONSTRAINT "refresh_proposals_run_id_ranking_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ranking_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_proposals" ADD CONSTRAINT "refresh_proposals_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_proposals" ADD CONSTRAINT "refresh_proposals_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_proposals" ADD CONSTRAINT "refresh_proposals_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "news_articles_published_at_index" ON "news_articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "news_articles_outlet_id_published_at_index" ON "news_articles" USING btree ("outlet_id","published_at");--> statement-breakpoint
CREATE INDEX "page_views_daily_day_index" ON "page_views_daily" USING btree ("day");--> statement-breakpoint
CREATE INDEX "ranking_runs_started_at_index" ON "ranking_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_proposals_week_politician" ON "refresh_proposals" USING btree ("week_start","politician_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_proposals_one_pending" ON "refresh_proposals" USING btree ("politician_id") WHERE "refresh_proposals"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "refresh_proposals_week_start_status_index" ON "refresh_proposals" USING btree ("week_start","status");