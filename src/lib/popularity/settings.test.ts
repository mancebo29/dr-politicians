import { describe, expect, it } from "vitest";
import { defaultRankingSettings, parseRankingSettings } from "./settings";

describe("ranking settings", () => {
  it("merges partial stored values over safe defaults", () => {
    expect(parseRankingSettings({ newsWeight: 0.7 })).toEqual({
      ...defaultRankingSettings,
      newsWeight: 0.7,
    });
  });

  it("requires at least one valid feed outlet", () => {
    expect(() => parseRankingSettings({ outlets: [] })).toThrow(/outlets/);
    expect(() =>
      parseRankingSettings({
        outlets: [{ id: "bad id", name: "Bad", weight: 1, feeds: [{ url: "not-a-url" }] }],
      }),
    ).toThrow(/outlets/);
  });
});
