import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Executor } from "@/db/client";
import { siteSettings } from "@/db/schema";

// Key in site_settings that holds the ranking configuration (PLAN §8.3).
// Any field left out falls back to the default below.
export const RANKING_SETTINGS_KEY = "ranking";

const feedSchema = z.object({
  url: z.url(),
  // WordPress feeds keep only the newest items but accept ?paged=N, so they
  // are read page by page back to the last article already stored.
  paged: z.boolean().default(false),
});

const outletSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  weight: z.number().min(0),
  feeds: z.array(feedSchema).min(1),
});

export type Outlet = z.infer<typeof outletSchema>;

const settingsSchema = z.object({
  newsWeight: z.number().min(0),
  viewsWeight: z.number().min(0),
  outlets: z.array(outletSchema).min(1),
  // Fewer mentions than this in a week keeps the previous rank, marked
  // "sin datos recientes".
  minMentions: z.number().int().min(0),
  // How many of the top-ranked politicians are checked for stale profiles.
  refreshTopN: z.number().int().min(0),
  refreshAgeDays: z.number().int().min(1),
});

export type RankingSettings = z.infer<typeof settingsSchema>;

const wp = (url: string) => ({ url, paged: true });
const rss = (url: string) => ({ url, paged: false });

// Major DR outlets (PLAN §6.3) whose feeds were checked in the Phase 6 spike
// (docs/spikes/ranking-news-source.md). Acento has no public RSS feed.
export const defaultRankingSettings: RankingSettings = {
  newsWeight: 0.85,
  viewsWeight: 0.15,
  minMentions: 1,
  refreshTopN: 20,
  refreshAgeDays: 90,
  outlets: [
    {
      id: "diariolibre",
      name: "Diario Libre",
      weight: 1,
      feeds: ["portada", "politica", "actualidad", "economia", "opinion"].map((s) =>
        rss(`https://www.diariolibre.com/rss/${s}.xml`),
      ),
    },
    {
      id: "listindiario",
      name: "Listín Diario",
      weight: 1,
      feeds: ["la-republica", "economia", "puntos-de-vista"].map((s) =>
        rss(`https://listindiario.com/rss/${s}.xml`),
      ),
    },
    { id: "eldia", name: "El Día", weight: 1, feeds: [wp("https://eldia.com.do/feed/")] },
    { id: "hoy", name: "Hoy", weight: 1, feeds: [rss("https://hoy.com.do/rss/home.xml")] },
    { id: "ndigital", name: "N Digital", weight: 1, feeds: [wp("https://n.com.do/feed/")] },
    {
      id: "elnuevodiario",
      name: "El Nuevo Diario",
      weight: 1,
      feeds: [wp("https://elnuevodiario.com.do/feed/")],
    },
    { id: "sin", name: "Noticias SIN", weight: 1, feeds: [wp("https://noticiassin.com/feed/")] },
  ],
};

export function parseRankingSettings(value: unknown): RankingSettings {
  const stored = settingsSchema.partial().safeParse(value ?? {});
  if (!stored.success) {
    throw new Error(
      `Invalid "${RANKING_SETTINGS_KEY}" site setting: ${stored.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return { ...defaultRankingSettings, ...stored.data };
}

export async function loadRankingSettings(db: Executor): Promise<RankingSettings> {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, RANKING_SETTINGS_KEY));
  return parseRankingSettings(row?.value);
}
