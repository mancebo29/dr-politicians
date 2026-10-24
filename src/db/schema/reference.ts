import {
  type AnyPgColumn,
  date,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";

export const provinces = pgTable("provinces", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  region: text(),
  createdOn: date({ mode: "string" }),
  supersededById: uuid().references((): AnyPgColumn => provinces.id),
  ...timestamps,
});

export const municipalities = pgTable(
  "municipalities",
  {
    id: id(),
    provinceId: uuid()
      .notNull()
      .references(() => provinces.id),
    slug: text().notNull().unique(),
    name: text().notNull(),
    createdOn: date({ mode: "string" }),
    supersededById: uuid().references((): AnyPgColumn => municipalities.id),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.provinceId, t.name)],
);

export const partyStatus = pgEnum("party_status", ["active", "dissolved", "merged"]);

export const parties = pgTable("parties", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  acronym: text().notNull().unique(),
  foundedOn: date({ mode: "string" }),
  color: text(),
  logoUrl: text(),
  status: partyStatus().notNull().default("active"),
  ...timestamps,
});

export const institutionKind = pgEnum("institution_kind", [
  "executive",
  "ministry",
  "legislature",
  "local_government",
  "judiciary",
  "autonomous_body",
  "international",
  "other",
]);

export const institutions = pgTable("institutions", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  kind: institutionKind().notNull(),
  ...timestamps,
});
