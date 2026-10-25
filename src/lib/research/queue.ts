import { createHash } from "node:crypto";
import { and, desc, eq, gt, ilike, inArray, lt, or, sql, type SQLWrapper } from "drizzle-orm";
import type { Database, Executor, Transaction } from "@/db/client";
import {
  auditLog,
  parties,
  politicians,
  provinces,
  researchJobs,
  researchSubmissions,
} from "@/db/schema";
import { loadProfile } from "@/lib/profiles/load";
import { checkReferences, loadReferenceIndex, type ReferenceReport } from "./references";
import { type RosterPayload, rosterInstructions, rosterPayloadSchema } from "./roster";
import {
  formatIssues,
  RESEARCH_SCHEMA_VERSION,
  type ResearchPayload,
  researchPayloadSchema,
} from "./schema";
import { nextWaveSegment, waveSegment, type WaveSegment } from "./waves";

export const LEASE_MS = 2 * 60 * 60 * 1000;

export class QueueError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 422 = 409,
    readonly issues?: string[],
  ) {
    super(message);
  }
}

type JobKind = (typeof researchJobs.$inferInsert)["kind"];

// Accepts a transaction so callers (e.g. feedback triage) can queue a job
// atomically with their own changes.
export async function createJob(
  db: Database | Transaction,
  input: {
    kind: JobKind;
    politicianId?: string | null;
    requestedName?: string | null;
    instructions?: string | null;
    priority?: number;
    wave?: number | null;
    createdByUserId?: string | null;
  },
) {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .insert(researchJobs)
      .values({
        kind: input.kind,
        politicianId: input.politicianId ?? null,
        requestedName: input.requestedName?.trim() || null,
        instructions: input.instructions?.trim() || null,
        priority: input.priority ?? 0,
        wave: input.wave ?? null,
        createdByUserId: input.createdByUserId ?? null,
      })
      .returning();
    await tx.insert(auditLog).values({
      actorUserId: input.createdByUserId ?? null,
      action: "research_job.create",
      entity: "research_job",
      entityId: job.id,
      after: job,
    });
    return job;
  });
}

const openStatuses = ["queued", "claimed", "submitted", "in_review", "needs_changes"] as const;

export const skipReasonLabel = {
  repeated: "repetido en la lista",
  open_job: "ya tiene una investigación abierta",
  profile: "ya existe un perfil con ese nombre",
} as const;
export type SkipReason = keyof typeof skipReasonLabel;

// For each name, in order: its accent- and case-insensitive key, and whether a
// profile or an open job already covers it. One query, however long the list.
export async function findExisting(ex: Executor, names: string[]) {
  if (!names.length) return [];
  const norm = (value: SQLWrapper) => sql`lower(public.immutable_unaccent(${value}))`;
  const list = sql`array[${sql.join(
    names.map((n) => sql`${n}`),
    sql`, `,
  )}]::text[]`;
  const rows = await ex.execute<{ key: string; reason: "open_job" | "profile" | null }>(sql`
    select ${norm(sql`n.name`)} as key,
      case
        when exists (
          select 1 from ${researchJobs} j
          where ${norm(sql`j.requested_name`)} = ${norm(sql`n.name`)}
            and j.kind = 'new_profile'
            and j.status in (${sql.join(
              openStatuses.map((st) => sql`${st}`),
              sql`, `,
            )})
        ) then 'open_job'
        when exists (
          select 1 from ${politicians} p
          where ${norm(sql`p.full_name`)} = ${norm(sql`n.name`)}
             or ${norm(sql`p.known_as`)} = ${norm(sql`n.name`)}
        ) then 'profile'
      end as reason
    from unnest(${list}) with ordinality as n(name, ord)
    order by n.ord`);
  return [...rows];
}

type JobsInput = {
  people: { name: string; instructions?: string | null }[];
  priority?: number;
  wave?: number | null;
  createdByUserId?: string | null;
};

async function insertJobs(tx: Executor, input: JobsInput, now: Date) {
  const created: (typeof researchJobs.$inferSelect)[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const names = input.people.map((p) => p.name.trim());
  const existing = await findExisting(tx, names);
  const seen = new Set<string>();

  for (const [i, person] of input.people.entries()) {
    const name = names[i];
    const { key, reason } = existing[i];
    const skip: SkipReason | null = seen.has(key) ? "repeated" : reason;
    seen.add(key);
    if (skip) {
      skipped.push({ name, reason: skipReasonLabel[skip] });
      continue;
    }
    const [job] = await tx
      .insert(researchJobs)
      .values({
        kind: "new_profile",
        requestedName: name,
        instructions: person.instructions?.trim() || null,
        priority: input.priority ?? 0,
        wave: input.wave ?? null,
        createdByUserId: input.createdByUserId ?? null,
        // Jobs of equal priority are claimed oldest first; one millisecond
        // apart keeps the claim order equal to the list order.
        createdAt: new Date(now.getTime() + created.length),
      })
      .returning();
    await tx.insert(auditLog).values({
      actorUserId: input.createdByUserId ?? null,
      action: "research_job.create",
      entity: "research_job",
      entityId: job.id,
      after: job,
    });
    created.push(job);
  }
  return { created, skipped };
}

// Queues new-profile jobs for a wave, one per person, in list order. Names that
// repeat in the list, already have an open job, or match a profile's name are
// skipped and reported, so pasting the same list twice queues nothing new.
export async function createJobs(db: Database, input: JobsInput, now = new Date()) {
  return db.transaction((tx) => insertJobs(tx, input, now));
}

// Discovery runs before the profiles of earlier waves, so its roster can be
// reviewed while those profiles are researched.
export const DISCOVERY_PRIORITY = 100;

async function insertDiscoveryJob(
  tx: Executor,
  segment: WaveSegment,
  createdByUserId: string | null,
) {
  const [job] = await tx
    .insert(researchJobs)
    .values({
      kind: "roster_discovery",
      requestedName: segment.title,
      instructions: segment.criteria,
      wave: segment.wave,
      rosterSegment: segment.key,
      priority: DISCOVERY_PRIORITY,
      createdByUserId,
    })
    .returning();
  await tx.insert(auditLog).values({
    actorUserId: createdByUserId,
    action: "research_job.create",
    entity: "research_job",
    entityId: job.id,
    after: job,
  });
  return job;
}

export async function createDiscoveryJob(
  db: Database,
  input: { segmentKey: string; createdByUserId?: string | null },
) {
  const segment = waveSegment(input.segmentKey);
  if (!segment) throw new QueueError("Unknown wave segment", 400);
  return db.transaction(async (tx) => {
    const [open] = await tx
      .select({ id: researchJobs.id })
      .from(researchJobs)
      .where(
        and(
          eq(researchJobs.rosterSegment, segment.key),
          inArray(researchJobs.status, [...openStatuses]),
        ),
      )
      .limit(1);
    if (open) throw new QueueError("This segment already has an open discovery job");
    return insertDiscoveryJob(tx, segment, input.createdByUserId ?? null);
  });
}

const claimable = (now: Date) =>
  or(
    inArray(researchJobs.status, ["queued", "needs_changes"]),
    and(eq(researchJobs.status, "claimed"), lt(researchJobs.leaseExpiresAt, now)),
  );

// Hands the highest-priority available job to a research token. Expired leases
// count as available, so a crashed session never strands a job.
export async function claimNextJob(db: Database, tokenId: string, now = new Date()) {
  const job = await db.transaction(async (tx) => {
    const [next] = await tx
      .select({ id: researchJobs.id })
      .from(researchJobs)
      .where(claimable(now))
      .orderBy(desc(researchJobs.priority), researchJobs.createdAt)
      .limit(1)
      .for("update", { skipLocked: true });
    if (!next) return null;
    const [claimed] = await tx
      .update(researchJobs)
      .set({
        status: "claimed",
        claimedByTokenId: tokenId,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        attempts: sql`${researchJobs.attempts} + 1`,
      })
      .where(eq(researchJobs.id, next.id))
      .returning();
    return claimed;
  });
  return job ? buildBrief(db, job) : null;
}

async function buildBrief(db: Database, job: typeof researchJobs.$inferSelect) {
  const [current, previous, partyRows, provinceRows] = await Promise.all([
    job.politicianId ? loadProfile(db, { id: job.politicianId }) : null,
    db
      .select({
        reviewNotes: researchSubmissions.reviewNotes,
        decidedAt: researchSubmissions.decidedAt,
      })
      .from(researchSubmissions)
      .where(eq(researchSubmissions.jobId, job.id))
      .orderBy(desc(researchSubmissions.createdAt))
      .limit(1),
    db
      .select({ acronym: parties.acronym, name: parties.name })
      .from(parties)
      .orderBy(parties.acronym),
    db.select({ name: provinces.name }).from(provinces).orderBy(provinces.name),
  ]);
  const segment = job.rosterSegment ? waveSegment(job.rosterSegment) : undefined;
  return {
    schemaVersion: RESEARCH_SCHEMA_VERSION,
    job: {
      id: job.id,
      kind: job.kind,
      requestedName: job.requestedName,
      instructions: job.instructions,
      attempts: job.attempts,
      leaseExpiresAt: job.leaseExpiresAt,
    },
    // For refresh and correction jobs: the published profile to update.
    currentProfile: current ? { slug: current.slug, payload: current.payload } : null,
    // Set when an admin asked for changes to an earlier submission.
    reviewNotes: previous[0]?.reviewNotes ?? null,
    references: { parties: partyRows, provinces: provinceRows.map((p) => p.name) },
    // For roster_discovery jobs: what to find, and who is already covered.
    segment: segment ?? null,
    knownPeople: segment ? await knownPeople(db) : null,
  };
}

async function knownPeople(db: Database) {
  const [profiles, jobs] = await Promise.all([
    db
      .select({ fullName: politicians.fullName, knownAs: politicians.knownAs })
      .from(politicians)
      .orderBy(politicians.fullName),
    db
      .select({ name: researchJobs.requestedName })
      .from(researchJobs)
      .where(
        and(eq(researchJobs.kind, "new_profile"), inArray(researchJobs.status, [...openStatuses])),
      )
      .orderBy(researchJobs.requestedName),
  ]);
  return {
    profiles: profiles.map((p) => (p.knownAs ? `${p.fullName} (${p.knownAs})` : p.fullName)),
    queued: jobs.flatMap((j) => (j.name ? [j.name] : [])),
  };
}

export type ResearchBrief = Awaited<ReturnType<typeof buildBrief>>;

async function leasedJob(db: Database, tokenId: string, jobId: string, now: Date) {
  const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, jobId));
  if (!job) throw new QueueError("Job not found", 404);
  if (job.status !== "claimed" || job.claimedByTokenId !== tokenId) {
    throw new QueueError("This token does not hold the lease for this job");
  }
  if (!job.leaseExpiresAt || job.leaseExpiresAt <= now) {
    throw new QueueError("The lease expired; claim the job again");
  }
  return job;
}

export async function heartbeat(db: Database, tokenId: string, jobId: string, now = new Date()) {
  await leasedJob(db, tokenId, jobId, now);
  const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
  await db
    .update(researchJobs)
    .set({ leaseExpiresAt })
    .where(
      and(
        eq(researchJobs.id, jobId),
        eq(researchJobs.claimedByTokenId, tokenId),
        gt(researchJobs.leaseExpiresAt, now),
      ),
    );
  return { leaseExpiresAt };
}

export type SourceCheck = { id: string; url: string; ok: boolean; status: number | null };
export type SourceChecker = (sources: ResearchPayload["sources"]) => Promise<SourceCheck[]>;

export type ValidationReport = {
  references: ReferenceReport;
  possibleDuplicates: { id: string; slug: string; fullName: string }[];
  sources: SourceCheck[];
  gaps: string[];
};

async function buildReport(
  db: Database,
  job: typeof researchJobs.$inferSelect,
  payload: ResearchPayload,
  checkSources: SourceChecker,
): Promise<ValidationReport> {
  const index = await loadReferenceIndex(db);
  const names = [
    payload.politician.fullName,
    payload.politician.knownAs,
    ...payload.politician.aliases,
  ]
    .filter((n): n is string => !!n)
    .map((n) => n.trim());
  const possibleDuplicates =
    job.kind === "new_profile"
      ? await db
          .select({ id: politicians.id, slug: politicians.slug, fullName: politicians.fullName })
          .from(politicians)
          .where(
            or(
              ...names.map((n) => ilike(politicians.fullName, n)),
              ...names.map((n) => ilike(politicians.knownAs, n)),
            ),
          )
      : [];
  return {
    references: checkReferences(index, payload),
    possibleDuplicates,
    sources: await checkSources(payload.sources),
    gaps: payload.gaps,
  };
}

function hashPayload(payload: ResearchPayload | RosterPayload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export type RosterValidationReport = { sources: SourceCheck[]; gaps: string[] };

function parseSubmission(job: { kind: JobKind; rosterSegment: string | null }, payload: unknown) {
  if (job.kind !== "roster_discovery") {
    const parsed = researchPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new QueueError(
        "Payload does not match the research schema",
        422,
        formatIssues(parsed.error),
      );
    }
    return { kind: "profile" as const, payload: parsed.data };
  }
  const parsed = rosterPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new QueueError(
      "Payload does not match the roster schema",
      422,
      formatIssues(parsed.error),
    );
  }
  if (parsed.data.segment !== job.rosterSegment) {
    throw new QueueError(`This job discovers segment "${job.rosterSegment}"`, 422);
  }
  return { kind: "roster" as const, payload: parsed.data };
}

export async function submitResearch(
  db: Database,
  input: { tokenId: string; jobId: string; payload: unknown; checkSources: SourceChecker },
  now = new Date(),
) {
  const [target] = await db
    .select({ kind: researchJobs.kind, rosterSegment: researchJobs.rosterSegment })
    .from(researchJobs)
    .where(eq(researchJobs.id, input.jobId));
  if (!target) throw new QueueError("Job not found", 404);
  const parsed = parseSubmission(target, input.payload);
  const payload = parsed.payload;
  const payloadHash = hashPayload(payload);

  // Checked before the lease so a retried submit (e.g. after a dropped
  // response) gets the original result instead of a lease error.
  const [existing] = await db
    .select({ id: researchSubmissions.id, decidedAt: researchSubmissions.decidedAt })
    .from(researchSubmissions)
    .where(
      and(
        eq(researchSubmissions.jobId, input.jobId),
        eq(researchSubmissions.payloadHash, payloadHash),
      ),
    );
  if (existing && !existing.decidedAt) return { submissionId: existing.id, duplicate: true };
  if (existing) {
    throw new QueueError(
      "This exact payload was already reviewed; address the reviewer notes first",
    );
  }

  const job = await leasedJob(db, input.tokenId, input.jobId, now);

  const report: ValidationReport | RosterValidationReport =
    parsed.kind === "profile"
      ? await buildReport(db, job, parsed.payload, input.checkSources)
      : { sources: await input.checkSources(parsed.payload.sources), gaps: payload.gaps };

  return db.transaction(async (tx) => {
    const [submission] = await tx
      .insert(researchSubmissions)
      .values({
        jobId: job.id,
        payload,
        payloadHash,
        schemaVersion: payload.schemaVersion,
        validationReport: report,
      })
      .returning({ id: researchSubmissions.id });
    await tx
      .update(researchJobs)
      .set({ status: "submitted", leaseExpiresAt: null })
      .where(eq(researchJobs.id, job.id));
    return { submissionId: submission.id, duplicate: false };
  });
}

type Decision = "needs_changes" | "rejected";

// Admin outcomes other than publishing. "needs_changes" returns the job to the
// queue with the note, which the next claim receives in its brief.
export async function decideSubmission(
  db: Database,
  input: { submissionId: string; reviewerUserId: string; decision: Decision; note: string },
) {
  if (!input.note.trim()) throw new QueueError("A note is required", 400);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ submission: researchSubmissions, job: researchJobs })
      .from(researchSubmissions)
      .innerJoin(researchJobs, eq(researchSubmissions.jobId, researchJobs.id))
      .where(eq(researchSubmissions.id, input.submissionId))
      .for("update");
    if (!row) throw new QueueError("Submission not found", 404);
    if (row.job.status !== "submitted" || row.submission.decidedAt) {
      throw new QueueError(`Job is ${row.job.status}; it has no pending submission`);
    }
    const now = new Date();
    await tx
      .update(researchSubmissions)
      .set({ reviewerUserId: input.reviewerUserId, reviewNotes: input.note.trim(), decidedAt: now })
      .where(eq(researchSubmissions.id, input.submissionId));
    await tx
      .update(researchJobs)
      .set({ status: input.decision, claimedByTokenId: null })
      .where(eq(researchJobs.id, row.job.id));
    await tx.insert(auditLog).values({
      actorUserId: input.reviewerUserId,
      action: `research_submission.${input.decision}`,
      entity: "research_submission",
      entityId: input.submissionId,
      after: { note: input.note.trim() },
    });
  });
}

export async function updateJobStatus(
  db: Database,
  input: { jobId: string; actorUserId: string; action: "cancel" | "release" },
) {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.id, input.jobId))
      .for("update");
    if (!job) throw new QueueError("Job not found", 404);
    if (input.action === "release" && job.status !== "claimed") {
      throw new QueueError("Only claimed jobs can be released");
    }
    if (input.action === "cancel" && ["approved", "cancelled"].includes(job.status)) {
      throw new QueueError(`Job is already ${job.status}`);
    }
    const status = input.action === "release" ? "queued" : "cancelled";
    await tx
      .update(researchJobs)
      .set({ status, claimedByTokenId: null, leaseExpiresAt: null })
      .where(eq(researchJobs.id, job.id));
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: `research_job.${input.action}`,
      entity: "research_job",
      entityId: job.id,
      before: { status: job.status },
      after: { status },
    });
  });
}

// An admin correction during review. Submissions are kept as written, so the
// edit becomes a new submission on the same job and the old one is closed.
export async function reviseSubmission(
  db: Database,
  input: {
    submissionId: string;
    reviewerUserId: string;
    payload: unknown;
    checkSources: SourceChecker;
  },
) {
  const parsed = researchPayloadSchema.safeParse(input.payload);
  if (!parsed.success) {
    throw new QueueError(
      "Payload does not match the research schema",
      422,
      formatIssues(parsed.error),
    );
  }
  const payload = parsed.data;
  const payloadHash = hashPayload(payload);

  const [row] = await db
    .select({ submission: researchSubmissions, job: researchJobs })
    .from(researchSubmissions)
    .innerJoin(researchJobs, eq(researchSubmissions.jobId, researchJobs.id))
    .where(eq(researchSubmissions.id, input.submissionId));
  if (!row) throw new QueueError("Submission not found", 404);
  if (row.job.kind === "roster_discovery") {
    throw new QueueError("Rosters are reviewed by selecting people, not edited", 400);
  }
  if (row.job.status !== "submitted" || row.submission.decidedAt) {
    throw new QueueError("Only the pending submission can be edited");
  }
  if (row.submission.payloadHash === payloadHash) throw new QueueError("No changes to save", 400);

  // Reuse reachability results for URLs that were already checked.
  const previous = (row.submission.validationReport as ValidationReport | null)?.sources ?? [];
  const known = new Map(previous.map((c) => [c.url, c]));
  const checkSources: SourceChecker = async (sources) => {
    const fresh = await input.checkSources(sources.filter((s) => !known.has(s.url)));
    return sources.map((s) => {
      const prior = known.get(s.url);
      return prior ? { ...prior, id: s.id } : fresh.find((c) => c.id === s.id)!;
    });
  };
  const report = await buildReport(db, row.job, payload, checkSources);

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ decidedAt: researchSubmissions.decidedAt })
      .from(researchSubmissions)
      .where(eq(researchSubmissions.id, input.submissionId))
      .for("update");
    if (locked.decidedAt) throw new QueueError("The submission was decided meanwhile");
    const now = new Date();
    await tx
      .update(researchSubmissions)
      .set({
        reviewerUserId: input.reviewerUserId,
        reviewNotes: "Reemplazada por una edición del administrador",
        decidedAt: now,
      })
      .where(eq(researchSubmissions.id, input.submissionId));
    const [revised] = await tx
      .insert(researchSubmissions)
      .values({
        jobId: row.job.id,
        payload,
        payloadHash,
        schemaVersion: payload.schemaVersion,
        validationReport: report,
      })
      .returning({ id: researchSubmissions.id });
    await tx.insert(auditLog).values({
      actorUserId: input.reviewerUserId,
      action: "research_submission.revise",
      entity: "research_submission",
      entityId: revised.id,
      before: { submissionId: input.submissionId },
    });
    return { submissionId: revised.id };
  });
}

// Approves a discovered roster: queues a new_profile job for each selected
// person (skipping anyone already covered) and queues discovery for the next
// wave segment, so the waves advance with one approval each.
export async function approveRoster(
  db: Database,
  input: { submissionId: string; reviewerUserId: string; selected: number[]; note?: string | null },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ submission: researchSubmissions, job: researchJobs })
      .from(researchSubmissions)
      .innerJoin(researchJobs, eq(researchSubmissions.jobId, researchJobs.id))
      .where(eq(researchSubmissions.id, input.submissionId))
      .for("update");
    if (!row) throw new QueueError("Submission not found", 404);
    const { submission, job } = row;
    if (job.kind !== "roster_discovery" || !job.rosterSegment) {
      throw new QueueError("Only roster discoveries can be approved this way", 400);
    }
    if (job.status !== "submitted" || submission.decidedAt) {
      throw new QueueError(`Job is ${job.status}; it has no pending submission`);
    }
    const parsed = rosterPayloadSchema.safeParse(submission.payload);
    if (!parsed.success) throw new QueueError("Submission no longer matches the roster schema");
    const { people } = parsed.data;
    const selected = [...new Set(input.selected)].sort((a, b) => a - b);
    if (selected.some((i) => !Number.isInteger(i) || i < 0 || i >= people.length)) {
      throw new QueueError("Selection does not match the roster", 400);
    }

    const segment = waveSegment(job.rosterSegment);
    const title = segment?.title ?? job.rosterSegment;
    const result = await insertJobs(
      tx,
      {
        people: selected.map((i) => ({
          name: people[i].fullName,
          instructions: rosterInstructions(people[i], title),
        })),
        wave: job.wave,
        createdByUserId: input.reviewerUserId,
      },
      now,
    );

    const note = input.note?.trim() || null;
    await tx
      .update(researchSubmissions)
      .set({ reviewerUserId: input.reviewerUserId, reviewNotes: note, decidedAt: now })
      .where(eq(researchSubmissions.id, submission.id));
    await tx
      .update(researchJobs)
      .set({ status: "approved", leaseExpiresAt: null, claimedByTokenId: null })
      .where(eq(researchJobs.id, job.id));
    await tx.insert(auditLog).values({
      actorUserId: input.reviewerUserId,
      action: "research_roster.approve",
      entity: "research_submission",
      entityId: submission.id,
      after: {
        selected: selected.length,
        of: people.length,
        queued: result.created.length,
        skipped: result.skipped.length,
        note,
      },
    });

    const following = nextWaveSegment(job.rosterSegment);
    let next: typeof researchJobs.$inferSelect | null = null;
    if (following) {
      const [existing] = await tx
        .select({ id: researchJobs.id })
        .from(researchJobs)
        .where(
          and(
            eq(researchJobs.rosterSegment, following.key),
            inArray(researchJobs.status, [...openStatuses, "approved"]),
          ),
        )
        .limit(1);
      if (!existing) next = await insertDiscoveryJob(tx, following, input.reviewerUserId);
    }
    return { ...result, next };
  });
}

export const MAX_ATTEMPTS = 3;

// Gives back a job the holder could not finish (used by the research runner).
// After MAX_ATTEMPTS claims it is marked failed so a broken job cannot loop.
export async function releaseJob(db: Database, tokenId: string, jobId: string, now = new Date()) {
  const job = await leasedJob(db, tokenId, jobId, now);
  const status = job.attempts >= MAX_ATTEMPTS ? "failed" : "queued";
  await db.transaction(async (tx) => {
    await tx
      .update(researchJobs)
      .set({ status, claimedByTokenId: null, leaseExpiresAt: null })
      .where(eq(researchJobs.id, job.id));
    await tx.insert(auditLog).values({
      action: "research_job.release",
      entity: "research_job",
      entityId: job.id,
      before: { status: job.status, attempts: job.attempts },
      after: { status, tokenId },
    });
  });
  return { status };
}

export async function jobStatus(db: Database, tokenId: string, jobId: string) {
  const [job] = await db
    .select({
      status: researchJobs.status,
      claimedByTokenId: researchJobs.claimedByTokenId,
      attempts: researchJobs.attempts,
    })
    .from(researchJobs)
    .where(eq(researchJobs.id, jobId));
  if (!job) throw new QueueError("Job not found", 404);
  return {
    status: job.status,
    attempts: job.attempts,
    heldByYou: job.claimedByTokenId === tokenId,
  };
}
