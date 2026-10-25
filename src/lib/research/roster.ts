// The roster-discovery submission contract: who belongs in a wave segment,
// each person tied to a source. Approving it queues one new_profile job per
// selected person (PLAN §6.5).
import { z } from "zod";
import { sourceSchema } from "./schema";

export const ROSTER_SCHEMA_VERSION = 1;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullish();

export const rosterPersonSchema = z.object({
  fullName: text(200),
  knownAs: optionalText(200),
  // The office that puts the person in this segment, e.g. "Senador por Santiago (2024–2028)".
  office: text(300),
  province: optionalText(100),
  partyAcronym: optionalText(20),
  // Anything that helps the profile session find the right person.
  notes: optionalText(500),
  sourceIds: z.array(z.string().min(1)).min(1, "Every person needs at least one source"),
});

export const rosterPayloadSchema = z
  .object({
    schemaVersion: z.literal(ROSTER_SCHEMA_VERSION),
    segment: text(100),
    people: z.array(rosterPersonSchema),
    sources: z.array(sourceSchema).min(1),
    gaps: z.array(text(1000)).default([]),
    confidenceNotes: optionalText(4000),
  })
  .superRefine((payload, ctx) => {
    const ids = new Set<string>();
    payload.sources.forEach((source, i) => {
      if (ids.has(source.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["sources", i, "id"],
          message: "Duplicate source id",
        });
      }
      ids.add(source.id);
    });
    const names = new Set<string>();
    payload.people.forEach((person, i) => {
      person.sourceIds.forEach((id, j) => {
        if (!ids.has(id)) {
          ctx.addIssue({
            code: "custom",
            path: ["people", i, "sourceIds", j],
            message: `Unknown source id "${id}"`,
          });
        }
      });
      const key = person.fullName.toLowerCase();
      if (names.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["people", i, "fullName"],
          message: "Person listed twice",
        });
      }
      names.add(key);
    });
  });

export type RosterPayload = z.infer<typeof rosterPayloadSchema>;
export type RosterPayloadInput = z.input<typeof rosterPayloadSchema>;
export type RosterPerson = RosterPayload["people"][number];

// Passed to the new_profile job so the profile session starts from what discovery found.
export function rosterInstructions(person: RosterPerson, segmentTitle: string) {
  const where = [person.province, person.partyAcronym].filter(Boolean).join(", ");
  return [
    `${person.office}${where ? ` (${where})` : ""}.`,
    person.knownAs && `Conocido como ${person.knownAs}.`,
    person.notes,
    `Encontrado en el descubrimiento «${segmentTitle}».`,
  ]
    .filter(Boolean)
    .join(" ");
}
