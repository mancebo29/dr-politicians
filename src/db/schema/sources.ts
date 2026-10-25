import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, partialDate, partialDateText, partialDateTextCheck, timestamps } from "./columns";

export const sourceTier = pgEnum("source_tier", ["official", "major_press", "other"]);

export const sources = pgTable(
  "sources",
  {
    id: id(),
    url: text().notNull().unique(),
    title: text().notNull(),
    publisher: text().notNull(),
    publishedOn: partialDateText(),
    accessedOn: partialDate().notNull(),
    archiveUrl: text(),
    tier: sourceTier().notNull(),
    language: text().notNull().default("es"),
    ...timestamps,
  },
  (t) => [partialDateTextCheck("sources_published_on_format", t.publishedOn)],
);

// Every published claim links to at least one source. Claims live in several
// tables, so the link is polymorphic; the `unsourced_claims` view and the
// delete triggers in the custom migration keep it honest.
export const claimTypes = [
  "politician_summary",
  "position",
  "party_membership",
  "alliance",
  "politician_legislation",
  "statement",
  "controversy",
  "work_record_item",
] as const;
export const claimType = pgEnum("claim_type", claimTypes);

export const claimSources = pgTable(
  "claim_sources",
  {
    id: id(),
    claimType: claimType().notNull(),
    claimId: uuid().notNull(),
    sourceId: uuid()
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    quoteExcerpt: text(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex().on(t.claimType, t.claimId, t.sourceId),
    index().on(t.sourceId),
    check("claim_sources_excerpt_length", sql`char_length(${t.quoteExcerpt}) <= 300`),
  ],
);
