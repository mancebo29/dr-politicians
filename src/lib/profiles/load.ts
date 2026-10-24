import { asc, eq, inArray } from "drizzle-orm";
import type { Executor } from "@/db/client";
import {
  alliances,
  claimSources,
  claimTypes,
  controversies,
  institutions,
  legislation,
  municipalities,
  parties,
  partyMemberships,
  politicianLegislation,
  politicians,
  positions,
  provinces,
  sources,
  statements,
} from "@/db/schema";
import { fromDbDate } from "@/lib/partial-date";
import type { ResearchPayload } from "@/lib/research/schema";

type ClaimType = (typeof claimTypes)[number];

export type LoadedProfile = {
  id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  publishedAt: Date | null;
  updatedAt: Date;
  // Same shape as a research submission, so reviews can diff the two directly.
  payload: ResearchPayload;
};

// Rebuilds a stored profile in the research-payload shape. Source ids are
// local to the result ("s1", "s2", …) in first-cited order.
export async function loadProfile(
  db: Executor,
  where: { id: string } | { slug: string },
): Promise<LoadedProfile | null> {
  const [p] = await db
    .select()
    .from(politicians)
    .where("id" in where ? eq(politicians.id, where.id) : eq(politicians.slug, where.slug));
  if (!p) return null;

  const [
    positionRows,
    membershipRows,
    allianceRows,
    legislationRows,
    statementRows,
    controversyRows,
  ] = await Promise.all([
    db
      .select({
        row: positions,
        institution: institutions.name,
        institutionKind: institutions.kind,
        province: provinces.name,
        municipality: municipalities.name,
      })
      .from(positions)
      .leftJoin(institutions, eq(positions.institutionId, institutions.id))
      .leftJoin(provinces, eq(positions.provinceId, provinces.id))
      .leftJoin(municipalities, eq(positions.municipalityId, municipalities.id))
      .where(eq(positions.politicianId, p.id))
      .orderBy(asc(positions.startDate), asc(positions.title)),
    db
      .select({ row: partyMemberships, acronym: parties.acronym, name: parties.name })
      .from(partyMemberships)
      .innerJoin(parties, eq(partyMemberships.partyId, parties.id))
      .where(eq(partyMemberships.politicianId, p.id))
      .orderBy(asc(partyMemberships.startDate)),
    db
      .select()
      .from(alliances)
      .where(eq(alliances.politicianId, p.id))
      .orderBy(asc(alliances.startDate)),
    db
      .select({ link: politicianLegislation, law: legislation })
      .from(politicianLegislation)
      .innerJoin(legislation, eq(politicianLegislation.legislationId, legislation.id))
      .where(eq(politicianLegislation.politicianId, p.id))
      .orderBy(asc(legislation.promulgatedOn), asc(legislation.title)),
    db
      .select()
      .from(statements)
      .where(eq(statements.politicianId, p.id))
      .orderBy(asc(statements.saidOn)),
    db
      .select()
      .from(controversies)
      .where(eq(controversies.politicianId, p.id))
      .orderBy(asc(controversies.startedOn)),
  ]);

  const claimIds: Record<ClaimType, string[]> = {
    politician_summary: [p.id],
    position: positionRows.map((r) => r.row.id),
    party_membership: membershipRows.map((r) => r.row.id),
    alliance: allianceRows.map((r) => r.id),
    politician_legislation: legislationRows.map((r) => r.link.id),
    statement: statementRows.map((r) => r.id),
    controversy: controversyRows.map((r) => r.id),
  };
  const allClaimIds = Object.values(claimIds).flat();
  const links = await db
    .select({
      claimType: claimSources.claimType,
      claimId: claimSources.claimId,
      excerpt: claimSources.quoteExcerpt,
      source: sources,
    })
    .from(claimSources)
    .innerJoin(sources, eq(claimSources.sourceId, sources.id))
    .where(inArray(claimSources.claimId, allClaimIds))
    .orderBy(asc(claimSources.createdAt), asc(sources.url));

  const localIds = new Map<string, string>();
  const sourceList: ResearchPayload["sources"] = [];
  function localId(source: typeof sources.$inferSelect, excerpt: string | null) {
    let id = localIds.get(source.id);
    if (!id) {
      id = `s${localIds.size + 1}`;
      localIds.set(source.id, id);
      sourceList.push({
        id,
        url: source.url,
        title: source.title,
        publisher: source.publisher,
        publishedOn: source.publishedOn,
        accessedOn: source.accessedOn,
        tier: source.tier,
        excerpt,
      });
    }
    return id;
  }

  const byClaim = new Map<string, string[]>();
  for (const link of links) {
    if (!claimIds[link.claimType].includes(link.claimId)) continue;
    const key = `${link.claimType}:${link.claimId}`;
    byClaim.set(key, [...(byClaim.get(key) ?? []), localId(link.source, link.excerpt)]);
  }
  const refs = (type: ClaimType, id: string) => byClaim.get(`${type}:${id}`) ?? [];

  if (p.photoSourceId) {
    const [photoSource] = await db.select().from(sources).where(eq(sources.id, p.photoSourceId));
    if (photoSource) localId(photoSource, null);
  }

  const payload: ResearchPayload = {
    schemaVersion: 1,
    livingStatus: {
      isAlive: !p.deathDate,
      checkedOn: p.updatedAt.toISOString().slice(0, 10),
      sourceIds: [],
    },
    politician: {
      fullName: p.fullName,
      knownAs: p.knownAs,
      aliases: p.aliases,
      birthDate: fromDbDate(p.birthDate, p.birthDatePrecision),
      birthPlace: p.birthPlace,
      deathDate: fromDbDate(p.deathDate, p.deathDatePrecision),
      summary: p.summary ?? "",
      summarySourceIds: refs("politician_summary", p.id),
    },
    positions: positionRows.map(({ row, ...ref }) => ({
      title: row.title,
      institution: ref.institution ?? "",
      institutionKind: ref.institutionKind,
      province: ref.province,
      municipality: ref.municipality,
      start: fromDbDate(row.startDate, row.startDatePrecision),
      end: fromDbDate(row.endDate, row.endDatePrecision),
      howObtained: row.howObtained,
      isCurrent: row.isCurrent,
      sourceIds: refs("position", row.id),
    })),
    partyMemberships: membershipRows.map(({ row, acronym, name }) => ({
      party: { acronym, name },
      role: row.role,
      start: fromDbDate(row.startDate, row.startDatePrecision),
      end: fromDbDate(row.endDate, row.endDatePrecision),
      exitReason: row.exitReason,
      sourceIds: refs("party_membership", row.id),
    })),
    alliances: allianceRows.map((row) => ({
      counterparty: row.counterparty,
      kind: row.kind,
      description: row.description,
      start: fromDbDate(row.startDate, row.startDatePrecision),
      end: fromDbDate(row.endDate, row.endDatePrecision),
      sourceIds: refs("alliance", row.id),
    })),
    legislation: legislationRows.map(({ link, law }) => ({
      title: law.title,
      number: law.number,
      kind: law.kind,
      status: law.status,
      introducedOn: law.introducedOn,
      promulgatedOn: law.promulgatedOn,
      officialUrl: law.officialUrl,
      involvement: link.involvement,
      notes: link.notes,
      sourceIds: refs("politician_legislation", link.id),
    })),
    statements: statementRows.map((row) => ({
      kind: row.kind,
      topic: row.topic,
      quote: row.quote,
      context: row.context,
      saidOn: fromDbDate(row.saidOn, row.saidOnPrecision),
      sourceIds: refs("statement", row.id),
    })),
    controversies: controversyRows.map((row) => ({
      title: row.title,
      summary: row.summary,
      startedOn: fromDbDate(row.startedOn, row.startedOnPrecision),
      legalStatus: row.legalStatus,
      politicianResponse: row.politicianResponse,
      sourceIds: refs("controversy", row.id),
    })),
    photo:
      p.photoUrl && p.photoSourceId && localIds.has(p.photoSourceId)
        ? {
            url: p.photoUrl,
            license: p.photoLicense ?? "",
            sourceId: localIds.get(p.photoSourceId)!,
          }
        : null,
    sources: sourceList,
    gaps: [],
    confidenceNotes: null,
  };

  return {
    id: p.id,
    slug: p.slug,
    status: p.status,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
    payload,
  };
}
