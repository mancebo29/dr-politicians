import type { Executor } from "@/db/client";
import { institutions, municipalities, parties, provinces } from "@/db/schema";
import { slugify } from "@/lib/slug";
import type { ResearchPayload } from "./schema";

export type ReferenceIndex = Awaited<ReturnType<typeof loadReferenceIndex>>;

// Provinces and municipalities are a fixed, seeded set and must resolve.
// Parties and institutions may be new to the site; publishing creates them,
// and the review screen lists them so the admin sees it before approving.
export async function loadReferenceIndex(db: Executor) {
  const [provinceRows, municipalityRows, partyRows, institutionRows] = await Promise.all([
    db.select({ id: provinces.id, name: provinces.name }).from(provinces),
    db
      .select({
        id: municipalities.id,
        name: municipalities.name,
        provinceId: municipalities.provinceId,
      })
      .from(municipalities),
    db.select({ id: parties.id, acronym: parties.acronym, name: parties.name }).from(parties),
    db
      .select({ id: institutions.id, slug: institutions.slug, name: institutions.name })
      .from(institutions),
  ]);
  return {
    provinces: new Map(provinceRows.map((p) => [slugify(p.name), p])),
    municipalities: new Map(municipalityRows.map((m) => [slugify(m.name), m])),
    parties: new Map(partyRows.map((p) => [p.acronym.toUpperCase(), p])),
    institutions: new Map(
      institutionRows.flatMap((i) => [
        [i.slug, i],
        [slugify(i.name), i],
      ]),
    ),
  };
}

export function provinceKey(name: string) {
  return slugify(name.replace(/^provincia( de)?\s+/i, ""));
}

export type ReferenceReport = {
  errors: string[];
  newParties: { acronym: string; name: string }[];
  newInstitutions: string[];
};

export function checkReferences(index: ReferenceIndex, payload: ResearchPayload): ReferenceReport {
  const errors: string[] = [];
  const newParties = new Map<string, { acronym: string; name: string }>();
  const newInstitutions = new Set<string>();

  payload.positions.forEach((position, i) => {
    const province = position.province ? index.provinces.get(provinceKey(position.province)) : null;
    if (position.province && !province) {
      errors.push(`positions.${i}.province: unknown province "${position.province}"`);
    }
    if (position.municipality) {
      const municipality = index.municipalities.get(slugify(position.municipality));
      if (!municipality) {
        errors.push(`positions.${i}.municipality: unknown municipality "${position.municipality}"`);
      } else if (province && municipality.provinceId !== province.id) {
        errors.push(
          `positions.${i}.municipality: "${position.municipality}" is not in "${position.province}"`,
        );
      }
    }
    if (!index.institutions.has(slugify(position.institution))) {
      newInstitutions.add(position.institution);
    }
  });

  for (const membership of payload.partyMemberships) {
    const acronym = membership.party.acronym.toUpperCase();
    if (!index.parties.has(acronym)) newParties.set(acronym, { ...membership.party, acronym });
  }

  return { errors, newParties: [...newParties.values()], newInstitutions: [...newInstitutions] };
}
