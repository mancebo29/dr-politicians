-- Re-runnable on purpose: this change was first applied to Supabase as an
-- earlier "0006_roster_discovery" before 0006_community_and_rate_limits landed,
-- so that database already has it under an older timestamp.
ALTER TYPE "public"."research_job_kind" ADD VALUE IF NOT EXISTS 'roster_discovery';--> statement-breakpoint
ALTER TABLE "research_jobs" DROP CONSTRAINT IF EXISTS "research_jobs_new_profile_target";--> statement-breakpoint
ALTER TABLE "research_jobs" DROP CONSTRAINT IF EXISTS "research_jobs_roster_segment";--> statement-breakpoint
ALTER TABLE "research_jobs" ADD COLUMN IF NOT EXISTS "roster_segment" text;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_roster_segment" CHECK (("research_jobs"."kind"::text = 'roster_discovery') = ("research_jobs"."roster_segment" is not null));--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_new_profile_target" CHECK ("research_jobs"."kind"::text in ('new_profile', 'roster_discovery') or "research_jobs"."politician_id" is not null);
