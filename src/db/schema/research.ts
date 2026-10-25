import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { id, timestamps } from "./columns";
import { politicians } from "./profiles";

export const revisionOrigin = pgEnum("revision_origin", [
  "research_submission",
  "admin_edit",
  "rollback",
]);

export const profileRevisions = pgTable(
  "profile_revisions",
  {
    id: id(),
    politicianId: uuid()
      .notNull()
      .references(() => politicians.id, { onDelete: "cascade" }),
    snapshot: jsonb().notNull(),
    diff: jsonb(),
    origin: revisionOrigin().notNull(),
    submissionId: uuid().references(() => researchSubmissions.id, { onDelete: "set null" }),
    actorUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    note: text().notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.politicianId, t.createdAt)],
);

export const researchJobKind = pgEnum("research_job_kind", [
  "new_profile",
  "refresh",
  "targeted_correction",
  // Finds who belongs in a wave segment; approving its roster queues new_profile jobs.
  "roster_discovery",
]);
export const researchJobStatus = pgEnum("research_job_status", [
  "queued",
  "claimed",
  "submitted",
  "in_review",
  "approved",
  "rejected",
  "needs_changes",
  "failed",
  "cancelled",
]);

export const researchJobs = pgTable(
  "research_jobs",
  {
    id: id(),
    politicianId: uuid().references(() => politicians.id, { onDelete: "set null" }),
    requestedName: text(),
    kind: researchJobKind().notNull(),
    instructions: text(),
    priority: integer().notNull().default(0),
    wave: integer(),
    // roster_discovery only: the key of the wave segment (src/lib/research/waves.ts).
    rosterSegment: text(),
    status: researchJobStatus().notNull().default("queued"),
    claimedByTokenId: uuid().references(() => researchTokens.id, { onDelete: "set null" }),
    leaseExpiresAt: timestamp({ withTimezone: true }),
    attempts: integer().notNull().default(0),
    createdByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index().on(t.status, t.priority),
    check(
      "research_jobs_target",
      sql`${t.politicianId} is not null or ${t.requestedName} is not null`,
    ),
    // Kinds are compared as text: a check that spells a newly added enum value
    // fails in the migration transaction that adds it.
    check(
      "research_jobs_new_profile_target",
      sql`${t.kind}::text in ('new_profile', 'roster_discovery') or ${t.politicianId} is not null`,
    ),
    check(
      "research_jobs_roster_segment",
      sql`(${t.kind}::text = 'roster_discovery') = (${t.rosterSegment} is not null)`,
    ),
    check(
      "research_jobs_lease",
      sql`${t.status} <> 'claimed' or (${t.claimedByTokenId} is not null and ${t.leaseExpiresAt} is not null)`,
    ),
  ],
);

export const researchSubmissions = pgTable(
  "research_submissions",
  {
    id: id(),
    jobId: uuid()
      .notNull()
      .references(() => researchJobs.id, { onDelete: "cascade" }),
    payload: jsonb().notNull(),
    payloadHash: text().notNull(),
    schemaVersion: integer().notNull(),
    validationReport: jsonb(),
    reviewerUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    reviewNotes: text(),
    decidedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.jobId, t.payloadHash)],
);

export const researchTokens = pgTable("research_tokens", {
  id: id(),
  name: text().notNull(),
  tokenHash: text().notNull().unique(),
  createdByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
  lastUsedAt: timestamp({ withTimezone: true }),
  expiresAt: timestamp({ withTimezone: true }),
  revokedAt: timestamp({ withTimezone: true }),
  ...timestamps,
});
