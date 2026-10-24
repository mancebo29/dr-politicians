import { and, between, eq, sql } from "drizzle-orm";
import type { Executor } from "@/db/client";
import { pageViewsDaily, politicians } from "@/db/schema";
import { addDays, drDate, type Week } from "./week";

// Crawlers, link previewers, monitors and scripted clients. The beacon only
// fires from a real browser running JavaScript, so this is a second filter.
const BOT_UA =
  /bot|crawl|spider|slurp|archiver|preview|facebookexternalhit|whatsapp|headless|lighthouse|pagespeed|monitor|curl|wget|python|java\/|go-http|okhttp|axios|node-fetch|undici|httpclient|postman|insomnia/i;

export function isLikelyBot(userAgent: string | null): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

// Adds one view to today's counter of a published profile. Returns false when
// the slug is not a published profile.
export async function recordPageView(db: Executor, slug: string, now = new Date()) {
  const rows = await db
    .insert(pageViewsDaily)
    .select(
      db
        .select({
          politicianId: politicians.id,
          day: sql<string>`${drDate(now)}::date`.as("day"),
          views: sql<number>`1`.as("views"),
        })
        .from(politicians)
        .where(and(eq(politicians.slug, slug), eq(politicians.status, "published"))),
    )
    .onConflictDoUpdate({
      target: [pageViewsDaily.politicianId, pageViewsDaily.day],
      set: { views: sql`${pageViewsDaily.views} + 1` },
    })
    .returning({ politicianId: pageViewsDaily.politicianId });
  return rows.length > 0;
}

export async function pageViewsForWeek(db: Executor, week: Week) {
  const rows = await db
    .select({
      politicianId: pageViewsDaily.politicianId,
      views: sql<number>`sum(${pageViewsDaily.views})::int`,
    })
    .from(pageViewsDaily)
    .where(between(pageViewsDaily.day, week.weekStart, addDays(week.weekStart, 6)))
    .groupBy(pageViewsDaily.politicianId);
  return new Map(rows.map((r) => [r.politicianId, r.views]));
}
