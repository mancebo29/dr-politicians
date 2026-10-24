import { describe, expect, it } from "vitest";
import { computeScore, rankPoliticians, tallyMentions } from "./score";

describe("popularity scoring", () => {
  it("deduplicates article URLs and applies outlet weights", () => {
    expect(
      tallyMentions(
        [
          { url: "https://example.com/a", outletId: "a" },
          { url: "https://example.com/a", outletId: "a" },
          { url: "https://example.com/b", outletId: "b" },
          { url: "https://example.com/c", outletId: "removed" },
        ],
        new Map([
          ["a", 1],
          ["b", 0.5],
        ]),
      ),
    ).toEqual({ mentions: 2, weightedMentions: 1.5 });
  });

  it("uses the documented logarithmic formula", () => {
    expect(computeScore(3, 7, { newsWeight: 0.85, viewsWeight: 0.15 })).toBeCloseTo(
      0.85 * Math.log(4) + 0.15 * Math.log(8),
    );
  });

  it("keeps the previous position for rows without enough news", () => {
    const ranked = rankPoliticians(
      [
        {
          politicianId: "quiet",
          name: "Quieto",
          mentions: 0,
          weightedMentions: 0,
          pageViews: 0,
          previousRank: 2,
        },
        {
          politicianId: "high",
          name: "Alto",
          mentions: 5,
          weightedMentions: 5,
          pageViews: 0,
          previousRank: 3,
        },
        {
          politicianId: "low",
          name: "Bajo",
          mentions: 2,
          weightedMentions: 2,
          pageViews: 0,
          previousRank: 1,
        },
      ],
      { newsWeight: 1, viewsWeight: 0, minMentions: 1 },
    );
    expect(ranked.map((row) => [row.politicianId, row.rank, row.rankDelta])).toEqual([
      ["high", 1, 2],
      ["quiet", 2, 0],
      ["low", 3, -2],
    ]);
    expect(ranked[1].noRecentData).toBe(true);
  });
});
