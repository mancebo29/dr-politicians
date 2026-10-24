import { sql } from "drizzle-orm";
import { type AnyPgColumn, check, date, pgEnum, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid().primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// Research often only knows the year or month of an event. The date column
// holds the first day of the known period and the precision column says how
// much of it is real, so partial dates still sort and never get invented days.
export const datePrecision = pgEnum("date_precision", ["year", "month", "day"]);

export const partialDate = () => date({ mode: "string" });

// For secondary dates that are displayed but rarely sorted (source publication,
// law dates): the partial date text itself, e.g. "2019" or "2019-07-26".
export const partialDateText = () => text();

export function partialDateTextCheck(name: string, column: AnyPgColumn) {
  return check(name, sql`${column} ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'`);
}
