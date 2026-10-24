import { describe, expect, it } from "vitest";
import { parseSetting } from "./site-settings";

describe("parseSetting", () => {
  it("fills missing fields with defaults", () => {
    expect(parseSetting("comments", { autoHideThreshold: 5 })).toEqual({
      enabled: true,
      preModeration: false,
      autoHideThreshold: 5,
      blockedTerms: [],
      editWindowMinutes: 15,
    });
    expect(parseSetting("registration", undefined)).toEqual({
      enabled: true,
      password: true,
      google: true,
    });
  });

  it("rejects invalid stored values loudly", () => {
    expect(() => parseSetting("comments", { autoHideThreshold: 0 })).toThrow(
      /Invalid "comments" site setting: autoHideThreshold/,
    );
  });
});
