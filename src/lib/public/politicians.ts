// Read models for the public site. Every query here only ever returns
// published profiles. These functions take an executor so they can be tested
// against a real database; pages call the cached wrappers in ./data.ts.
import { and, asc, desc, eq, inArray, isNotNull, type SQL, sql } from "drizzle-orm";
import type { Executor } from "@/db/client";
import { parties, politicians, profileRevisions, provinces, sources } from "@/db/schema";
import { loadProfile, type LoadedProfile } from "@/lib/profiles/load";
import type { ListFilters, RoleGroup } from "./filters";

export const PAGE_SIZE = 20;
// Longer than a three-line card clamp ever shows.
const SUMMARY_PREVIEW_LENGTH = 300;

export type PartyRef = { slug: string; acronym: string; name: string; color: string | null };

export type PoliticianListItem = {
  slug: string;
  name: string;
  fullName: string;
  photoUrl: string | null;
  // The start of the profile summary, enough for a card preview.
  summary: string | null;
  deceased: boolean;
  party: PartyRef | null;
  // The current position, or the most recent one for former office-holders.
  role: { title: string; isCurrent: boolean; province: string | null } | null;
  rank: number | null;
  rankDelta: number | null;
  noRecentData: boolean;
};

export type PoliticianList = {
  items: PoliticianListItem[];
  total: number;
  page: number;
  pageCount: number;
  // week_start of the ranking the order is based on; null before the first run.
  rankingWeek: string | null;
};

export type ListQuery = Omit<ListFilters, "page"> & { page?: number; pageSize?: number };

const searchText = sql`public.politician_search_text(${politicians.fullName}, ${politicians.knownAs}, ${politicians.aliases})`;
const sortName = sql`lower(public.immutable_unaccent(coalesce(${politicians.knownAs}, ${politicians.fullName})))`;

// Institution slugs are the seeded reference rows (src/db/seed/data/institutions.ts).
const currentAt = (condition: SQL) => sql`exists (
  select 1 from positions pos
  left join institutions i on i.id = pos.institution_id
  where pos.politician_id = ${politicians.id} and pos.is_current and ${condition}
)`;

const roleCondition: Record<RoleGroup, SQL> = {
  ejecutivo: currentAt(sql`i.kind in ('executive', 'ministry', 'autonomous_body')`),
  senado: currentAt(sql`i.slug = 'senado'`),
  camara: currentAt(sql`i.slug = 'camara-de-diputados'`),
  alcaldia: currentAt(sql`i.kind = 'local_government'`),
  parlacen: currentAt(sql`i.slug = 'parlacen'`),
  partido: sql`exists (
    select 1 from party_memberships pm
    where pm.politician_id = ${politicians.id} and pm.role = 'leader' and pm.end_date is null
  )`,
  exfuncionario: sql`not exists (
    select 1 from positions pos where pos.politician_id = ${politicians.id} and pos.is_current
  ) and exists (select 1 from positions pos where pos.politician_id = ${politicians.id})`,
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Accent- and case-insensitive: every word must appear in the name, known-as
// name or an alias ("jose pena" finds "José Ramón Peña"), with a trigram
// word-similarity fallback for small typos.
function searchCondition(q: string): SQL {
  const words = q.split(" ").filter(Boolean).slice(0, 8);
  const contains = words.map(
    (w) =>
      sql`${searchText} like '%' || lower(public.immutable_unaccent(${escapeLike(w)})) || '%' escape '\\'`,
  );
  return sql`((${and(...contains)}) or lower(public.immutable_unaccent(${q})) <% ${searchText})`;
}

function listConditions(query: ListQuery): SQL {
  const conditions: SQL[] = [sql`${politicians.status} = 'published'`];
  // PLAN §3: deceased people leave the default list but stay findable by search.
  if (!query.q) conditions.push(sql`${politicians.deathDate} is null`);
  if (query.q) conditions.push(searchCondition(query.q));
  if (query.party) conditions.push(sql`${parties.slug} = ${query.party}`);
  if (query.role) conditions.push(roleCondition[query.role]);
  if (query.province) {
    conditions.push(sql`exists (
      select 1 from positions pos
      left join municipalities m on m.id = pos.municipality_id
      join provinces pr on pr.id = coalesce(pos.province_id, m.province_id)
      where pos.politician_id = ${politicians.id} and pr.slug = ${query.province}
    )`);
  }
  return and(...conditions)!;
}

type ListRow = {
  slug: string;
  full_name: string;
  known_as: string | null;
  photo_url: string | null;
  summary: string | null;
  deceased: boolean;
  party_slug: string | null;
  party_acronym: string | null;
  party_name: string | null;
  party_color: string | null;
  role_title: string | null;
  role_current: boolean | null;
  role_province: string | null;
  rank: number | null;
  rank_delta: number | null;
  no_recent_data: boolean | null;
};

export async function listPublishedPoliticians(
  db: Executor,
  query: ListQuery,
): Promise<PoliticianList> {
  const pageSize = query.pageSize ?? PAGE_SIZE;
  const where = listConditions(query);

  const [{ week }] = await db.execute<{ week: string | null }>(
    sql`select max(week_start)::text as week from popularity_snapshots`,
  );
  const [{ total }] = await db.execute<{ total: number }>(sql`
    select count(*)::int as total
    from ${politicians}
    left join ${parties} on ${parties.id} = ${politicians.currentPartyId}
    where ${where}
  `);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);

  const order =
    query.sort === "name"
      ? sql`${sortName}, ${politicians.slug}`
      : sql`s.rank asc nulls last, ${sortName}, ${politicians.slug}`;

  const rows = await db.execute<ListRow>(sql`
    select
      ${politicians.slug} as slug,
      ${politicians.fullName} as full_name,
      ${politicians.knownAs} as known_as,
      ${politicians.photoUrl} as photo_url,
      nullif(left(${politicians.summary}, ${SUMMARY_PREVIEW_LENGTH}), '') as summary,
      ${politicians.deathDate} is not null as deceased,
      ${parties.slug} as party_slug,
      ${parties.acronym} as party_acronym,
      ${parties.name} as party_name,
      ${parties.color} as party_color,
      role.title as role_title,
      role.is_current as role_current,
      role.province as role_province,
      s.rank,
      s.rank_delta,
      s.no_recent_data
    from ${politicians}
    left join ${parties} on ${parties.id} = ${politicians.currentPartyId}
    left join popularity_snapshots s
      on s.politician_id = ${politicians.id} and s.week_start = ${week}::date
    left join lateral (
      select pos.title, pos.is_current, coalesce(pr.name, mpr.name) as province
      from positions pos
      left join provinces pr on pr.id = pos.province_id
      left join municipalities m on m.id = pos.municipality_id
      left join provinces mpr on mpr.id = m.province_id
      where pos.politician_id = ${politicians.id}
      order by pos.is_current desc, coalesce(pos.end_date, pos.start_date) desc nulls last, pos.title
      limit 1
    ) role on true
    where ${where}
    order by ${order}
    limit ${pageSize} offset ${(page - 1) * pageSize}
  `);

  return {
    items: rows.map((r) => ({
      slug: r.slug,
      name: r.known_as ?? r.full_name,
      fullName: r.full_name,
      photoUrl: r.photo_url,
      summary: r.summary,
      deceased: r.deceased,
      party:
        r.party_slug && r.party_acronym && r.party_name
          ? {
              slug: r.party_slug,
              acronym: r.party_acronym,
              name: r.party_name,
              color: r.party_color,
            }
          : null,
      role: r.role_title
        ? { title: r.role_title, isCurrent: Boolean(r.role_current), province: r.role_province }
        : null,
      rank: r.rank,
      rankDelta: r.rank_delta,
      noRecentData: Boolean(r.no_recent_data),
    })),
    total,
    page,
    pageCount,
    rankingWeek: week,
  };
}

export type FilterOptions = {
  parties: { slug: string; acronym: string; name: string }[];
  provinces: { slug: string; name: string }[];
};

// Only values that lead to at least one published profile.
export async function listFilterOptions(db: Executor): Promise<FilterOptions> {
  const [partyRows, provinceRows] = await Promise.all([
    db
      .selectDistinct({ slug: parties.slug, acronym: parties.acronym, name: parties.name })
      .from(parties)
      .innerJoin(politicians, eq(politicians.currentPartyId, parties.id))
      .where(eq(politicians.status, "published"))
      .orderBy(asc(parties.acronym)),
    db.execute<{ slug: string; name: string }>(sql`
      select distinct pr.slug, pr.name
      from positions pos
      join politicians p on p.id = pos.politician_id and p.status = 'published'
      left join municipalities m on m.id = pos.municipality_id
      join provinces pr on pr.id = coalesce(pos.province_id, m.province_id)
      order by pr.name
    `),
  ]);
  return { parties: partyRows, provinces: [...provinceRows] };
}

export async function getParty(db: Executor, slug: string) {
  const [party] = await db
    .select({
      id: parties.id,
      slug: parties.slug,
      acronym: parties.acronym,
      name: parties.name,
      color: parties.color,
      status: parties.status,
    })
    .from(parties)
    .where(eq(parties.slug, slug));
  return party ?? null;
}

export async function getProvince(db: Executor, slug: string) {
  const [province] = await db
    .select({
      id: provinces.id,
      slug: provinces.slug,
      name: provinces.name,
      region: provinces.region,
    })
    .from(provinces)
    .where(eq(provinces.slug, slug));
  return province ?? null;
}

export type PublicProfile = LoadedProfile & {
  party: PartyRef | null;
  // Archived copies (Wayback) by source URL, when the archive job has stored one.
  archiveUrls: Record<string, string>;
  revisions: { at: Date; note: string | null }[];
};

export async function getPublicProfile(db: Executor, slug: string): Promise<PublicProfile | null> {
  const profile = await loadProfile(db, { slug });
  if (!profile || profile.status !== "published") return null;

  const urls = profile.payload.sources.map((s) => s.url);
  const [partyRows, archiveRows, revisionRows] = await Promise.all([
    db
      .select({
        slug: parties.slug,
        acronym: parties.acronym,
        name: parties.name,
        color: parties.color,
      })
      .from(politicians)
      .innerJoin(parties, eq(parties.id, politicians.currentPartyId))
      .where(eq(politicians.id, profile.id)),
    urls.length
      ? db
          .select({ url: sources.url, archiveUrl: sources.archiveUrl })
          .from(sources)
          .where(and(inArray(sources.url, urls), isNotNull(sources.archiveUrl)))
      : [],
    db
      .select({ at: profileRevisions.createdAt, note: profileRevisions.note })
      .from(profileRevisions)
      .where(eq(profileRevisions.politicianId, profile.id))
      .orderBy(desc(profileRevisions.createdAt))
      .limit(10),
  ]);

  return {
    ...profile,
    party: partyRows[0] ?? null,
    archiveUrls: Object.fromEntries(archiveRows.map((r) => [r.url, r.archiveUrl!])),
    revisions: revisionRows,
  };
}

export type SitemapData = {
  politicians: { slug: string; updatedAt: Date }[];
  parties: { slug: string }[];
  provinces: { slug: string }[];
};

export async function listSitemapData(db: Executor): Promise<SitemapData> {
  const [politicianRows, options] = await Promise.all([
    db
      .select({ slug: politicians.slug, updatedAt: politicians.updatedAt })
      .from(politicians)
      .where(eq(politicians.status, "published"))
      .orderBy(asc(politicians.slug)),
    listFilterOptions(db),
  ]);
  return {
    politicians: politicianRows,
    parties: options.parties.map(({ slug }) => ({ slug })),
    provinces: options.provinces.map(({ slug }) => ({ slug })),
  };
}

export async function listPublishedSlugs(db: Executor, limit: number): Promise<string[]> {
  const rows = await db
    .select({ slug: politicians.slug })
    .from(politicians)
    .where(eq(politicians.status, "published"))
    .orderBy(desc(politicians.publishedAt))
    .limit(limit);
  return rows.map((r) => r.slug);
}
