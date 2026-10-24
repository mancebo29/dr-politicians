import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import type { Database, Executor } from "@/db/client";
import {
  newsArticles,
  politicians,
  popularitySnapshots,
  rankingRuns,
  refreshProposals,
  researchJobs,
} from "@/db/schema";
import { collectFeedArticles, type FeedCollection, type NewsArticleInput } from "./feeds";
import { pageViewsForWeek } from "./page-views";
import { defaultNewsQuery, matchesQuery, normalizeText, parseQuery } from "./query";
import { rankPoliticians, tallyMentions } from "./score";
import { loadRankingSettings, type Outlet } from "./settings";
import { lastCompletedWeek, type Week } from "./week";

const ACTIVE_RESEARCH_STATUSES = [
  "queued",
  "claimed",
  "submitted",
  "in_review",
  "needs_changes",
] as const;
const ARTICLE_RETENTION_DAYS = 120;

type Collector = (outlets: Outlet[], week: Week) => Promise<FeedCollection>;

export type RankingRunOptions = {
  now?: Date;
  week?: Week;
  trigger?: "cron" | "manual" | "test";
  collect?: Collector;
};

async function storeArticles(db: Executor, articles: NewsArticleInput[], fetchedAt: Date) {
  for (let offset = 0; offset < articles.length; offset += 100) {
    const batch = articles.slice(offset, offset + 100);
    await db
      .insert(newsArticles)
      .values(batch.map((article) => ({ ...article, fetchedAt })))
      .onConflictDoUpdate({
        target: newsArticles.url,
        set: {
          outletId: sql`excluded.outlet_id`,
          title: sql`excluded.title`,
          excerpt: sql`excluded.excerpt`,
          publishedAt: sql`excluded.published_at`,
          fetchedAt,
        },
      });
  }
}

async function previousRanks(db: Executor, weekStart: string) {
  const [latest] = await db
    .select({ weekStart: popularitySnapshots.weekStart })
    .from(popularitySnapshots)
    .where(lt(popularitySnapshots.weekStart, weekStart))
    .orderBy(desc(popularitySnapshots.weekStart))
    .limit(1);
  if (!latest) return new Map<string, number>();
  const rows = await db
    .select({ politicianId: popularitySnapshots.politicianId, rank: popularitySnapshots.rank })
    .from(popularitySnapshots)
    .where(eq(popularitySnapshots.weekStart, latest.weekStart));
  return new Map(rows.map((row) => [row.politicianId, row.rank]));
}

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 4_000);
}

// Fetches the configured feeds and atomically replaces one week's snapshots.
// The same week may be run repeatedly: articles upsert by URL, snapshots are
// replaced under an advisory lock, and pending refresh proposals are rebuilt.
export async function runWeeklyRanking(db: Database, options: RankingRunOptions = {}) {
  const now = options.now ?? new Date();
  const week = options.week ?? lastCompletedWeek(now);
  const settings = await loadRankingSettings(db);
  const [run] = await db
    .insert(rankingRuns)
    .values({
      weekStart: week.weekStart,
      trigger: options.trigger ?? "cron",
      source: "rss",
    })
    .returning({ id: rankingRuns.id });

  try {
    const collection = await (options.collect ?? collectFeedArticles)(settings.outlets, week);
    await storeArticles(db, collection.articles, now);

    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${"popularity:" + week.weekStart}))`,
      );

      const [profiles, articles, views, prior] = await Promise.all([
        tx
          .select({
            id: politicians.id,
            fullName: politicians.fullName,
            knownAs: politicians.knownAs,
            aliases: politicians.aliases,
            newsQuery: politicians.newsQuery,
            updatedAt: politicians.updatedAt,
          })
          .from(politicians)
          .where(and(eq(politicians.status, "published"), isNull(politicians.deathDate))),
        tx
          .select({
            outletId: newsArticles.outletId,
            url: newsArticles.url,
            title: newsArticles.title,
            excerpt: newsArticles.excerpt,
          })
          .from(newsArticles)
          .where(
            and(gte(newsArticles.publishedAt, week.from), lt(newsArticles.publishedAt, week.to)),
          ),
        pageViewsForWeek(tx, week),
        previousRanks(tx, week.weekStart),
      ]);

      const weights = new Map(settings.outlets.map((outlet) => [outlet.id, outlet.weight]));
      const normalized = articles.map((article) => ({
        ...article,
        text: normalizeText(`${article.title} ${article.excerpt}`),
      }));
      const warnings = [...collection.warnings];
      const inputs = profiles.map((profile) => {
        const query = profile.newsQuery?.trim() || defaultNewsQuery(profile);
        let matches: { url: string; outletId: string }[] = [];
        if (!query) {
          warnings.push(`${profile.fullName}: no tiene una consulta de noticias utilizable`);
        } else {
          try {
            const parsed = parseQuery(query);
            matches = normalized.filter((article) => matchesQuery(parsed, article.text));
          } catch (error) {
            warnings.push(`${profile.fullName}: consulta inválida (${errorMessage(error)})`);
          }
        }
        const tally = tallyMentions(matches, weights);
        return {
          politicianId: profile.id,
          name: profile.knownAs ?? profile.fullName,
          ...tally,
          pageViews: views.get(profile.id) ?? 0,
          previousRank: prior.get(profile.id) ?? null,
        };
      });
      const ranked = rankPoliticians(inputs, settings);

      await tx
        .delete(refreshProposals)
        .where(
          and(
            eq(refreshProposals.weekStart, week.weekStart),
            eq(refreshProposals.status, "pending"),
          ),
        );
      await tx.delete(popularitySnapshots).where(eq(popularitySnapshots.weekStart, week.weekStart));
      if (ranked.length) {
        await tx.insert(popularitySnapshots).values(
          ranked.map((row) => ({
            weekStart: week.weekStart,
            politicianId: row.politicianId,
            mentions: row.mentions,
            weightedMentions: row.weightedMentions,
            pageViews: row.pageViews,
            score: row.score,
            rank: row.rank,
            rankDelta: row.rankDelta,
            noRecentData: row.noRecentData,
          })),
        );
      }

      const active = await tx
        .select({ politicianId: researchJobs.politicianId })
        .from(researchJobs)
        .where(inArray(researchJobs.status, ACTIVE_RESEARCH_STATUSES));
      const activeIds = new Set(
        active.flatMap((row) => (row.politicianId ? [row.politicianId] : [])),
      );
      const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
      const staleBefore = new Date(now.getTime() - settings.refreshAgeDays * 86_400_000);
      const proposed = ranked.slice(0, settings.refreshTopN).filter((row) => {
        const profile = profileById.get(row.politicianId)!;
        return profile.updatedAt < staleBefore && !activeIds.has(row.politicianId);
      });
      let refreshProposed = 0;
      if (proposed.length) {
        const inserted = await tx
          .insert(refreshProposals)
          .values(
            proposed.map((row) => ({
              runId: run.id,
              weekStart: week.weekStart,
              politicianId: row.politicianId,
              rank: row.rank,
              profileUpdatedAt: profileById.get(row.politicianId)!.updatedAt,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: refreshProposals.id });
        refreshProposed = inserted.length;
      }

      const pruneBefore = new Date(now.getTime() - ARTICLE_RETENTION_DAYS * 86_400_000);
      await tx.delete(newsArticles).where(lt(newsArticles.publishedAt, pruneBefore));
      return { ranked: ranked.length, refreshProposed, warnings };
    });

    await db
      .update(rankingRuns)
      .set({
        status: "succeeded",
        finishedAt: new Date(),
        articlesIngested: collection.articles.length,
        politiciansRanked: result.ranked,
        refreshProposed: result.refreshProposed,
        warnings: result.warnings,
        error: null,
      })
      .where(eq(rankingRuns.id, run.id));

    return {
      runId: run.id,
      weekStart: week.weekStart,
      articlesIngested: collection.articles.length,
      politiciansRanked: result.ranked,
      refreshProposed: result.refreshProposed,
      warnings: result.warnings,
    };
  } catch (error) {
    await db
      .update(rankingRuns)
      .set({ status: "failed", finishedAt: new Date(), error: errorMessage(error) })
      .where(eq(rankingRuns.id, run.id));
    throw error;
  }
}
