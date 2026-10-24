import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { datePrecision, id, partialDate, timestamps } from "./columns";
import { institutions, municipalities, parties, provinces } from "./reference";
import { sources } from "./sources";

export const profileStatus = pgEnum("profile_status", ["draft", "published", "archived"]);

export const politicians = pgTable(
  "politicians",
  {
    id: id(),
    slug: text().notNull().unique(),
    fullName: text().notNull(),
    knownAs: text(),
    aliases: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    birthDate: partialDate(),
    birthDatePrecision: datePrecision(),
    birthPlace: text(),
    deathDate: partialDate(),
    deathDatePrecision: datePrecision(),
    photoUrl: text(),
    photoSourceId: uuid().references(() => sources.id, { onDelete: "set null" }),
    photoLicense: text(),
    summary: text(),
    status: profileStatus().notNull().default("draft"),
    // Denormalized from party_memberships for list filtering; kept in sync on publish.
    currentPartyId: uuid().references(() => parties.id, { onDelete: "set null" }),
    newsQuery: text(),
    publishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index().on(t.status),
    index().on(t.currentPartyId),
    check(
      "politicians_birth_precision",
      sql`(${t.birthDate} is null) = (${t.birthDatePrecision} is null)`,
    ),
    check(
      "politicians_death_precision",
      sql`(${t.deathDate} is null) = (${t.deathDatePrecision} is null)`,
    ),
    check(
      "politicians_published_at",
      sql`${t.status} <> 'published' or ${t.publishedAt} is not null`,
    ),
  ],
);

const period = {
  startDate: partialDate(),
  startDatePrecision: datePrecision(),
  endDate: partialDate(),
  endDatePrecision: datePrecision(),
};

type PeriodColumns = Record<keyof typeof period, AnyPgColumn>;

function periodChecks(table: string, t: PeriodColumns) {
  return [
    check(
      `${table}_start_precision`,
      sql`(${t.startDate} is null) = (${t.startDatePrecision} is null)`,
    ),
    check(`${table}_end_precision`, sql`(${t.endDate} is null) = (${t.endDatePrecision} is null)`),
    check(
      `${table}_period_order`,
      sql`${t.startDate} is null or ${t.endDate} is null or ${t.endDate} >= ${t.startDate}`,
    ),
  ];
}

const politicianRef = () =>
  uuid()
    .notNull()
    .references(() => politicians.id, { onDelete: "cascade" });

export const positionOrigin = pgEnum("position_origin", [
  "elected",
  "appointed",
  "acting",
  "other",
]);

export const positions = pgTable(
  "positions",
  {
    id: id(),
    politicianId: politicianRef(),
    title: text().notNull(),
    institutionId: uuid().references(() => institutions.id),
    provinceId: uuid().references(() => provinces.id),
    municipalityId: uuid().references(() => municipalities.id),
    ...period,
    howObtained: positionOrigin(),
    isCurrent: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index().on(t.politicianId),
    index().on(t.provinceId),
    ...periodChecks("positions", t),
    check("positions_current_open", sql`not ${t.isCurrent} or ${t.endDate} is null`),
  ],
);

export const membershipRole = pgEnum("membership_role", [
  "member",
  "leader",
  "founder",
  "candidate",
]);

export const partyMemberships = pgTable(
  "party_memberships",
  {
    id: id(),
    politicianId: politicianRef(),
    partyId: uuid()
      .notNull()
      .references(() => parties.id),
    role: membershipRole().notNull().default("member"),
    ...period,
    exitReason: text(),
    ...timestamps,
  },
  (t) => [
    index().on(t.politicianId),
    index().on(t.partyId),
    ...periodChecks("party_memberships", t),
  ],
);

export const allianceKind = pgEnum("alliance_kind", [
  "coalition",
  "faction",
  "mentor",
  "ally",
  "rival",
  "other",
]);

export const alliances = pgTable(
  "alliances",
  {
    id: id(),
    politicianId: politicianRef(),
    counterparty: text().notNull(),
    kind: allianceKind().notNull(),
    description: text().notNull(),
    ...period,
    ...timestamps,
  },
  (t) => [index().on(t.politicianId), ...periodChecks("alliances", t)],
);

export const legislationKind = pgEnum("legislation_kind", [
  "law",
  "bill",
  "resolution",
  "decree",
  "other",
]);
export const legislationStatus = pgEnum("legislation_status", [
  "introduced",
  "passed",
  "promulgated",
  "rejected",
  "archived",
  "unknown",
]);

export const legislation = pgTable(
  "legislation",
  {
    id: id(),
    title: text().notNull(),
    number: text(),
    kind: legislationKind().notNull(),
    status: legislationStatus().notNull().default("unknown"),
    introducedOn: partialDate(),
    promulgatedOn: partialDate(),
    officialUrl: text(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex()
      .on(t.kind, t.number)
      .where(sql`${t.number} is not null`),
  ],
);

export const legislationInvolvement = pgEnum("legislation_involvement", [
  "author",
  "co_sponsor",
  "promoter",
  "promulgated",
  "voted_for",
  "voted_against",
  "public_advocate",
  "public_opponent",
]);

export const politicianLegislation = pgTable(
  "politician_legislation",
  {
    id: id(),
    politicianId: politicianRef(),
    legislationId: uuid()
      .notNull()
      .references(() => legislation.id, { onDelete: "cascade" }),
    involvement: legislationInvolvement().notNull(),
    notes: text(),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.politicianId, t.legislationId, t.involvement)],
);

export const statementKind = pgEnum("statement_kind", ["statement", "position", "influence"]);

export const statements = pgTable(
  "statements",
  {
    id: id(),
    politicianId: politicianRef(),
    kind: statementKind().notNull(),
    topic: text().notNull(),
    quote: text(),
    context: text().notNull(),
    saidOn: partialDate(),
    saidOnPrecision: datePrecision(),
    ...timestamps,
  },
  (t) => [
    index().on(t.politicianId),
    check("statements_said_precision", sql`(${t.saidOn} is null) = (${t.saidOnPrecision} is null)`),
  ],
);

export const legalStatus = pgEnum("legal_status", [
  "allegation",
  "under_investigation",
  "charged",
  "convicted",
  "acquitted",
  "dismissed",
  "settled",
  "no_legal_action",
]);

export const controversies = pgTable(
  "controversies",
  {
    id: id(),
    politicianId: politicianRef(),
    title: text().notNull(),
    summary: text().notNull(),
    startedOn: partialDate(),
    startedOnPrecision: datePrecision(),
    legalStatus: legalStatus().notNull(),
    politicianResponse: text(),
    lastVerifiedOn: partialDate().notNull(),
    ...timestamps,
  },
  (t) => [
    index().on(t.politicianId),
    check(
      "controversies_started_precision",
      sql`(${t.startedOn} is null) = (${t.startedOnPrecision} is null)`,
    ),
  ],
);
