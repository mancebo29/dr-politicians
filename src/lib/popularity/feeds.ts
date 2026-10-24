import type { Outlet } from "./settings";
import type { Week } from "./week";

export type NewsArticleInput = {
  outletId: string;
  url: string;
  title: string;
  excerpt: string;
  publishedAt: Date;
};

export type FeedCollection = {
  articles: NewsArticleInput[];
  warnings: string[];
  feedsAttempted: number;
  feedsSucceeded: number;
};

export type FeedFetcher = (
  url: string,
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

const entity = /&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|quot);/gi;
const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };

function decodeEntities(value: string) {
  return value.replace(entity, (_, code: string) => {
    const lower = code.toLowerCase();
    try {
      if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
      if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    } catch {
      return _;
    }
    return named[lower] ?? _;
  });
}

function plainText(value: string) {
  return decodeEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tag(block: string, names: string[]) {
  for (const name of names) {
    const escaped = escapeRegex(name);
    const match = block.match(
      new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"),
    );
    if (match) return plainText(match[1]);
  }
  return "";
}

function atomLink(block: string) {
  const alternate = block.match(
    /<link\b(?=[^>]*\brel=["']alternate["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i,
  );
  const any = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
  return plainText(alternate?.[1] ?? any?.[1] ?? "");
}

function canonicalUrl(value: string, baseUrl: string) {
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

// Supports the RSS 2.0 and Atom fields used by the configured Dominican
// outlets. Invalid items are skipped rather than poisoning the whole feed.
export function parseFeedXml(xml: string, outletId: string, feedUrl: string): NewsArticleInput[] {
  const rssItems = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  const atomEntries = [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].map(
    (m) => m[1],
  );
  const blocks = rssItems.length ? rssItems : atomEntries;

  return blocks.flatMap((block) => {
    const title = tag(block, ["title"]);
    const rawUrl = tag(block, ["link"]) || atomLink(block) || tag(block, ["guid", "id"]);
    const url = canonicalUrl(rawUrl, feedUrl);
    const published = tag(block, ["pubDate", "dc:date", "published", "updated"]);
    const publishedAt = new Date(published);
    if (!title || !url || !published || Number.isNaN(publishedAt.getTime())) return [];
    return [
      {
        outletId,
        url,
        title: title.slice(0, 1_000),
        excerpt: tag(block, ["description", "content:encoded", "summary", "content"]).slice(
          0,
          4_000,
        ),
        publishedAt,
      },
    ];
  });
}

function pageUrl(value: string, page: number) {
  const url = new URL(value);
  url.searchParams.set("paged", String(page));
  return url.toString();
}

async function defaultFetcher(url: string) {
  return fetch(url, {
    cache: "no-store",
    headers: { "user-agent": "PoliticosRD/1.0 (+https://politicosrd.example/metodologia)" },
    signal: AbortSignal.timeout(10_000),
  });
}

export async function collectFeedArticles(
  outlets: Outlet[],
  week: Week,
  fetcher: FeedFetcher = defaultFetcher,
): Promise<FeedCollection> {
  const articles = new Map<string, NewsArticleInput>();
  const outletOrder = new Map(outlets.map((outlet, index) => [outlet.id, index]));
  const warnings: string[] = [];
  const feedsAttempted = outlets.reduce((count, outlet) => count + outlet.feeds.length, 0);
  let feedsSucceeded = 0;

  await Promise.all(
    outlets.flatMap((outlet) =>
      outlet.feeds.map(async (feed) => {
        let feedSucceeded = false;
        const seenOnFeed = new Set<string>();
        try {
          for (let page = 1; page <= (feed.paged ? 20 : 1); page++) {
            const url = feed.paged ? pageUrl(feed.url, page) : feed.url;
            const response = await fetcher(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const xml = await response.text();
            if (!/<(?:rss|feed)\b/i.test(xml)) throw new Error("la respuesta no es RSS/Atom");
            const parsed = parseFeedXml(xml, outlet.id, feed.url);
            feedSucceeded = true;
            if (parsed.length === 0) break;

            let newOnPage = 0;
            for (const article of parsed) {
              if (seenOnFeed.has(article.url)) continue;
              seenOnFeed.add(article.url);
              newOnPage++;
              if (article.publishedAt >= week.from && article.publishedAt < week.to) {
                const existing = articles.get(article.url);
                if (
                  !existing ||
                  outletOrder.get(article.outletId)! < outletOrder.get(existing.outletId)!
                ) {
                  articles.set(article.url, article);
                }
              }
            }
            if (!feed.paged || newOnPage === 0 || parsed.some((a) => a.publishedAt < week.from))
              break;
          }
        } catch (error) {
          warnings.push(
            `${outlet.name} (${feed.url}): ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        if (feedSucceeded) feedsSucceeded++;
      }),
    ),
  );

  if (feedsAttempted === 0) throw new Error("No hay fuentes RSS configuradas");
  if (feedsSucceeded === 0) {
    throw new Error(`No se pudo leer ninguna fuente RSS: ${warnings.join("; ")}`);
  }
  return { articles: [...articles.values()], warnings, feedsAttempted, feedsSucceeded };
}
