import {
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { id, timestamps } from "./columns";
import { politicians } from "./profiles";

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
    rankDelta: integer(),
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
