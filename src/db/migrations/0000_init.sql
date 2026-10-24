CREATE TYPE "public"."date_precision" AS ENUM('year', 'month', 'day');--> statement-breakpoint
CREATE TYPE "public"."comment_status" AS ENUM('visible', 'pending', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."feedback_kind" AS ENUM('bug', 'suggestion', 'correction', 'other');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('new', 'triaged', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_resolution" AS ENUM('dismissed', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."alliance_kind" AS ENUM('coalition', 'faction', 'mentor', 'ally', 'rival', 'other');--> statement-breakpoint
CREATE TYPE "public"."legal_status" AS ENUM('allegation', 'under_investigation', 'charged', 'convicted', 'acquitted', 'dismissed', 'settled', 'no_legal_action');--> statement-breakpoint
CREATE TYPE "public"."legislation_involvement" AS ENUM('author', 'co_sponsor', 'promoter', 'promulgated', 'voted_for', 'voted_against', 'public_advocate', 'public_opponent');--> statement-breakpoint
CREATE TYPE "public"."legislation_kind" AS ENUM('law', 'bill', 'resolution', 'decree', 'other');--> statement-breakpoint
CREATE TYPE "public"."legislation_status" AS ENUM('introduced', 'passed', 'promulgated', 'rejected', 'archived', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('member', 'leader', 'founder', 'candidate');--> statement-breakpoint
CREATE TYPE "public"."position_origin" AS ENUM('elected', 'appointed', 'acting', 'other');--> statement-breakpoint
CREATE TYPE "public"."profile_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."statement_kind" AS ENUM('statement', 'position', 'influence');--> statement-breakpoint
CREATE TYPE "public"."institution_kind" AS ENUM('executive', 'ministry', 'legislature', 'local_government', 'judiciary', 'autonomous_body', 'international', 'other');--> statement-breakpoint
CREATE TYPE "public"."party_status" AS ENUM('active', 'dissolved', 'merged');--> statement-breakpoint
CREATE TYPE "public"."research_job_kind" AS ENUM('new_profile', 'refresh', 'targeted_correction');--> statement-breakpoint
CREATE TYPE "public"."research_job_status" AS ENUM('queued', 'claimed', 'submitted', 'in_review', 'approved', 'rejected', 'needs_changes', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."revision_origin" AS ENUM('research_submission', 'admin_edit', 'rollback');--> statement-breakpoint
CREATE TYPE "public"."claim_type" AS ENUM('politician_summary', 'position', 'party_membership', 'alliance', 'politician_legislation', 'statement', 'controversy');--> statement-breakpoint
CREATE TYPE "public"."source_tier" AS ENUM('official', 'major_press', 'other');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"impersonated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text,
	"display_username" text,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"reporter_user_id" uuid,
	"reason" text NOT NULL,
	"resolved_by_user_id" uuid,
	"resolution" "report_resolution",
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"politician_id" uuid NOT NULL,
	"user_id" uuid,
	"parent_id" uuid,
	"depth" smallint DEFAULT 0 NOT NULL,
	"body" text NOT NULL,
	"status" "comment_status" DEFAULT 'visible' NOT NULL,
	"edited_at" timestamp with time zone,
	"report_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_depth" CHECK ("comments"."depth" between 0 and 2),
	CONSTRAINT "comments_root_depth" CHECK (("comments"."parent_id" is null) = ("comments"."depth" = 0)),
	CONSTRAINT "comments_body_length" CHECK (char_length("comments"."body") between 1 and 5000)
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "feedback_kind" NOT NULL,
	"politician_id" uuid,
	"section" text,
	"message" text NOT NULL,
	"source_url" text,
	"contact_email" text,
	"user_id" uuid,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_message_length" CHECK (char_length("feedback"."message") between 1 and 5000)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "popularity_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" date NOT NULL,
	"politician_id" uuid NOT NULL,
	"mentions" integer DEFAULT 0 NOT NULL,
	"weighted_mentions" double precision DEFAULT 0 NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"score" double precision NOT NULL,
	"rank" integer NOT NULL,
	"rank_delta" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alliances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"politician_id" uuid NOT NULL,
	"counterparty" text NOT NULL,
	"kind" "alliance_kind" NOT NULL,
	"description" text NOT NULL,
	"start_date" date,
	"start_date_precision" date_precision,
	"end_date" date,
	"end_date_precision" date_precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alliances_start_precision" CHECK (("alliances"."start_date" is null) = ("alliances"."start_date_precision" is null)),
	CONSTRAINT "alliances_end_precision" CHECK (("alliances"."end_date" is null) = ("alliances"."end_date_precision" is null)),
	CONSTRAINT "alliances_period_order" CHECK ("alliances"."start_date" is null or "alliances"."end_date" is null or "alliances"."end_date" >= "alliances"."start_date")
);
--> statement-breakpoint
CREATE TABLE "controversies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"politician_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"started_on" date,
	"started_on_precision" date_precision,
	"legal_status" "legal_status" NOT NULL,
	"politician_response" text,
	"last_verified_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "controversies_started_precision" CHECK (("controversies"."started_on" is null) = ("controversies"."started_on_precision" is null))
);
--> statement-breakpoint
CREATE TABLE "legislation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"number" text,
	"kind" "legislation_kind" NOT NULL,
	"status" "legislation_status" DEFAULT 'unknown' NOT NULL,
	"introduced_on" date,
	"promulgated_on" date,
	"official_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"politician_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"start_date" date,
	"start_date_precision" date_precision,
	"end_date" date,
	"end_date_precision" date_precision,
	"exit_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "party_memberships_start_precision" CHECK (("party_memberships"."start_date" is null) = ("party_memberships"."start_date_precision" is null)),
	CONSTRAINT "party_memberships_end_precision" CHECK (("party_memberships"."end_date" is null) = ("party_memberships"."end_date_precision" is null)),
	CONSTRAINT "party_memberships_period_order" CHECK ("party_memberships"."start_date" is null or "party_memberships"."end_date" is null or "party_memberships"."end_date" >= "party_memberships"."start_date")
);
--> statement-breakpoint
CREATE TABLE "politician_legislation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"politician_id" uuid NOT NULL,
	"legislation_id" uuid NOT NULL,
	"involvement" "legislation_involvement" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politicians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"full_name" text NOT NULL,
	"known_as" text,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"birth_date" date,
	"birth_date_precision" date_precision,
	"birth_place" text,
	"death_date" date,
	"death_date_precision" date_precision,
	"photo_url" text,
	"photo_source_id" uuid,
	"photo_license" text,
	"summary" text,
	"status" "profile_status" DEFAULT 'draft' NOT NULL,
	"current_party_id" uuid,
	"news_query" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "politicians_slug_unique" UNIQUE("slug"),
	CONSTRAINT "politicians_birth_precision" CHECK (("politicians"."birth_date" is null) = ("politicians"."birth_date_precision" is null)),
	CONSTRAINT "politicians_death_precision" CHECK (("politicians"."death_date" is null) = ("politicians"."death_date_precision" is null)),
	CONSTRAINT "politicians_published_at" CHECK ("politicians"."status" <> 'published' or "politicians"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"politician_id" uuid NOT NULL,
	"title" text NOT NULL,
	"institution_id" uuid,
	"province_id" uuid,
	"municipality_id" uuid,
	"start_date" date,
	"start_date_precision" date_precision,
	"end_date" date,
	"end_date_precision" date_precision,
	"how_obtained" "position_origin",
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_start_precision" CHECK (("positions"."start_date" is null) = ("positions"."start_date_precision" is null)),
	CONSTRAINT "positions_end_precision" CHECK (("positions"."end_date" is null) = ("positions"."end_date_precision" is null)),
	CONSTRAINT "positions_period_order" CHECK ("positions"."start_date" is null or "positions"."end_date" is null or "positions"."end_date" >= "positions"."start_date"),
	CONSTRAINT "positions_current_open" CHECK (not "positions"."is_current" or "positions"."end_date" is null)
);
--> statement-breakpoint
CREATE TABLE "statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"politician_id" uuid NOT NULL,
	"kind" "statement_kind" NOT NULL,
	"topic" text NOT NULL,
	"quote" text,
	"context" text NOT NULL,
	"said_on" date,
	"said_on_precision" date_precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statements_said_precision" CHECK (("statements"."said_on" is null) = ("statements"."said_on_precision" is null))
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "institution_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institutions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "municipalities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"province_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_on" date,
	"superseded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "municipalities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"acronym" text NOT NULL,
	"founded_on" date,
	"color" text,
	"logo_url" text,
	"status" "party_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parties_slug_unique" UNIQUE("slug"),
	CONSTRAINT "parties_acronym_unique" UNIQUE("acronym")
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"created_on" date,
	"superseded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provinces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "profile_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"politician_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"diff" jsonb,
	"origin" "revision_origin" NOT NULL,
	"submission_id" uuid,
	"actor_user_id" uuid,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"politician_id" uuid,
	"requested_name" text,
	"kind" "research_job_kind" NOT NULL,
	"instructions" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"wave" integer,
	"status" "research_job_status" DEFAULT 'queued' NOT NULL,
	"claimed_by_token_id" uuid,
	"lease_expires_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_jobs_target" CHECK ("research_jobs"."politician_id" is not null or "research_jobs"."requested_name" is not null),
	CONSTRAINT "research_jobs_new_profile_target" CHECK ("research_jobs"."kind" = 'new_profile' or "research_jobs"."politician_id" is not null),
	CONSTRAINT "research_jobs_lease" CHECK ("research_jobs"."status" <> 'claimed' or ("research_jobs"."claimed_by_token_id" is not null and "research_jobs"."lease_expires_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "research_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"schema_version" integer NOT NULL,
	"validation_report" jsonb,
	"reviewer_user_id" uuid,
	"review_notes" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_by_user_id" uuid,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "claim_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_type" "claim_type" NOT NULL,
	"claim_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"quote_excerpt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_sources_excerpt_length" CHECK (char_length("claim_sources"."quote_excerpt") <= 300)
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"publisher" text NOT NULL,
	"published_on" date,
	"accessed_on" date NOT NULL,
	"archive_url" text,
	"tier" "source_tier" NOT NULL,
	"language" text DEFAULT 'es' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_by_users_id_fk" FOREIGN KEY ("impersonated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "popularity_snapshots" ADD CONSTRAINT "popularity_snapshots_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliances" ADD CONSTRAINT "alliances_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "controversies" ADD CONSTRAINT "controversies_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_memberships" ADD CONSTRAINT "party_memberships_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_memberships" ADD CONSTRAINT "party_memberships_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politician_legislation" ADD CONSTRAINT "politician_legislation_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politician_legislation" ADD CONSTRAINT "politician_legislation_legislation_id_legislation_id_fk" FOREIGN KEY ("legislation_id") REFERENCES "public"."legislation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politicians" ADD CONSTRAINT "politicians_photo_source_id_sources_id_fk" FOREIGN KEY ("photo_source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politicians" ADD CONSTRAINT "politicians_current_party_id_parties_id_fk" FOREIGN KEY ("current_party_id") REFERENCES "public"."parties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_superseded_by_id_municipalities_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_superseded_by_id_provinces_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."provinces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_revisions" ADD CONSTRAINT "profile_revisions_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_revisions" ADD CONSTRAINT "profile_revisions_submission_id_research_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."research_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_revisions" ADD CONSTRAINT "profile_revisions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_politician_id_politicians_id_fk" FOREIGN KEY ("politician_id") REFERENCES "public"."politicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_claimed_by_token_id_research_tokens_id_fk" FOREIGN KEY ("claimed_by_token_id") REFERENCES "public"."research_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_submissions" ADD CONSTRAINT "research_submissions_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_submissions" ADD CONSTRAINT "research_submissions_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_tokens" ADD CONSTRAINT "research_tokens_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "claim_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_index" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_index" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_reports_comment_id_reporter_user_id_index" ON "comment_reports" USING btree ("comment_id","reporter_user_id");--> statement-breakpoint
CREATE INDEX "comments_politician_id_created_at_index" ON "comments" USING btree ("politician_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_parent_id_index" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "comments_user_id_index" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_status_created_at_index" ON "feedback" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_entity_id_index" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_index" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "popularity_snapshots_week_start_politician_id_index" ON "popularity_snapshots" USING btree ("week_start","politician_id");--> statement-breakpoint
CREATE INDEX "popularity_snapshots_week_start_rank_index" ON "popularity_snapshots" USING btree ("week_start","rank");--> statement-breakpoint
CREATE INDEX "alliances_politician_id_index" ON "alliances" USING btree ("politician_id");--> statement-breakpoint
CREATE INDEX "controversies_politician_id_index" ON "controversies" USING btree ("politician_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legislation_kind_number_index" ON "legislation" USING btree ("kind","number") WHERE "legislation"."number" is not null;--> statement-breakpoint
CREATE INDEX "party_memberships_politician_id_index" ON "party_memberships" USING btree ("politician_id");--> statement-breakpoint
CREATE INDEX "party_memberships_party_id_index" ON "party_memberships" USING btree ("party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "politician_legislation_politician_id_legislation_id_involvement_index" ON "politician_legislation" USING btree ("politician_id","legislation_id","involvement");--> statement-breakpoint
CREATE INDEX "politicians_status_index" ON "politicians" USING btree ("status");--> statement-breakpoint
CREATE INDEX "politicians_current_party_id_index" ON "politicians" USING btree ("current_party_id");--> statement-breakpoint
CREATE INDEX "positions_politician_id_index" ON "positions" USING btree ("politician_id");--> statement-breakpoint
CREATE INDEX "positions_province_id_index" ON "positions" USING btree ("province_id");--> statement-breakpoint
CREATE INDEX "statements_politician_id_index" ON "statements" USING btree ("politician_id");--> statement-breakpoint
CREATE UNIQUE INDEX "municipalities_province_id_name_index" ON "municipalities" USING btree ("province_id","name");--> statement-breakpoint
CREATE INDEX "profile_revisions_politician_id_created_at_index" ON "profile_revisions" USING btree ("politician_id","created_at");--> statement-breakpoint
CREATE INDEX "research_jobs_status_priority_index" ON "research_jobs" USING btree ("status","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "research_submissions_job_id_payload_hash_index" ON "research_submissions" USING btree ("job_id","payload_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_sources_claim_type_claim_id_source_id_index" ON "claim_sources" USING btree ("claim_type","claim_id","source_id");--> statement-breakpoint
CREATE INDEX "claim_sources_source_id_index" ON "claim_sources" USING btree ("source_id");