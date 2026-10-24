import { setTimeout as wait } from "node:timers/promises";
import { collectFeedArticles } from "@/lib/popularity/feeds";
import { matchesQuery, normalizeText, parseQuery } from "@/lib/popularity/query";
import { defaultRankingSettings } from "@/lib/popularity/settings";

// A fixed, cross-party sample of prominent current and former office-holders.
const names = [
  "Luis Abinader",
  "Raquel Peña",
  "Leonel Fernández",
  "Danilo Medina",
  "Hipólito Mejía",
  "Carolina Mejía",
  "David Collado",
  "Faride Raful",
  "Roberto Ángel Salcedo",
  "José Ignacio Paliza",
  "Guido Gómez Mazara",
  "Eduardo Estrella",
  "Ricardo de los Santos",
  "Alfredo Pacheco",
  "Omar Fernández",
  "Guillermo Moreno",
  "Abel Martínez",
  "Margarita Cedeño",
  "Gonzalo Castillo",
  "Miguel Vargas Maldonado",
] as const;

const to = new Date();
const from = new Date(to.getTime() - 7 * 86_400_000);
const rssOnly = process.argv.includes("--rss-only");
const compact = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");

async function gdelt(name: string) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", `"${name}" sourcecountry:DR sourcelang:spanish`);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "250");
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("startdatetime", compact(from));
  url.searchParams.set("enddatetime", compact(to));
  const response = await fetch(url, {
    headers: { "user-agent": "PoliticosRD ranking source spike" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`GDELT HTTP ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("json")) throw new Error(`GDELT returned ${type || "an unknown type"}`);
  const body = (await response.json()) as {
    articles?: { url: string; title: string; domain: string; sourcecountry?: string }[];
  };
  return body.articles ?? [];
}

async function main() {
  const window = { weekStart: from.toISOString().slice(0, 10), from, to };
  const rss = await collectFeedArticles(defaultRankingSettings.outlets, window);
  console.error(
    `RSS: ${rss.articles.length} articles from ${rss.feedsSucceeded}/${rss.feedsAttempted} feeds`,
  );
  const rssText = rss.articles.map((article) => ({
    ...article,
    text: normalizeText(`${article.title} ${article.excerpt}`),
  }));
  const rows = [];
  for (const [index, name] of names.entries()) {
    const node = parseQuery(`"${name}"`);
    const rssMatches = rssText.filter((article) => matchesQuery(node, article.text));
    let gdeltArticles: Awaited<ReturnType<typeof gdelt>> = [];
    let error: string | null = rssOnly ? "not run (--rss-only)" : null;
    if (!rssOnly) {
      try {
        gdeltArticles = await gdelt(name);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }
    }
    rows.push({
      name,
      rss: rssMatches.length,
      rssTitles: rssMatches.slice(0, 5).map((article) => article.title),
      gdelt: gdeltArticles.length,
      gdeltDomains: [...new Set(gdeltArticles.map((article) => article.domain))].sort(),
      gdeltTitles: gdeltArticles.slice(0, 5).map((article) => article.title),
      error,
    });
    console.error(
      `${index + 1}/${names.length} ${name}: RSS ${rssMatches.length}, GDELT ${gdeltArticles.length}${error ? ` (${error})` : ""}`,
    );
    // GDELT asks automated clients to stay below one request every five seconds.
    if (!rssOnly && index < names.length - 1) await wait(5_200);
  }
  console.log(
    JSON.stringify(
      {
        measuredAt: to.toISOString(),
        from: from.toISOString(),
        rss: {
          articles: rss.articles.length,
          feedsAttempted: rss.feedsAttempted,
          feedsSucceeded: rss.feedsSucceeded,
          warnings: rss.warnings,
        },
        coverage: {
          rss: rows.filter((row) => row.rss > 0).length,
          gdelt:
            rssOnly || rows.some((row) => row.error)
              ? null
              : rows.filter((row) => row.gdelt > 0).length,
        },
        rows,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
