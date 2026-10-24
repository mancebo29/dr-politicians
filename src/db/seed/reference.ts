import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { institutions, municipalities, parties, provinces } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { institutions as institutionData } from "./data/institutions";
import municipalityData from "./data/municipalities.json";
import { parties as partyData } from "./data/parties";
import provinceData from "./data/provinces.json";

// Upserts keyed by slug so re-running never duplicates rows and picks up
// corrections to the data files.
export async function seedReferenceData(db: Database) {
  await db.transaction(async (tx) => {
    const provinceRows = await tx
      .insert(provinces)
      .values(provinceData.map((p) => ({ slug: slugify(p.name), name: p.name, region: p.region })))
      .onConflictDoUpdate({
        target: provinces.slug,
        set: { name: sql`excluded.name`, region: sql`excluded.region` },
      })
      .returning({ id: provinces.id, name: provinces.name });
    const provinceIds = new Map(provinceRows.map((p) => [p.name, p.id]));

    const municipalityValues = municipalityData.map((m) => {
      const provinceId = provinceIds.get(m.province);
      if (!provinceId)
        throw new Error(`Unknown province "${m.province}" for municipality "${m.name}"`);
      return { slug: slugify(m.name), name: m.name, provinceId, createdOn: m.createdOn };
    });
    const slugs = new Set<string>();
    for (const m of municipalityValues) {
      if (slugs.has(m.slug)) throw new Error(`Duplicate municipality slug "${m.slug}"`);
      slugs.add(m.slug);
    }
    await tx
      .insert(municipalities)
      .values(municipalityValues)
      .onConflictDoUpdate({
        target: municipalities.slug,
        set: {
          name: sql`excluded.name`,
          provinceId: sql`excluded.province_id`,
          createdOn: sql`excluded.created_on`,
        },
      });

    await tx
      .insert(parties)
      .values(
        partyData.map((p) => ({ slug: slugify(p.acronym), name: p.name, acronym: p.acronym })),
      )
      .onConflictDoUpdate({
        target: parties.slug,
        set: { name: sql`excluded.name`, acronym: sql`excluded.acronym` },
      });

    await tx
      .insert(institutions)
      .values(institutionData)
      .onConflictDoUpdate({
        target: institutions.slug,
        set: { name: sql`excluded.name`, kind: sql`excluded.kind` },
      });
  });
}
