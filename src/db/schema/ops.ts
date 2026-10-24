import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { id, timestamps } from "./columns";
import { politicians } from "./profiles";
import { researchJobs } from "./research";

// One row per politician per ranked week (PLAN §10). `week_start` is the
// Monday (America/Santo_Domingo) that opens the 7-day window that was measured.
export const popularitySnapshots = pgTable(
  "popularity_snapshots",
  {
    id: id(),
    weekStart: date({ mode: "string" }).notNull(),
    politicianId: uuid()
      .notNull()
      .references(() => politicians.id, { onDelete: "cascade" }),
    mentions: integer().notNull().default(0),
    weightedMentions: doublePrecision().notNull().default(0),
    pageViews: integer().notNull().default(0),
    score: doublePrecision().notNull(),
    rank: integer().notNull(),
    // previous rank − rank: positive moved up, null when there is no earlier week.
    rankDelta: integer(),
    // Fewer than the minimum mentions this week ("sin datos recientes"): the
    // rank is carried over from the previous week when there is one.
    noRecentData: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.weekStart, t.politicianId), index().on(t.weekStart, t.rank)],
);

export const siteSettings = pgTable("site_settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    before: jsonb(),
    after: jsonb(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.entity, t.entityId), index().on(t.at)],
);

// Articles collected from the outlets' feeds. Only what matching needs is
// kept (title and a short plain-text excerpt), and rows are pruned after the
// retention window.
export const newsArticles = pgTable(
  "news_articles",
  {
    id: id(),
    outletId: text().notNull(),
    url: text().notNull().unique(),
    title: text().notNull(),
    excerpt: text().notNull().default(""),
    publishedAt: timestamp({ withTimezone: true }).notNull(),
    fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.publishedAt), index().on(t.outletId, t.publishedAt)],
);

// Aggregate profile views per day (America/Santo_Domingo). No visitor data.
export const pageViewsDaily = pgTable(
  "page_views_daily",
  {
    politicianId: uuid()
      .notNull()
      .references(() => politicians.id, { onDelete: "cascade" }),
    day: date({ mode: "string" }).notNull(),
    views: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.politicianId, t.day] }), index().on(t.day)],
);

export const rankingRunStatus = pgEnum("ranking_run_status", ["running", "succeeded", "failed"]);

// One row per ranking attempt, for the admin dashboard (PLAN §8.5).
export const rankingRuns = pgTable(
  "ranking_runs",
  {
    id: id(),
    weekStart: date({ mode: "string" }).notNull(),
    status: rankingRunStatus().notNull().default("running"),
    trigger: text().notNull(),
    source: text().notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
    articlesIngested: integer(),
    politiciansRanked: integer(),
    refreshProposed: integer(),
    // Non-fatal problems, e.g. an outlet feed that could not be read.
    warnings: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    error: text(),
    ...timestamps,
  },
  (t) => [index().on(t.startedAt)],
);

export const refreshProposalStatus = pgEnum("refresh_proposal_status", [
  "pending",
  "approved",
  "dismissed",
]);

// Refresh research jobs suggested by a ranking run (PLAN §6.5). They become
// research jobs only when an admin approves the batch, so nothing reaches the
// research queue without review.
export const refreshProposals = pgTable(
  "refresh_proposals",
  {
    id: id(),
    runId: uuid()
      .notNull()
      .references(() => rankingRuns.id, { onDelete: "cascade" }),
    weekStart: date({ mode: "string" }).notNull(),
    politicianId: uuid()
      .notNull()
      .references(() => politicians.id, { onDelete: "cascade" }),
    rank: integer().notNull(),
    profileUpdatedAt: timestamp({ withTimezone: true }).notNull(),
    status: refreshProposalStatus().notNull().default("pending"),
    jobId: uuid().references(() => researchJobs.id, { onDelete: "set null" }),
    decidedByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("refresh_proposals_week_politician").on(t.weekStart, t.politicianId),
    uniqueIndex("refresh_proposals_one_pending")
      .on(t.politicianId)
      .where(sql`${t.status} = 'pending'`),
    index().on(t.weekStart, t.status),
    check("refresh_proposals_decision", sql`(${t.status} = 'pending') = (${t.decidedAt} is null)`),
  ],
);
