import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { politicians, popularitySnapshots } from "@/db/schema";
import { seedReferenceData } from "@/db/seed/reference";
import { createTestDb, truncateAll } from "@/test/db";
import { defaultFilters, type ListFilters } from "./filters";
import {
  getPublicProfile,
  listFilterOptions,
  listPublishedPoliticians,
  listSitemapData,
} from "./politicians";
import { publishSampleProfiles } from "./sample-profiles";

const db = createTestDb();

async function slugOf(fullName: string) {
  const [row] = await db
    .select({ slug: politicians.slug, id: politicians.id })
    .from(politicians)
    .where(eq(politicians.fullName, fullName));
  return row;
}

async function names(filters: Partial<ListFilters>) {
  const { items } = await listPublishedPoliticians(db, { ...defaultFilters, ...filters });
  return items.map((i) => i.name);
}

beforeAll(async () => {
  await truncateAll(db);
  await seedReferenceData(db);
  await publishSampleProfiles(db);
  await db.insert(politicians).values({
    slug: "borrador-oculto",
    fullName: "José Borrador Oculto",
    status: "draft",
  });

  const jose = await slugOf("José Ramón Peña Ejemplo");
  const maria = await slugOf("María Altagracia Núñez Prueba");
  const carlos = await slugOf("Carlos Manuel Ficticio Demo");
  await db.insert(popularitySnapshots).values([
    // An older week with a different order, which must be ignored.
    { weekStart: "2026-10-12", politicianId: jose.id, score: 9, rank: 1 },
    { weekStart: "2026-10-12", politicianId: carlos.id, score: 1, rank: 3 },
    { weekStart: "2026-10-19", politicianId: carlos.id, score: 9, rank: 1, rankDelta: 2 },
    { weekStart: "2026-10-19", politicianId: maria.id, score: 5, rank: 2 },
    { weekStart: "2026-10-19", politicianId: jose.id, score: 3, rank: 3, rankDelta: -2 },
  ]);
}, 60_000);

afterAll(async () => {
  await db.$client.end();
});

describe("listPublishedPoliticians", () => {
  it("orders by the latest weekly rank, then by name, and skips drafts and the deceased", async () => {
    const list = await listPublishedPoliticians(db, defaultFilters);
    expect(list.rankingWeek).toBe("2026-10-19");
    expect(list.items.map((i) => [i.name, i.rank])).toEqual([
      ["Carlos Ficticio", 1],
      ["María Núñez", 2],
      ["José Peña", 3],
      ["Ana Prueba", null],
      ["Luis Demo", null],
      ["Pedro Muestra", null],
    ]);
    expect(list.items[0].rankDelta).toBe(2);
    expect(list.total).toBe(6);
  });

  it("sorts by name A–Z ignoring accents", async () => {
    expect(await names({ sort: "name" })).toEqual([
      "Ana Prueba",
      "Carlos Ficticio",
      "José Peña",
      "Luis Demo",
      "María Núñez",
      "Pedro Muestra",
    ]);
  });

  it("searches names, known-as names and aliases without accents or case", async () => {
    expect(await names({ q: "jose" })).toEqual(["José Peña"]);
    expect(await names({ q: "JOSÉ pena" })).toEqual(["José Peña"]);
    expect(await names({ q: "ramon" })).toEqual(["José Peña"]);
    expect(await names({ q: "joselo" })).toEqual(["José Peña"]);
    expect(await names({ q: "nunez" })).toEqual(["María Núñez"]);
    expect(await names({ q: "100%_" })).toEqual([]);
  });

  it("finds deceased people by search only", async () => {
    expect(await names({ q: "difunto" })).toEqual(["Rafael Difunto"]);
    expect(await names({ party: "prd" })).toEqual([]);
  });

  it("filters by current party, role group and province, alone and combined", async () => {
    expect(await names({ party: "prm" })).toEqual(["José Peña", "Ana Prueba"]);
    expect(await names({ party: "fp", sort: "name" })).toEqual(["María Núñez", "Pedro Muestra"]);
    expect(await names({ role: "senado" })).toEqual(["José Peña"]);
    expect(await names({ role: "camara" })).toEqual(["María Núñez"]);
    expect(await names({ role: "ejecutivo" })).toEqual(["Carlos Ficticio"]);
    expect(await names({ role: "alcaldia" })).toEqual(["Luis Demo"]);
    expect(await names({ role: "parlacen" })).toEqual(["Pedro Muestra"]);
    expect(await names({ role: "partido" })).toEqual(["Ana Prueba"]);
    expect(await names({ role: "exfuncionario" })).toEqual(["Ana Prueba"]);
    expect(await names({ province: "santiago" })).toEqual(["José Peña", "Ana Prueba"]);
    // Luis Demo's position names only the municipality (Jarabacoa, La Vega).
    expect(await names({ province: "la-vega" })).toEqual(["María Núñez", "Luis Demo"]);
    expect(await names({ party: "prm", role: "senado" })).toEqual(["José Peña"]);
    expect(await names({ q: "ana", province: "santiago" })).toEqual(["Ana Prueba"]);
    expect(await names({ q: "jose", party: "fp" })).toEqual([]);
  });

  it("describes each row's current or most recent role", async () => {
    const { items } = await listPublishedPoliticians(db, defaultFilters);
    const bySlug = Object.fromEntries(items.map((i) => [i.name, i]));
    expect(bySlug["José Peña"].role).toEqual({
      title: "Senador",
      isCurrent: true,
      province: "Santiago",
    });
    expect(bySlug["José Peña"].party).toMatchObject({ slug: "prm", acronym: "PRM" });
    expect(bySlug["Ana Prueba"].role).toEqual({
      title: "Senadora",
      isCurrent: false,
      province: "Santiago",
    });
    expect(bySlug["Luis Demo"].role?.province).toBe("La Vega");
    expect(bySlug["Luis Demo"].summary).toBe("Perfil ficticio de ejemplo. Alcalde de Jarabacoa.");
  });

  it("previews only the start of a long summary", async () => {
    const { id } = await slugOf("Pedro Ejemplo Muestra");
    await db
      .update(politicians)
      .set({ summary: "a".repeat(1000) })
      .where(eq(politicians.id, id));
    const { items } = await listPublishedPoliticians(db, { ...defaultFilters, q: "pedro" });
    expect(items[0].summary).toHaveLength(300);
  });

  it("paginates and clamps out-of-range pages", async () => {
    const first = await listPublishedPoliticians(db, { ...defaultFilters, pageSize: 4 });
    expect(first).toMatchObject({ page: 1, pageCount: 2, total: 6 });
    expect(first.items).toHaveLength(4);
    const last = await listPublishedPoliticians(db, { ...defaultFilters, pageSize: 4, page: 9 });
    expect(last.page).toBe(2);
    expect(last.items.map((i) => i.name)).toEqual(["Luis Demo", "Pedro Muestra"]);
  });
});

describe("public profile reads", () => {
  it("returns published profiles with party, archive links and revisions", async () => {
    const { slug } = await slugOf("José Ramón Peña Ejemplo");
    const profile = await getPublicProfile(db, slug);
    expect(profile?.party).toMatchObject({ slug: "prm" });
    expect(profile?.archiveUrls["https://example.org/muestra/jose-pena/1"]).toMatch(
      /^https:\/\/web\.archive\.org\//,
    );
    expect(profile?.revisions[0].note).toBe("Datos de muestra ficticios");
  });

  it("hides drafts", async () => {
    expect(await getPublicProfile(db, "borrador-oculto")).toBeNull();
    expect(await getPublicProfile(db, "no-existe")).toBeNull();
  });

  it("offers filters and sitemap entries only for published profiles", async () => {
    const options = await listFilterOptions(db);
    expect(options.parties.map((p) => p.slug)).toEqual(["fp", "pld", "prd", "prm", "prsc"]);
    expect(options.provinces.map((p) => p.slug)).toEqual(["duarte", "la-vega", "santiago"]);
    const sitemap = await listSitemapData(db);
    expect(sitemap.politicians).toHaveLength(7);
    expect(sitemap.politicians.map((p) => p.slug)).not.toContain("borrador-oculto");
  });
});
