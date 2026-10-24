import type { MetadataRoute } from "next";
import { getSitemapData } from "@/lib/public/data";
import { siteUrl } from "@/lib/public/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { politicians, parties, provinces } = await getSitemapData();
  const url = (path: string) => new URL(path, siteUrl()).toString();
  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/metodologia"), changeFrequency: "monthly", priority: 0.3 },
    { url: url("/privacidad"), changeFrequency: "yearly", priority: 0.1 },
    { url: url("/terminos"), changeFrequency: "yearly", priority: 0.1 },
    ...politicians.map((p) => ({
      url: url(`/politicos/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...parties.map((p) => ({
      url: url(`/partidos/${p.slug}`),
      changeFrequency: "weekly" as const,
    })),
    ...provinces.map((p) => ({
      url: url(`/provincias/${p.slug}`),
      changeFrequency: "weekly" as const,
    })),
  ];
}
