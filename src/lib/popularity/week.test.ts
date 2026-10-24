import { describe, expect, it } from "vitest";
import { drDate, lastCompletedWeek, weekOf } from "./week";

describe("Dominican ranking weeks", () => {
  it("uses America/Santo_Domingo calendar dates", () => {
    expect(drDate(new Date("2026-10-26T03:30:00Z"))).toBe("2026-10-25");
    expect(drDate(new Date("2026-10-26T04:30:00Z"))).toBe("2026-10-26");
  });

  it("returns the last complete Monday-to-Monday window", () => {
    expect(lastCompletedWeek(new Date("2026-10-26T10:00:00Z"))).toEqual(weekOf("2026-10-19"));
    expect(lastCompletedWeek(new Date("2026-10-28T16:00:00Z")).weekStart).toBe("2026-10-19");
  });

  it("rejects a week that does not start on Monday", () => {
    expect(() => weekOf("2026-10-20")).toThrow(/not a Monday/);
  });
});
