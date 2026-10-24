import type { RankingSettings } from "./settings";

export type ArticleRef = { url: string; outletId: string };

// Distinct articles and their outlet-weighted sum. Outlets absent from the
// settings are ignored, so removing an outlet removes its stored articles.
export function tallyMentions(articles: ArticleRef[], weights: ReadonlyMap<string, number>) {
  const distinct = new Map(
    articles.filter((article) => weights.has(article.outletId)).map((a) => [a.url, a.outletId]),
  );
  let weightedMentions = 0;
  for (const outletId of distinct.values()) weightedMentions += weights.get(outletId) ?? 0;
  return { mentions: distinct.size, weightedMentions };
}

type Weights = Pick<RankingSettings, "newsWeight" | "viewsWeight">;

// PLAN §10: score = w_news · log(1 + weighted_mentions) + w_views · log(1 + page_views)
export function computeScore(weightedMentions: number, pageViews: number, w: Weights): number {
  return w.newsWeight * Math.log1p(weightedMentions) + w.viewsWeight * Math.log1p(pageViews);
}

export type RankInput = {
  politicianId: string;
  // Only used to break ties deterministically.
  name: string;
  mentions: number;
  weightedMentions: number;
  pageViews: number;
  previousRank: number | null;
};

export type RankedRow = RankInput & {
  score: number;
  rank: number;
  rankDelta: number | null;
  noRecentData: boolean;
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es");

// Ranks 1..N without gaps. Politicians below the minimum mentions are "sin
// datos recientes": if they had a rank last week they keep it (or the nearest
// free position when the list changed size), and the rest are ordered by score.
// Without a previous rank they are ordered by score like everyone else.
export function rankPoliticians(
  inputs: RankInput[],
  settings: Pick<RankingSettings, "newsWeight" | "viewsWeight" | "minMentions">,
): RankedRow[] {
  const rows = inputs.map((input) => ({
    ...input,
    score: computeScore(input.weightedMentions, input.pageViews, settings),
    noRecentData: input.mentions < settings.minMentions,
  }));

  const kept = rows
    .filter((r) => r.noRecentData && r.previousRank !== null)
    .sort((a, b) => a.previousRank! - b.previousRank! || byName(a, b));
  const scored = rows
    .filter((r) => !(r.noRecentData && r.previousRank !== null))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.previousRank ?? Infinity) - (b.previousRank ?? Infinity) ||
        byName(a, b),
    );

  const ranked: RankedRow[] = [];
  let k = 0;
  let s = 0;
  for (let rank = 1; rank <= rows.length; rank++) {
    const takeKept = k < kept.length && (kept[k].previousRank! <= rank || s >= scored.length);
    const row = takeKept ? kept[k++] : scored[s++];
    ranked.push({
      ...row,
      rank,
      rankDelta: row.previousRank === null ? null : row.previousRank - rank,
    });
  }
  return ranked;
}
