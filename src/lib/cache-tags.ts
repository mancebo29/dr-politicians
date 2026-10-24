// Cache tags shared by public pages and the jobs that invalidate them.
export const CACHE_TAGS = {
  politicians: "politicians",
  politician: (slug: string) => `politician:${slug}`,
  ranking: "ranking",
  settings: "site-settings",
} as const;
