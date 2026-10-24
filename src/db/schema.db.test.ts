import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  claimSources,
  comments,
  politicians,
  positions,
  researchJobs,
  sources,
  users,
} from "@/db/schema";
import { createTestDb, truncateAll } from "@/test/db";

const db = createTestDb();

afterAll(async () => {
  await db.$client.end();
});

beforeEach(async () => {
  await truncateAll(db);
});

async function expectViolation(promise: Promise<unknown>, constraint: string) {
  // Drizzle wraps driver errors; the Postgres error with the constraint name is the cause.
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected ${constraint} to be violated`).not.toBeNull();
  const cause = (error as { cause?: { constraint_name?: string } }).cause;
  expect(cause?.constraint_name).toBe(constraint);
}

async function insertPolitician(overrides: Partial<typeof politicians.$inferInsert> = {}) {
  const [row] = await db
    .insert(politicians)
    .values({ slug: `p-${crypto.randomUUID()}`, fullName: "Persona de Prueba", ...overrides })
    .returning();
  return row;
}

async function insertSource() {
  const [row] = await db
    .insert(sources)
    .values({
      url: `https://example.org/${crypto.randomUUID()}`,
      title: "Fuente",
      publisher: "Editor",
      accessedOn: "2026-10-24",
      tier: "major_press",
    })
    .returning();
  return row;
}

async function unsourcedClaimsFor(politicianId: string) {
  return db.execute<{ claim_type: string; claim_id: string }>(
    sql`select claim_type, claim_id from unsourced_claims where politician_id = ${politicianId}`,
  );
}

describe("partial dates and periods", () => {
  it("rejects a date without its precision", async () => {
    await expectViolation(
      insertPolitician({ birthDate: "1968-01-01" }),
      "politicians_birth_precision",
    );
  });

  it("rejects a position that ends before it starts", async () => {
    const p = await insertPolitician();
    await expectViolation(
      db.insert(positions).values({
        politicianId: p.id,
        title: "Senador",
        startDate: "2024-08-16",
        startDatePrecision: "day",
        endDate: "2020-08-16",
        endDatePrecision: "day",
      }),
      "positions_period_order",
    );
  });

  it("rejects a current position with an end date", async () => {
    const p = await insertPolitician();
    await expectViolation(
      db.insert(positions).values({
        politicianId: p.id,
        title: "Diputado",
        isCurrent: true,
        endDate: "2028-01-01",
        endDatePrecision: "year",
      }),
      "positions_current_open",
    );
  });
});

describe("profile status", () => {
  it("requires published_at for published profiles", async () => {
    await expectViolation(insertPolitician({ status: "published" }), "politicians_published_at");
  });
});

describe("claim sources", () => {
  it("lists claims without a source in unsourced_claims until one is linked", async () => {
    const p = await insertPolitician({ summary: "Resumen" });
    const [position] = await db
      .insert(positions)
      .values({ politicianId: p.id, title: "Senador" })
      .returning();

    const before = await unsourcedClaimsFor(p.id);
    expect(before.map((r) => r.claim_type).sort()).toEqual(["politician_summary", "position"]);

    const source = await insertSource();
    await db.insert(claimSources).values([
      { claimType: "politician_summary", claimId: p.id, sourceId: source.id },
      { claimType: "position", claimId: position.id, sourceId: source.id },
    ]);

    expect(await unsourcedClaimsFor(p.id)).toHaveLength(0);
  });

  it("removes a claim's source links when the claim is deleted, including by cascade", async () => {
    const p = await insertPolitician({ summary: "Resumen" });
    const [position] = await db
      .insert(positions)
      .values({ politicianId: p.id, title: "Senador" })
      .returning();
    const source = await insertSource();
    await db.insert(claimSources).values([
      { claimType: "politician_summary", claimId: p.id, sourceId: source.id },
      { claimType: "position", claimId: position.id, sourceId: source.id },
    ]);

    await db.delete(positions).where(eq(positions.id, position.id));
    expect(await db.select().from(claimSources)).toHaveLength(1);

    await db.delete(politicians).where(eq(politicians.id, p.id));
    expect(await db.select().from(claimSources)).toHaveLength(0);
  });

  it("does not delete a source that still backs a claim", async () => {
    const p = await insertPolitician({ summary: "Resumen" });
    const source = await insertSource();
    await db
      .insert(claimSources)
      .values({ claimType: "politician_summary", claimId: p.id, sourceId: source.id });

    await expectViolation(
      db.delete(sources).where(eq(sources.id, source.id)),
      "claim_sources_source_id_sources_id_fk",
    );
  });

  it("rejects excerpts longer than 300 characters", async () => {
    const p = await insertPolitician();
    const source = await insertSource();
    await expectViolation(
      db.insert(claimSources).values({
        claimType: "politician_summary",
        claimId: p.id,
        sourceId: source.id,
        quoteExcerpt: "x".repeat(301),
      }),
      "claim_sources_excerpt_length",
    );
  });
});

describe("comments", () => {
  it("requires replies to have a depth and roots to have none", async () => {
    const p = await insertPolitician();
    const [user] = await db.insert(users).values({ name: "U", email: "u@example.org" }).returning();
    const [root] = await db
      .insert(comments)
      .values({ politicianId: p.id, userId: user.id, body: "Hola" })
      .returning();

    await expectViolation(
      db
        .insert(comments)
        .values({ politicianId: p.id, userId: user.id, parentId: root.id, body: "Respuesta" }),
      "comments_root_depth",
    );
    await expectViolation(
      db.insert(comments).values({
        politicianId: p.id,
        userId: user.id,
        parentId: root.id,
        depth: 3,
        body: "Muy hondo",
      }),
      "comments_depth",
    );
  });
});

describe("research jobs", () => {
  it("requires an existing politician for refresh jobs", async () => {
    await expectViolation(
      db.insert(researchJobs).values({ kind: "refresh", requestedName: "Alguien" }),
      "research_jobs_new_profile_target",
    );
  });

  it("requires a lease for claimed jobs", async () => {
    await expectViolation(
      db
        .insert(researchJobs)
        .values({ kind: "new_profile", requestedName: "Alguien", status: "claimed" }),
      "research_jobs_lease",
    );
  });
});

describe("search", () => {
  it("matches names regardless of accents and case", async () => {
    await insertPolitician({ fullName: "José Ramón Peña", aliases: ["Moncho"] });
    const rows = await db.execute<{ full_name: string }>(
      sql`select full_name from politicians
          where politician_search_text(full_name, known_as, aliases) like '%' || lower(immutable_unaccent(${"JOSE RAMON PENA"})) || '%'`,
    );
    expect(rows.map((r) => r.full_name)).toEqual(["José Ramón Peña"]);

    const byAlias = await db.execute(
      sql`select 1 from politicians where politician_search_text(full_name, known_as, aliases) like '%moncho%'`,
    );
    expect(byAlias).toHaveLength(1);
  });
});
