import { createHash } from "node:crypto";
import { and, desc, eq, gt, ilike, inArray, lt, or, sql, type SQLWrapper } from "drizzle-orm";
import type { Database, Transaction } from "@/db/client";
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
import {
  formatIssues,
  RESEARCH_SCHEMA_VERSION,
  type ResearchPayload,
  researchPayloadSchema,
} from "./schema";

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

const normalizedName = (value: SQLWrapper | string) =>
  sql`lower(public.immutable_unaccent(${value}))`;

// Queues new-profile jobs for a wave, one per person, in list order. Names that
// repeat in the list, already have an open job, or match a profile's name are
// skipped and reported, so pasting the same list twice queues nothing new.
export async function createJobs(
  db: Database,
  input: {
    people: { name: string; instructions?: string | null }[];
    priority?: number;
    wave?: number | null;
    createdByUserId?: string | null;
  },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const created: (typeof researchJobs.$inferSelect)[] = [];
    const skipped: { name: string; reason: string }[] = [];
    const seen = new Set<string>();

    for (const person of input.people) {
      const name = person.name.trim();
      const [{ key }] = await tx.execute<{ key: string }>(
        sql`select ${normalizedName(name)} as key`,
      );
      if (seen.has(key)) {
        skipped.push({ name, reason: "repetido en la lista" });
        continue;
      }
      seen.add(key);

      const [openJob] = await tx
        .select({ id: researchJobs.id })
        .from(researchJobs)
        .where(
          and(
            sql`${normalizedName(researchJobs.requestedName)} = ${key}`,
            inArray(researchJobs.status, [
              "queued",
              "claimed",
              "submitted",
              "in_review",
              "needs_changes",
            ]),
          ),
        )
        .limit(1);
      if (openJob) {
        skipped.push({ name, reason: "ya tiene una investigación abierta" });
        continue;
      }
      const [profile] = await tx
        .select({ id: politicians.id })
        .from(politicians)
        .where(
          or(
            sql`${normalizedName(politicians.fullName)} = ${key}`,
            sql`${normalizedName(politicians.knownAs)} = ${key}`,
          ),
        )
        .limit(1);
      if (profile) {
        skipped.push({ name, reason: "ya existe un perfil con ese nombre" });
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

function hashPayload(payload: ResearchPayload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function submitResearch(
  db: Database,
  input: { tokenId: string; jobId: string; payload: unknown; checkSources: SourceChecker },
  now = new Date(),
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

  const report = await buildReport(db, job, payload, input.checkSources);

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
