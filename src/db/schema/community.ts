import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { id, timestamps } from "./columns";
import { politicians } from "./profiles";

export const commentStatus = pgEnum("comment_status", ["visible", "pending", "hidden", "deleted"]);

// Threads are capped at three levels (depth 0–2); replies to a depth-2
// comment attach to that comment rather than nesting further.
export const MAX_COMMENT_DEPTH = 2;

export const comments = pgTable(
  "comments",
  {
    id: id(),
    politicianId: uuid()
      .notNull()
      .references(() => politicians.id, { onDelete: "cascade" }),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    parentId: uuid().references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
    depth: smallint().notNull().default(0),
    body: text().notNull(),
    status: commentStatus().notNull().default("visible"),
    editedAt: timestamp({ withTimezone: true }),
    reportCount: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index().on(t.politicianId, t.createdAt),
    index().on(t.parentId),
    index().on(t.userId),
    check("comments_depth", sql`${t.depth} between 0 and ${sql.raw(String(MAX_COMMENT_DEPTH))}`),
    check("comments_root_depth", sql`(${t.parentId} is null) = (${t.depth} = 0)`),
    check("comments_body_length", sql`char_length(${t.body}) between 1 and 5000`),
  ],
);

export const reportResolution = pgEnum("report_resolution", ["dismissed", "hidden", "deleted"]);

export const commentReports = pgTable(
  "comment_reports",
  {
    id: id(),
    commentId: uuid()
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    reporterUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    reason: text().notNull(),
    resolvedByUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    resolution: reportResolution(),
    resolvedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.commentId, t.reporterUserId)],
);

export const feedbackKind = pgEnum("feedback_kind", ["bug", "suggestion", "correction", "other"]);
export const feedbackStatus = pgEnum("feedback_status", [
  "new",
  "triaged",
  "resolved",
  "dismissed",
]);

export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    kind: feedbackKind().notNull(),
    politicianId: uuid().references(() => politicians.id, { onDelete: "set null" }),
    section: text(),
    message: text().notNull(),
    sourceUrl: text(),
    contactEmail: text(),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    status: feedbackStatus().notNull().default("new"),
    resolutionNote: text(),
    ...timestamps,
  },
  (t) => [
    index().on(t.status, t.createdAt),
    check("feedback_message_length", sql`char_length(${t.message}) between 1 and 5000`),
  ],
);
