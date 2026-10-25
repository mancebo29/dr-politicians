import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  claimSources,
  parties,
  politicians,
  positions,
  profileRevisions,
  researchJobs,
  users,
} from "@/db/schema";
import { seedReferenceData } from "@/db/seed/reference";
import { loadProfile } from "@/lib/profiles/load";
import { createTestDb, truncateAll } from "@/test/db";
import { samplePayload } from "./fixtures";
import { publishSections, publishSubmission, PublishError } from "./publish";
import {
  claimNextJob,
  createJob,
  createJobs,
  decideSubmission,
  heartbeat,
  LEASE_MS,
  QueueError,
  reviseSubmission,
  submitResearch,
  type SourceChecker,
} from "./queue";
import { createResearchToken, revokeResearchToken, verifyResearchToken } from "./tokens";

const db = createTestDb();
const allOk: SourceChecker = async (sources) =>
  sources.map((s) => ({ id: s.id, url: s.url, ok: true, status: 200 }));

let reviewerId: string;
let tokenId: string;

afterAll(async () => {
  await db.$client.end();
});

beforeEach(async () => {
  await truncateAll(db);
  await seedReferenceData(db);
  [{ id: reviewerId }] = await db
    .insert(users)
    .values({ name: "Admin", email: "admin@example.org", role: "admin" })
    .returning({ id: users.id });
  ({ id: tokenId } = await createResearchToken(db, { name: "test", createdByUserId: reviewerId }));
});

async function submitNew(payload: unknown = samplePayload()) {
  const job = await createJob(db, { kind: "new_profile", requestedName: "Persona de Prueba" });
  const brief = await claimNextJob(db, tokenId);
  expect(brief?.job.id).toBe(job.id);
  const result = await submitResearch(db, { tokenId, jobId: job.id, payload, checkSources: allOk });
  return { job, ...result };
}

describe("research tokens", () => {
  it("verifies valid tokens and rejects revoked or malformed ones", async () => {
    const { id, token } = await createResearchToken(db, { name: "cli" });
    expect(await verifyResearchToken(db, token)).toMatchObject({ id });
    expect(await verifyResearchToken(db, "rt_wrong")).toBeNull();
    expect(await verifyResearchToken(db, "not-a-token")).toBeNull();
    await revokeResearchToken(db, id);
    expect(await verifyResearchToken(db, token)).toBeNull();
  });
});

describe("queue", () => {
  it("claims by priority, then age, and returns nothing when empty", async () => {
    const low = await createJob(db, { kind: "new_profile", requestedName: "Bajo", priority: 0 });
    const high = await createJob(db, { kind: "new_profile", requestedName: "Alto", priority: 5 });
    expect((await claimNextJob(db, tokenId))?.job.id).toBe(high.id);
    expect((await claimNextJob(db, tokenId))?.job.id).toBe(low.id);
    expect(await claimNextJob(db, tokenId)).toBeNull();
  });

  it("queues a wave in list order and skips repeats, open jobs and existing profiles", async () => {
    await createJob(db, { kind: "new_profile", requestedName: "Persona Abierta" });
    await db.insert(politicians).values({ slug: "jose-perez", fullName: "José Pérez" });

    const { created, skipped } = await createJobs(db, {
      people: [
        { name: "Primera Persona", instructions: "senadora de Santiago" },
        { name: "Segunda Persona" },
        { name: "primera persona" },
        { name: "Persona abierta" },
        { name: "Jose Perez" },
      ],
      wave: 1,
      createdByUserId: reviewerId,
    });

    expect(created.map((j) => [j.requestedName, j.wave, j.instructions])).toEqual([
      ["Primera Persona", 1, "senadora de Santiago"],
      ["Segunda Persona", 1, null],
    ]);
    expect(skipped.map((s) => s.name)).toEqual([
      "primera persona",
      "Persona abierta",
      "Jose Perez",
    ]);
    // The earlier single job is claimed first, then the wave in list order.
    await claimNextJob(db, tokenId);
    expect((await claimNextJob(db, tokenId))?.job.requestedName).toBe("Primera Persona");
    expect((await claimNextJob(db, tokenId))?.job.requestedName).toBe("Segunda Persona");

    const again = await createJobs(db, { people: [{ name: "Segunda Persona" }] });
    expect(again.created).toHaveLength(0);
  });

  it("returns jobs with expired leases to the queue", async () => {
    const job = await createJob(db, { kind: "new_profile", requestedName: "Alguien" });
    const t0 = new Date("2026-10-24T10:00:00Z");
    await claimNextJob(db, tokenId, t0);
    expect(await claimNextJob(db, tokenId, new Date(t0.getTime() + LEASE_MS - 1000))).toBeNull();

    const reclaimed = await claimNextJob(db, tokenId, new Date(t0.getTime() + LEASE_MS + 1000));
    expect(reclaimed?.job).toMatchObject({ id: job.id, attempts: 2 });
  });

  it("rejects submissions from another token or after the lease expired", async () => {
    const job = await createJob(db, { kind: "new_profile", requestedName: "Alguien" });
    const t0 = new Date("2026-10-24T10:00:00Z");
    await claimNextJob(db, tokenId, t0);
    const other = await createResearchToken(db, { name: "other" });

    const submit = (token: string, at: Date) =>
      submitResearch(
        db,
        { tokenId: token, jobId: job.id, payload: samplePayload(), checkSources: allOk },
        at,
      );
    await expect(submit(other.id, t0)).rejects.toThrow(/does not hold the lease/);
    await expect(submit(tokenId, new Date(t0.getTime() + LEASE_MS + 1))).rejects.toThrow(/expired/);
  });

  it("extends a lease on heartbeat", async () => {
    const job = await createJob(db, { kind: "new_profile", requestedName: "Alguien" });
    const t0 = new Date("2026-10-24T10:00:00Z");
    await claimNextJob(db, tokenId, t0);
    const later = new Date(t0.getTime() + LEASE_MS - 60_000);
    const { leaseExpiresAt } = await heartbeat(db, tokenId, job.id, later);
    expect(leaseExpiresAt.getTime()).toBe(later.getTime() + LEASE_MS);
  });

  it("rejects invalid payloads without consuming the lease, and dedupes resubmits", async () => {
    const job = await createJob(db, { kind: "new_profile", requestedName: "Alguien" });
    await claimNextJob(db, tokenId);
    const invalid = samplePayload();
    invalid.positions![0].sourceIds = [];
    const error = await submitResearch(db, {
      tokenId,
      jobId: job.id,
      payload: invalid,
      checkSources: allOk,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QueueError);
    expect((error as QueueError).status).toBe(422);
    expect((error as QueueError).issues).toContain(
      "positions.0.sourceIds: Every claim needs at least one source",
    );

    const first = await submitResearch(db, {
      tokenId,
      jobId: job.id,
      payload: samplePayload(),
      checkSources: allOk,
    });
    expect(first.duplicate).toBe(false);
    const [stored] = await db.select().from(researchJobs).where(eq(researchJobs.id, job.id));
    expect(stored.status).toBe("submitted");

    const retry = await submitResearch(db, {
      tokenId,
      jobId: job.id,
      payload: samplePayload(),
      checkSources: allOk,
    });
    expect(retry).toEqual({ submissionId: first.submissionId, duplicate: true });
  });

  it("sends review notes back with the next claim when changes are requested", async () => {
    const { submissionId } = await submitNew();
    await decideSubmission(db, {
      submissionId,
      reviewerUserId: reviewerId,
      decision: "needs_changes",
      note: "Falta la fuente de 2016",
    });
    const brief = await claimNextJob(db, tokenId);
    expect(brief?.reviewNotes).toBe("Falta la fuente de 2016");

    await expect(
      submitResearch(db, {
        tokenId,
        jobId: brief!.job.id,
        payload: samplePayload(),
        checkSources: allOk,
      }),
    ).rejects.toThrow(/already reviewed/);
  });

  it("records admin edits as a new submission and closes the old one", async () => {
    const { submissionId } = await submitNew();
    const edited = samplePayload();
    edited.politician!.summary = "Resumen corregido por el administrador.";
    let checked = 0;
    const { submissionId: revisedId } = await reviseSubmission(db, {
      submissionId,
      reviewerUserId: reviewerId,
      payload: edited,
      checkSources: async (sources) => {
        checked += sources.length;
        return allOk(sources);
      },
    });
    expect(revisedId).not.toBe(submissionId);
    expect(checked).toBe(0);
    await expect(
      reviseSubmission(db, {
        submissionId,
        reviewerUserId: reviewerId,
        payload: edited,
        checkSources: allOk,
      }),
    ).rejects.toThrow(/Only the pending submission/);

    const { politicianId } = await publishSubmission(db, {
      submissionId: revisedId,
      reviewerUserId: reviewerId,
      sections: publishSections,
      note: "Publicado con corrección",
    });
    const profile = await loadProfile(db, { id: politicianId });
    expect(profile?.payload.politician.summary).toBe("Resumen corregido por el administrador.");
  });
});

describe("publishSubmission", () => {
  it("publishes a new profile with sources, references, revision and current party", async () => {
    const { submissionId } = await submitNew();
    const result = await publishSubmission(db, {
      submissionId,
      reviewerUserId: reviewerId,
      sections: publishSections,
      note: "Perfil inicial",
    });
    expect(result).toMatchObject({ slug: "persona-prueba", created: true });

    const profile = await loadProfile(db, { id: result.politicianId });
    expect(profile?.status).toBe("published");
    expect(profile?.payload.positions.map((p) => p.title)).toEqual([
      "Senador",
      "Ministro de Prueba",
    ]);
    expect(profile?.payload.positions[0].province).toBe("Santiago");
    expect(profile?.payload.positions[1].start).toBe("2024-08");
    expect(profile?.payload.controversies[0].sourceIds).toHaveLength(2);
    expect(profile?.payload.workRecord).toEqual([
      expect.objectContaining({
        title: "Programa de prueba",
        status: "completed",
        office: "Ministro de Prueba",
        start: "2024-09",
        end: "2025",
        sourceIds: [expect.stringMatching(/^s\d+$/)],
      }),
    ]);

    const [p] = await db.select().from(politicians).where(eq(politicians.id, result.politicianId));
    const [prm] = await db.select().from(parties).where(eq(parties.acronym, "PRM"));
    expect(p.currentPartyId).toBe(prm.id);
    expect(await db.$count(profileRevisions)).toBe(1);
    const unsourced = await db.execute(sql`select * from unsourced_claims`);
    expect(unsourced).toHaveLength(0);
  });

  it("replaces only the accepted sections on a refresh", async () => {
    const first = await submitNew();
    const { politicianId } = await publishSubmission(db, {
      submissionId: first.submissionId,
      reviewerUserId: reviewerId,
      sections: publishSections,
      note: "Perfil inicial",
    });

    const refresh = await createJob(db, { kind: "refresh", politicianId });
    await claimNextJob(db, tokenId);
    const updated = samplePayload();
    updated.positions = [updated.positions![1]];
    updated.statements = [];
    const { submissionId } = await submitResearch(db, {
      tokenId,
      jobId: refresh.id,
      payload: updated,
      checkSources: allOk,
    });
    await publishSubmission(db, {
      submissionId,
      reviewerUserId: reviewerId,
      sections: ["positions"],
      note: "Actualiza cargos",
    });

    const profile = (await loadProfile(db, { id: politicianId }))!;
    expect(profile.payload.positions.map((p) => p.title)).toEqual(["Ministro de Prueba"]);
    expect(profile.payload.statements).toHaveLength(2);
    expect(await db.$count(positions)).toBe(1);
    // Replaced claims take their source links with them.
    const orphanLinks = await db.execute(
      sql`select 1 from claim_sources cs where cs.claim_type = 'position'
          and not exists (select 1 from positions p where p.id = cs.claim_id)`,
    );
    expect(orphanLinks).toHaveLength(0);
    expect(await db.$count(profileRevisions)).toBe(2);
  });

  it("removes a replaced work record together with its source links", async () => {
    const first = await submitNew();
    const { politicianId } = await publishSubmission(db, {
      submissionId: first.submissionId,
      reviewerUserId: reviewerId,
      sections: publishSections,
      note: "Perfil inicial",
    });

    const refresh = await createJob(db, { kind: "refresh", politicianId });
    await claimNextJob(db, tokenId);
    const { submissionId } = await submitResearch(db, {
      tokenId,
      jobId: refresh.id,
      payload: samplePayload({ workRecord: [] }),
      checkSources: allOk,
    });
    await publishSubmission(db, {
      submissionId,
      reviewerUserId: reviewerId,
      sections: ["workRecord"],
      note: "Retira la gestión",
    });

    expect((await loadProfile(db, { id: politicianId }))!.payload.workRecord).toEqual([]);
    const links = await db.execute(
      sql`select 1 from claim_sources where claim_type = 'work_record_item'`,
    );
    expect(links).toHaveLength(0);
  });

  it("refuses unknown provinces and leaves nothing behind", async () => {
    const payload = samplePayload();
    payload.positions![0].province = "Atlántida";
    const { submissionId } = await submitNew(payload);
    await expect(
      publishSubmission(db, {
        submissionId,
        reviewerUserId: reviewerId,
        sections: publishSections,
        note: "x",
      }),
    ).rejects.toThrow(PublishError);
    expect(await db.$count(politicians)).toBe(0);
    expect(await db.$count(claimSources)).toBe(0);
  });

  it("publishes without a note and records a default revision note", async () => {
    const { submissionId } = await submitNew();
    const { politicianId } = await publishSubmission(db, {
      submissionId,
      reviewerUserId: reviewerId,
      sections: publishSections,
      note: "  ",
    });
    const [revision] = await db
      .select()
      .from(profileRevisions)
      .where(eq(profileRevisions.politicianId, politicianId));
    expect(revision.note).toBe("Aprobado sin nota");
  });

  it("cannot publish the same submission twice", async () => {
    const { submissionId } = await submitNew();
    const input = {
      submissionId,
      reviewerUserId: reviewerId,
      sections: publishSections,
      note: "ok",
    };
    await publishSubmission(db, input);
    await expect(publishSubmission(db, input)).rejects.toThrow(/only submitted jobs/);
  });
});
