import { env } from "@/lib/env";

export const SITE_NAME = "Políticos RD";
export const SITE_DESCRIPTION =
  "Perfiles con fuentes de los políticos de la República Dominicana: trayectoria, leyes, partidos, declaraciones y controversias.";

// BETTER_AUTH_URL is the app's public origin, so it doubles as the canonical
// site URL for metadata, the sitemap and robots.txt.
export function siteUrl(): URL {
  return new URL(env().BETTER_AUTH_URL);
}
