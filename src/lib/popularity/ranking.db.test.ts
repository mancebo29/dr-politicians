import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  newsArticles,
  pageViewsDaily,
  politicians,
  popularitySnapshots,
  rankingRuns,
  refreshProposals,
  researchJobs,
  users,
} from "@/db/schema";
import { createTestDb, truncateAll } from "@/test/db";
import type { FeedCollection } from "./feeds";
import { isLikelyBot, recordPageView } from "./page-views";
import { runWeeklyRanking } from "./ranking";
import { decideRefreshProposal } from "./refresh";
import { weekOf } from "./week";

const db = createTestDb();
const week = weekOf("2026-10-19");
const now = new Date("2026-10-26T10:00:00Z");

const collection: FeedCollection = {
  articles: [
    {
      outletId: "diariolibre",
      url: "https://example.com/ana-1",
      title: "Ana Política presentó un proyecto",
      excerpt: "La senadora explicó la propuesta.",
      publishedAt: new Date("2026-10-20T12:00:00Z"),
    },
    {
      outletId: "hoy",
      url: "https://example.com/ana-2",
      title: "Entrevista con Ana Política",
      excerpt: "Actualidad nacional.",
      publishedAt: new Date("2026-10-22T12:00:00Z"),
    },
  ],
  warnings: ["Una fuente secundaria no respondió"],
  feedsAttempted: 2,
  feedsSucceeded: 1,
};

async function seedProfiles() {
  const rows = await db
    .insert(politicians)
    .values([
      {
        slug: "ana-politica",
        fullName: "Ana Política",
        newsQuery: '"Ana Política"',
        status: "published",
        publishedAt: new Date("2020-01-01T00:00:00Z"),
        updatedAt: new Date("2020-01-01T00:00:00Z"),
      },
      {
        slug: "bruno-ministro",
        fullName: "Bruno Ministro",
        newsQuery: '"Bruno Ministro"',
        status: "published",
        publishedAt: new Date("2020-01-01T00:00:00Z"),
        updatedAt: new Date("2020-01-01T00:00:00Z"),
      },
      {
        slug: "persona-fallecida",
        fullName: "Persona Fallecida",
        newsQuery: '"Persona Fallecida"',
        status: "published",
        publishedAt: new Date("2020-01-01T00:00:00Z"),
        deathDate: "2025-01-01",
        deathDatePrecision: "day",
      },
      { slug: "borrador", fullName: "Persona Borrador", status: "draft" },
    ])
    .returning({ id: politicians.id, slug: politicians.slug });
  return Object.fromEntries(rows.map((row) => [row.slug, row.id]));
}

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await db.$client.end();
});

describe("runWeeklyRanking", () => {
  it("replaces a week idempotently, computes deltas and proposes only eligible refreshes", async () => {
    const ids = await seedProfiles();
    await db.insert(popularitySnapshots).values([
      {
        weekStart: "2026-10-12",
        politicianId: ids["bruno-ministro"],
        score: 2,
        rank: 1,
      },
      {
        weekStart: "2026-10-12",
        politicianId: ids["ana-politica"],
        score: 1,
        rank: 2,
      },
    ]);
    await db.insert(pageViewsDaily).values({
      politicianId: ids["ana-politica"],
      day: "2026-10-21",
      views: 9,
    });
    await db.insert(researchJobs).values({
      politicianId: ids["bruno-ministro"],
      kind: "refresh",
      status: "queued",
    });

    const collect = async () => collection;
    const first = await runWeeklyRanking(db, { week, now, trigger: "test", collect });
    const second = await runWeeklyRanking(db, { week, now, trigger: "test", collect });

    expect(first).toMatchObject({
      weekStart: "2026-10-19",
      articlesIngested: 2,
      politiciansRanked: 2,
      refreshProposed: 1,
    });
    expect(second.refreshProposed).toBe(1);
    const rows = await db
      .select()
      .from(popularitySnapshots)
      .where(eq(popularitySnapshots.weekStart, week.weekStart))
      .orderBy(popularitySnapshots.rank);
    expect(
      rows.map((row) => [row.politicianId, row.rank, row.rankDelta, row.noRecentData]),
    ).toEqual([
      [ids["bruno-ministro"], 1, 0, true],
      [ids["ana-politica"], 2, 0, false],
    ]);
    expect(rows[1]).toMatchObject({ mentions: 2, weightedMentions: 2, pageViews: 9 });
    expect(await db.$count(newsArticles)).toBe(2);
    expect(await db.$count(refreshProposals)).toBe(1);
    expect(await db.$count(rankingRuns)).toBe(2);
    const [latestRun] = await db.select().from(rankingRuns).orderBy(rankingRuns.startedAt).limit(1);
    expect(latestRun.status).toBe("succeeded");
    expect(latestRun.warnings).toContain("Una fuente secundaria no respondió");

    const [admin] = await db
      .insert(users)
      .values({ name: "Admin", email: "ranking-admin@example.com", role: "admin" })
      .returning({ id: users.id });
    const [proposal] = await db.select().from(refreshProposals);
    const approved = await decideRefreshProposal(db, {
      proposalId: proposal.id,
      actorUserId: admin.id,
      decision: "approved",
    });
    expect(approved.status).toBe("approved");
    expect(approved.jobId).not.toBeNull();
    const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, approved.jobId!));
    expect(job).toMatchObject({
      politicianId: ids["ana-politica"],
      kind: "refresh",
      status: "queued",
    });
  });

  it("records a failed attempt without changing snapshots", async () => {
    await seedProfiles();
    await expect(
      runWeeklyRanking(db, {
        week,
        now,
        trigger: "test",
        collect: async () => {
          throw new Error("feeds unavailable");
        },
      }),
    ).rejects.toThrow("feeds unavailable");
    expect(await db.$count(popularitySnapshots)).toBe(0);
    const [run] = await db.select().from(rankingRuns);
    expect(run).toMatchObject({ status: "failed", error: "feeds unavailable" });
  });
});

describe("profile page views", () => {
  it("increments daily aggregates only for published slugs", async () => {
    const ids = await seedProfiles();
    expect(await recordPageView(db, "ana-politica", new Date("2026-10-21T12:00:00Z"))).toBe(true);
    expect(await recordPageView(db, "ana-politica", new Date("2026-10-21T18:00:00Z"))).toBe(true);
    expect(await recordPageView(db, "borrador", new Date("2026-10-21T18:00:00Z"))).toBe(false);
    expect(await recordPageView(db, "no-existe", new Date("2026-10-21T18:00:00Z"))).toBe(false);
    const [row] = await db
      .select()
      .from(pageViewsDaily)
      .where(eq(pageViewsDaily.politicianId, ids["ana-politica"]));
    expect(row).toMatchObject({ day: "2026-10-21", views: 2 });
  });

  it("recognizes common automated clients", () => {
    expect(isLikelyBot(null)).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 Chrome/140 Safari/537.36")).toBe(false);
    expect(isLikelyBot("Googlebot/2.1")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 HeadlessChrome/140")).toBe(true);
  });
});
