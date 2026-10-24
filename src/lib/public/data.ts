// Cached public reads. Tags follow src/lib/cache-tags.ts: lists depend on the
// set of published profiles and on the weekly ranking; a profile page depends
// only on its own profile. Publishing and the ranking job invalidate them.
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { loadSetting } from "@/lib/site-settings";
import * as queries from "./politicians";

export async function getPoliticianList(query: queries.ListQuery) {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.politicians, CACHE_TAGS.ranking);
  return queries.listPublishedPoliticians(db, query);
}

export async function getFilterOptions() {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.politicians);
  return queries.listFilterOptions(db);
}

export async function getParty(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.politicians);
  return queries.getParty(db, slug);
}

export async function getProvince(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.politicians);
  return queries.getProvince(db, slug);
}

export async function getPublicProfile(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.politician(slug));
  return queries.getPublicProfile(db, slug);
}

export async function getSitemapData() {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.politicians, CACHE_TAGS.ranking);
  return queries.listSitemapData(db);
}

export async function getPrerenderSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.politicians);
  return queries.listPublishedSlugs(db, 50);
}

// Saving settings in /admin/configuracion invalidates CACHE_TAGS.settings.
export async function getContentSettings() {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.settings);
  return loadSetting(db, "content");
}

export async function getRegistrationSettings() {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.settings);
  return loadSetting(db, "registration");
}
