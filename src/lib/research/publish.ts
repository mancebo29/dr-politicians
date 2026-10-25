import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Database, Transaction } from "@/db/client";
import {
  alliances,
  auditLog,
  claimSources,
  claimTypes,
  controversies,
  institutions,
  legislation,
  parties,
  partyMemberships,
  politicianLegislation,
  politicians,
  positions,
  profileRevisions,
  researchJobs,
  researchSubmissions,
  sources,
  statements,
  workRecordItems,
} from "@/db/schema";
import { toDbDate } from "@/lib/partial-date";
import { loadProfile } from "@/lib/profiles/load";
import { slugify } from "@/lib/slug";
import { diffPayloads, diffSummary } from "./diff";
import { checkReferences, loadReferenceIndex, provinceKey } from "./references";
import { claimSections, type ClaimSection, researchPayloadSchema } from "./schema";

export const publishSections = ["politician", "photo", ...claimSections] as const;
export type PublishSection = (typeof publishSections)[number];

export class PublishError extends Error {}

type ClaimType = (typeof claimTypes)[number];

const claimTable = {
  positions: { table: positions, type: "position" },
  workRecord: { table: workRecordItems, type: "work_record_item" },
  partyMemberships: { table: partyMemberships, type: "party_membership" },
  alliances: { table: alliances, type: "alliance" },
  legislation: { table: politicianLegislation, type: "politician_legislation" },
  statements: { table: statements, type: "statement" },
  controversies: { table: controversies, type: "controversy" },
} as const satisfies Record<ClaimSection, { table: unknown; type: ClaimType }>;

function period(start?: string | null, end?: string | null) {
  const s = toDbDate(start);
  const e = toDbDate(end);
  return {
    startDate: s.date,
    startDatePrecision: s.precision,
    endDate: e.date,
    endDatePrecision: e.precision,
  };
}

async function uniqueSlug(tx: Transaction, base: string) {
  const root = slugify(base) || "politico";
  for (let n = 1; ; n++) {
    const slug = n === 1 ? root : `${root}-${n}`;
    const [taken] = await tx
      .select({ id: politicians.id })
      .from(politicians)
      .where(eq(politicians.slug, slug));
    if (!taken) return slug;
  }
}

export type PublishInput = {
  submissionId: string;
  reviewerUserId: string;
  // Sections not listed keep the currently published data (PLAN §8.1 per-section accept).
  sections: readonly PublishSection[];
  // Optional; revisions without one read "Aprobado sin nota" in the history.
  note?: string | null;
};

// Applies an approved research submission to the live profile in one
// transaction: either the whole publish lands, with its revision and audit
// entries, or nothing changes. Server Action callers must then invalidate the
// public caches with invalidatePublicProfile(slug) (src/lib/public/invalidate.ts).
export async function publishSubmission(db: Database, input: PublishInput) {
  const note = input.note?.trim() || null;
  const include = new Set(input.sections);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ submission: researchSubmissions, job: researchJobs })
      .from(researchSubmissions)
      .innerJoin(researchJobs, eq(researchSubmissions.jobId, researchJobs.id))
      .where(eq(researchSubmissions.id, input.submissionId))
      .for("update");
    if (!row) throw new PublishError("Submission not found");
    const { submission, job } = row;
    if (job.kind === "roster_discovery") {
      throw new PublishError("Rosters are approved from their review page, not published");
    }
    if (job.status !== "submitted" || submission.decidedAt) {
      throw new PublishError(`Job is ${job.status}; only submitted jobs can be published`);
    }

    const parsed = researchPayloadSchema.safeParse(submission.payload);
    if (!parsed.success) throw new PublishError("Submission no longer matches the research schema");
    const payload = parsed.data;

    const isNew = !job.politicianId;
    if (isNew && !include.has("politician")) {
      throw new PublishError("A new profile must include the politician section");
    }
    if (isNew && !payload.livingStatus.isAlive) {
      throw new PublishError("This submission reports the person as deceased; reject or cancel it");
    }

    const index = await loadReferenceIndex(tx);
    const refs = checkReferences(index, payload);
    if (refs.errors.length) throw new PublishError(refs.errors.join("; "));

    const before = job.politicianId ? await loadProfile(tx, { id: job.politicianId }) : null;

    // Sources are shared across profiles and keyed by URL.
    const sourceIds = new Map<string, string>();
    const excerpts = new Map<string, string | null>();
    for (const source of payload.sources) {
      const [saved] = await tx
        .insert(sources)
        .values({
          url: source.url,
          title: source.title,
          publisher: source.publisher,
          publishedOn: source.publishedOn ?? null,
          accessedOn: toDbDate(source.accessedOn).date!,
          tier: source.tier,
        })
        .onConflictDoUpdate({
          target: sources.url,
          set: {
            title: sql`excluded.title`,
            publisher: sql`excluded.publisher`,
            publishedOn: sql`coalesce(excluded.published_on, ${sources.publishedOn})`,
            accessedOn: sql`greatest(excluded.accessed_on, ${sources.accessedOn})`,
            tier: sql`excluded.tier`,
          },
        })
        .returning({ id: sources.id });
      sourceIds.set(source.id, saved.id);
      excerpts.set(source.id, source.excerpt ?? null);
    }

    async function link(type: ClaimType, claimId: string, localIds: string[]) {
      await tx.insert(claimSources).values(
        [...new Set(localIds)].map((id) => ({
          claimType: type,
          claimId,
          sourceId: sourceIds.get(id)!,
          quoteExcerpt: excerpts.get(id) ?? null,
        })),
      );
    }

    const p = payload.politician;
    const birth = toDbDate(p.birthDate);
    const death = toDbDate(p.deathDate);
    const politicianFields = {
      fullName: p.fullName,
      knownAs: p.knownAs ?? null,
      aliases: p.aliases,
      birthDate: birth.date,
      birthDatePrecision: birth.precision,
      birthPlace: p.birthPlace ?? null,
      deathDate: death.date,
      deathDatePrecision: death.precision,
      summary: p.summary,
    };

    let politicianId = job.politicianId;
    if (!politicianId) {
      const [created] = await tx
        .insert(politicians)
        .values({ slug: await uniqueSlug(tx, p.knownAs ?? p.fullName), ...politicianFields })
        .returning({ id: politicians.id });
      politicianId = created.id;
    } else if (include.has("politician")) {
      await tx.update(politicians).set(politicianFields).where(eq(politicians.id, politicianId));
    }

    if (include.has("politician")) {
      await tx
        .delete(claimSources)
        .where(
          and(
            eq(claimSources.claimType, "politician_summary"),
            eq(claimSources.claimId, politicianId),
          ),
        );
      await link("politician_summary", politicianId, p.summarySourceIds);
    }

    if (include.has("photo")) {
      await tx
        .update(politicians)
        .set({
          photoUrl: payload.photo?.url ?? null,
          photoLicense: payload.photo?.license ?? null,
          photoSourceId: payload.photo ? sourceIds.get(payload.photo.sourceId)! : null,
        })
        .where(eq(politicians.id, politicianId));
    }

    async function institutionId(
      name: string,
      kind: (typeof institutions.$inferInsert)["kind"] | null | undefined,
    ) {
      const existing = index.institutions.get(slugify(name));
      if (existing) return existing.id;
      const [created] = await tx
        .insert(institutions)
        .values({ slug: slugify(name), name, kind: kind ?? "other" })
        .onConflictDoUpdate({ target: institutions.slug, set: { name: sql`${institutions.name}` } })
        .returning({ id: institutions.id, slug: institutions.slug, name: institutions.name });
      index.institutions.set(created.slug, created);
      return created.id;
    }

    async function partyId(party: { acronym: string; name: string }) {
      const acronym = party.acronym.toUpperCase();
      const existing = index.parties.get(acronym);
      if (existing) return existing.id;
      const [created] = await tx
        .insert(parties)
        .values({ slug: slugify(acronym), acronym, name: party.name })
        .returning({ id: parties.id, acronym: parties.acronym, name: parties.name });
      index.parties.set(acronym, created);
      return created.id;
    }

    for (const section of claimSections) {
      if (!include.has(section)) continue;
      const { table, type } = claimTable[section];
      // Delete triggers remove the replaced claims' source links.
      await tx.delete(table).where(eq(table.politicianId, politicianId));

      for (const claim of payload[section]) {
        let id: string;
        if (section === "positions") {
          const c = claim as (typeof payload.positions)[number];
          [{ id }] = await tx
            .insert(positions)
            .values({
              politicianId,
              title: c.title,
              institutionId: await institutionId(c.institution, c.institutionKind),
              provinceId: c.province ? index.provinces.get(provinceKey(c.province))!.id : null,
              municipalityId: c.municipality
                ? index.municipalities.get(slugify(c.municipality))!.id
                : null,
              ...period(c.start, c.end),
              howObtained: c.howObtained ?? null,
              isCurrent: c.isCurrent,
            })
            .returning({ id: positions.id });
        } else if (section === "workRecord") {
          const c = claim as (typeof payload.workRecord)[number];
          [{ id }] = await tx
            .insert(workRecordItems)
            .values({
              politicianId,
              title: c.title,
              kind: c.kind,
              status: c.status,
              topic: c.topic,
              office: c.office ?? null,
              description: c.description,
              ...period(c.start, c.end),
            })
            .returning({ id: workRecordItems.id });
        } else if (section === "partyMemberships") {
          const c = claim as (typeof payload.partyMemberships)[number];
          [{ id }] = await tx
            .insert(partyMemberships)
            .values({
              politicianId,
              partyId: await partyId(c.party),
              role: c.role,
              ...period(c.start, c.end),
              exitReason: c.exitReason ?? null,
            })
            .returning({ id: partyMemberships.id });
        } else if (section === "alliances") {
          const c = claim as (typeof payload.alliances)[number];
          [{ id }] = await tx
            .insert(alliances)
            .values({
              politicianId,
              counterparty: c.counterparty,
              kind: c.kind,
              description: c.description,
              ...period(c.start, c.end),
            })
            .returning({ id: alliances.id });
        } else if (section === "legislation") {
          const c = claim as (typeof payload.legislation)[number];
          const values = {
            title: c.title,
            number: c.number ?? null,
            kind: c.kind,
            status: c.status,
            introducedOn: c.introducedOn ?? null,
            promulgatedOn: c.promulgatedOn ?? null,
            officialUrl: c.officialUrl ?? null,
          };
          const [existing] = c.number
            ? await tx
                .select({ id: legislation.id })
                .from(legislation)
                .where(and(eq(legislation.kind, c.kind), eq(legislation.number, c.number)))
            : [];
          let legislationId: string;
          if (existing) {
            await tx.update(legislation).set(values).where(eq(legislation.id, existing.id));
            legislationId = existing.id;
          } else {
            [{ id: legislationId }] = await tx
              .insert(legislation)
              .values(values)
              .returning({ id: legislation.id });
          }
          const [inserted] = await tx
            .insert(politicianLegislation)
            .values({
              politicianId,
              legislationId,
              involvement: c.involvement,
              notes: c.notes ?? null,
            })
            .onConflictDoNothing()
            .returning({ id: politicianLegislation.id });
          // The same law and involvement listed twice: keep the first.
          if (!inserted) continue;
          id = inserted.id;
        } else if (section === "statements") {
          const c = claim as (typeof payload.statements)[number];
          const said = toDbDate(c.saidOn);
          [{ id }] = await tx
            .insert(statements)
            .values({
              politicianId,
              kind: c.kind,
              topic: c.topic,
              quote: c.quote ?? null,
              context: c.context,
              saidOn: said.date,
              saidOnPrecision: said.precision,
            })
            .returning({ id: statements.id });
        } else {
          const c = claim as (typeof payload.controversies)[number];
          const started = toDbDate(c.startedOn);
          [{ id }] = await tx
            .insert(controversies)
            .values({
              politicianId,
              title: c.title,
              summary: c.summary,
              startedOn: started.date,
              startedOnPrecision: started.precision,
              legalStatus: c.legalStatus,
              politicianResponse: c.politicianResponse ?? null,
              lastVerifiedOn: toDbDate(payload.livingStatus.checkedOn).date!,
            })
            .returning({ id: controversies.id });
        }
        await link(type, id, claim.sourceIds);
      }
    }

    // Current party = the open membership that started most recently.
    const [currentParty] = await tx
      .select({ partyId: partyMemberships.partyId })
      .from(partyMemberships)
      .where(and(eq(partyMemberships.politicianId, politicianId), isNull(partyMemberships.endDate)))
      .orderBy(desc(partyMemberships.startDate))
      .limit(1);

    const now = new Date();
    await tx
      .update(politicians)
      .set({
        currentPartyId: currentParty?.partyId ?? null,
        status: "published",
        publishedAt: sql`coalesce(${politicians.publishedAt}, ${now.toISOString()}::timestamptz)`,
      })
      .where(eq(politicians.id, politicianId));

    const unsourced = await tx.execute<{ claim_type: string }>(
      sql`select claim_type from unsourced_claims where politician_id = ${politicianId}`,
    );
    if (unsourced.length) {
      throw new PublishError(
        `Unsourced claims would be published: ${unsourced.map((r) => r.claim_type).join(", ")}`,
      );
    }

    const after = (await loadProfile(tx, { id: politicianId }))!;
    const diff = diffPayloads(before?.payload ?? null, after.payload);

    await tx.insert(profileRevisions).values({
      politicianId,
      snapshot: after.payload,
      diff: { sections: [...include], ...diffSummary(diff) },
      origin: "research_submission",
      submissionId: submission.id,
      actorUserId: input.reviewerUserId,
      note: note ?? "Aprobado sin nota",
    });
    await tx
      .update(researchSubmissions)
      .set({ reviewerUserId: input.reviewerUserId, reviewNotes: note, decidedAt: now })
      .where(eq(researchSubmissions.id, submission.id));
    await tx
      .update(researchJobs)
      .set({ status: "approved", politicianId, leaseExpiresAt: null, claimedByTokenId: null })
      .where(eq(researchJobs.id, job.id));
    await tx.insert(auditLog).values({
      actorUserId: input.reviewerUserId,
      action: "profile.publish",
      entity: "politician",
      entityId: politicianId,
      after: { submissionId: submission.id, sections: [...include] },
    });

    return { politicianId, slug: after.slug, created: isNew };
  });
}
