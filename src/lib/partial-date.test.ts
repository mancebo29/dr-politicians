import { describe, expect, it } from "vitest";
import { formatPartialDate, fromDbDate, partialDateSchema, toDbDate } from "./partial-date";

describe("partial dates", () => {
  it("accepts year, month and day precision and rejects impossible dates", () => {
    expect(partialDateSchema.safeParse("2020").success).toBe(true);
    expect(partialDateSchema.safeParse("2020-08").success).toBe(true);
    expect(partialDateSchema.safeParse("2020-08-16").success).toBe(true);
    expect(partialDateSchema.safeParse("2020-02-30").success).toBe(false);
    expect(partialDateSchema.safeParse("2020-13").success).toBe(false);
    expect(partialDateSchema.safeParse("16/08/2020").success).toBe(false);
  });

  it("round-trips through the database representation", () => {
    for (const value of ["1968", "1996-08", "2020-08-16"]) {
      const { date, precision } = toDbDate(value);
      expect(fromDbDate(date, precision)).toBe(value);
    }
    expect(toDbDate("1968")).toEqual({ date: "1968-01-01", precision: "year" });
    expect(toDbDate(null)).toEqual({ date: null, precision: null });
  });

  it("formats in Spanish without inventing precision", () => {
    expect(formatPartialDate("2020")).toBe("2020");
    expect(formatPartialDate("2020-08")).toBe("agosto de 2020");
    expect(formatPartialDate("2020-08-16")).toBe("16 de agosto de 2020");
  });
});
