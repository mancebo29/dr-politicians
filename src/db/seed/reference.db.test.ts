import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { institutions, municipalities, parties, provinces } from "@/db/schema";
import { createTestDb, truncateAll } from "@/test/db";
import { seedReferenceData } from "./reference";

const db = createTestDb();

beforeAll(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await db.$client.end();
});

async function counts() {
  return {
    provinces: await db.$count(provinces),
    municipalities: await db.$count(municipalities),
    parties: await db.$count(parties),
    institutions: await db.$count(institutions),
  };
}

describe("seedReferenceData", () => {
  it("seeds every province and municipality and is safe to re-run", async () => {
    await seedReferenceData(db);
    const first = await counts();
    expect(first).toEqual({ provinces: 32, municipalities: 160, parties: 5, institutions: 8 });

    await seedReferenceData(db);
    expect(await counts()).toEqual(first);
  });

  it("links municipalities to their province", async () => {
    const [row] = await db
      .select({ province: provinces.name })
      .from(municipalities)
      .innerJoin(provinces, eq(municipalities.provinceId, provinces.id))
      .where(eq(municipalities.slug, "santo-domingo-este"));
    expect(row.province).toBe("Santo Domingo");
  });
});
