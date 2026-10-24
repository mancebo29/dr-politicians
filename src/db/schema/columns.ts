import { date, pgEnum, timestamp, uuid } from "drizzle-orm/pg-core";

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
