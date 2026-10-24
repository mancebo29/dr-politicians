import { claimSections, type ClaimSection, type ResearchPayload } from "./schema";

export type SectionDiff<T> = { added: T[]; removed: T[]; unchanged: number };

export type PayloadDiff = {
  politician: { field: string; before: unknown; after: unknown }[];
  photo: { before: string | null; after: string | null };
} & { [K in ClaimSection]: SectionDiff<ResearchPayload[K][number]> };

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

// Claims are compared by content without their source references: source ids
// are local to each payload, so the same claim cites "s3" in one and "s7" in another.
function claimKey(claim: { sourceIds: string[] }) {
  return stable({ ...claim, sourceIds: undefined });
}

function diffSection<T extends { sourceIds: string[] }>(before: T[], after: T[]): SectionDiff<T> {
  const beforeKeys = new Set(before.map(claimKey));
  const afterKeys = new Set(after.map(claimKey));
  return {
    added: after.filter((c) => !beforeKeys.has(claimKey(c))),
    removed: before.filter((c) => !afterKeys.has(claimKey(c))),
    unchanged: after.filter((c) => beforeKeys.has(claimKey(c))).length,
  };
}

const politicianFields = [
  "fullName",
  "knownAs",
  "aliases",
  "birthDate",
  "birthPlace",
  "deathDate",
  "summary",
] as const;

export function diffPayloads(before: ResearchPayload | null, after: ResearchPayload): PayloadDiff {
  const politician = politicianFields
    .map((field) => ({
      field,
      before: before?.politician[field] ?? null,
      after: after.politician[field] ?? null,
    }))
    .filter((change) => stable(change.before) !== stable(change.after));

  const diff = {
    politician,
    photo: { before: before?.photo?.url ?? null, after: after.photo?.url ?? null },
  } as PayloadDiff;
  for (const section of claimSections) {
    (diff as Record<ClaimSection, unknown>)[section] = diffSection<{ sourceIds: string[] }>(
      before?.[section] ?? [],
      after[section],
    );
  }
  return diff;
}

export function diffSummary(diff: PayloadDiff) {
  return {
    politicianFieldsChanged: diff.politician.map((c) => c.field),
    photoChanged: diff.photo.before !== diff.photo.after,
    ...Object.fromEntries(
      claimSections.map((s) => [
        s,
        { added: diff[s].added.length, removed: diff[s].removed.length },
      ]),
    ),
  };
}
