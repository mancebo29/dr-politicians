import { describe, expect, it } from "vitest";
import { collectFeedArticles, parseFeedXml } from "./feeds";
import { weekOf } from "./week";

const rss = `<?xml version="1.0"?><rss><channel><item>
  <title><![CDATA[José Peña &amp; el Senado]]></title>
  <link>https://example.com/a#comments</link>
  <pubDate>Tue, 20 Oct 2026 15:00:00 GMT</pubDate>
  <description><![CDATA[<p>Una nota <strong>dominicana</strong>.</p>]]></description>
</item></channel></rss>`;

describe("RSS ingestion", () => {
  it("parses RSS text, dates, links and HTML excerpts", () => {
    expect(parseFeedXml(rss, "medio", "https://example.com/feed")).toEqual([
      {
        outletId: "medio",
        url: "https://example.com/a",
        title: "José Peña & el Senado",
        excerpt: "Una nota dominicana .",
        publishedAt: new Date("2026-10-20T15:00:00Z"),
      },
    ]);
  });

  it("reads Atom links and skips invalid entries", () => {
    const atom = `<feed><entry><title>Noticia</title><link rel="alternate" href="/n/1" />
      <updated>2026-10-21T10:00:00Z</updated><summary>Texto</summary></entry>
      <entry><title>Sin fecha</title><link href="/n/2" /></entry></feed>`;
    expect(parseFeedXml(atom, "medio", "https://example.com/feed")).toHaveLength(1);
    expect(parseFeedXml(atom, "medio", "https://example.com/feed")[0].url).toBe(
      "https://example.com/n/1",
    );
  });

  it("paginates configured feeds, filters the week and reports partial failures", async () => {
    const requested: string[] = [];
    const result = await collectFeedArticles(
      [
        {
          id: "medio",
          name: "Medio",
          weight: 1,
          feeds: [
            { url: "https://example.com/feed", paged: true },
            { url: "https://bad.example/feed", paged: false },
          ],
        },
      ],
      weekOf("2026-10-19"),
      async (url) => {
        requested.push(url);
        if (url.startsWith("https://bad")) return { ok: false, status: 503, text: async () => "" };
        return {
          ok: true,
          status: 200,
          text: async () => (url.includes("paged=1") ? rss : "<rss><channel /></rss>"),
        };
      },
    );
    expect(result.articles).toHaveLength(1);
    expect(result.feedsSucceeded).toBe(1);
    expect(result.warnings[0]).toMatch(/HTTP 503/);
    expect(requested).toHaveLength(3);
    expect(requested).toEqual(
      expect.arrayContaining([
        "https://example.com/feed?paged=1",
        "https://example.com/feed?paged=2",
        "https://bad.example/feed",
      ]),
    );
  });
});
