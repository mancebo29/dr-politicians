ALTER TABLE "legislation" ALTER COLUMN "introduced_on" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "legislation" ALTER COLUMN "promulgated_on" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "published_on" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "legislation" ADD CONSTRAINT "legislation_introduced_on_format" CHECK ("legislation"."introduced_on" ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$');--> statement-breakpoint
ALTER TABLE "legislation" ADD CONSTRAINT "legislation_promulgated_on_format" CHECK ("legislation"."promulgated_on" ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$');--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_published_on_format" CHECK ("sources"."published_on" ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$');