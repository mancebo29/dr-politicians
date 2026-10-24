// The research submission contract (PLAN §6.2). This file is its single
// authority: the CLI validates against it locally, the API validates against it
// on submit, and publishing maps it onto the database.
import { z } from "zod";
import {
  allianceKind,
  institutionKind,
  legalStatus,
  legislationInvolvement,
  legislationKind,
  legislationStatus,
  membershipRole,
  positionOrigin,
  sourceTier,
  statementKind,
} from "@/db/schema";
import { partialDateSchema, toDbDate } from "@/lib/partial-date";

export const RESEARCH_SCHEMA_VERSION = 1;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().min(1).max(max).nullish();
const date = partialDateSchema.nullish();
const sourceIds = z.array(z.string().min(1)).min(1, "Every claim needs at least one source");

// Rendered as links in the admin and public site, so only web URLs are allowed.
const webUrl = z.url({ protocol: /^https?$/ });

export const sourceSchema = z.object({
  id: text(20),
  url: webUrl,
  title: text(500),
  publisher: text(200),
  publishedOn: date,
  accessedOn: partialDateSchema,
  tier: z.enum(sourceTier.enumValues),
  excerpt: z.string().trim().max(300).nullish(),
});

const period = { start: date, end: date };

export const positionSchema = z.object({
  title: text(200),
  institution: text(200),
  institutionKind: z.enum(institutionKind.enumValues).nullish(),
  province: optionalText(100),
  municipality: optionalText(100),
  ...period,
  howObtained: z.enum(positionOrigin.enumValues).nullish(),
  isCurrent: z.boolean().default(false),
  sourceIds,
});

export const partyMembershipSchema = z.object({
  party: z.object({ acronym: text(20), name: text(200) }),
  role: z.enum(membershipRole.enumValues).default("member"),
  ...period,
  exitReason: optionalText(1000),
  sourceIds,
});

export const allianceSchema = z.object({
  counterparty: text(200),
  kind: z.enum(allianceKind.enumValues),
  description: text(2000),
  ...period,
  sourceIds,
});

export const legislationSchema = z.object({
  title: text(500),
  number: optionalText(50),
  kind: z.enum(legislationKind.enumValues),
  status: z.enum(legislationStatus.enumValues).default("unknown"),
  introducedOn: date,
  promulgatedOn: date,
  officialUrl: webUrl.nullish(),
  involvement: z.enum(legislationInvolvement.enumValues),
  notes: optionalText(2000),
  sourceIds,
});

export const statementSchema = z.object({
  kind: z.enum(statementKind.enumValues),
  topic: text(200),
  quote: optionalText(2000),
  context: text(2000),
  saidOn: date,
  sourceIds,
});

export const controversySchema = z.object({
  title: text(300),
  summary: text(4000),
  startedOn: date,
  legalStatus: z.enum(legalStatus.enumValues),
  politicianResponse: optionalText(2000),
  sourceIds,
});

export const researchPayloadSchema = z
  .object({
    schemaVersion: z.literal(RESEARCH_SCHEMA_VERSION),
    livingStatus: z.object({
      isAlive: z.boolean(),
      checkedOn: partialDateSchema,
      sourceIds: z.array(z.string().min(1)).default([]),
    }),
    politician: z.object({
      fullName: text(200),
      knownAs: optionalText(200),
      aliases: z.array(text(200)).default([]),
      birthDate: date,
      birthPlace: optionalText(200),
      deathDate: date,
      summary: text(6000),
      summarySourceIds: sourceIds,
    }),
    positions: z.array(positionSchema).default([]),
    partyMemberships: z.array(partyMembershipSchema).default([]),
    alliances: z.array(allianceSchema).default([]),
    legislation: z.array(legislationSchema).default([]),
    statements: z.array(statementSchema).default([]),
    controversies: z.array(controversySchema).default([]),
    photo: z.object({ url: webUrl, license: text(200), sourceId: text(20) }).nullish(),
    sources: z.array(sourceSchema).min(1),
    gaps: z.array(text(1000)).default([]),
    confidenceNotes: optionalText(4000),
  })
  .superRefine((payload, ctx) => {
    const sources = new Map<string, z.infer<typeof sourceSchema>>();
    payload.sources.forEach((source, i) => {
      if (sources.has(source.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["sources", i, "id"],
          message: "Duplicate source id",
        });
      }
      sources.set(source.id, source);
    });

    const checkRefs = (ids: string[], path: (string | number)[]) => {
      ids.forEach((id, i) => {
        if (!sources.has(id)) {
          ctx.addIssue({
            code: "custom",
            path: [...path, i],
            message: `Unknown source id "${id}"`,
          });
        }
      });
    };

    checkRefs(payload.politician.summarySourceIds, ["politician", "summarySourceIds"]);
    checkRefs(payload.livingStatus.sourceIds, ["livingStatus", "sourceIds"]);
    if (payload.photo) checkRefs([payload.photo.sourceId], ["photo", "sourceId"]);
    for (const section of claimSections) {
      payload[section].forEach((claim, i) => checkRefs(claim.sourceIds, [section, i, "sourceIds"]));
    }

    if (!payload.livingStatus.isAlive && payload.livingStatus.sourceIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["livingStatus", "sourceIds"],
        message: "A death report needs a source",
      });
    }

    // PLAN §6.3: ≥2 independent major-press sources, or ≥1 official source.
    payload.controversies.forEach((controversy, i) => {
      const cited = controversy.sourceIds.map((id) => sources.get(id)).filter((s) => !!s);
      const official = cited.some((s) => s.tier === "official");
      const pressPublishers = new Set(
        cited.filter((s) => s.tier === "major_press").map((s) => s.publisher.toLowerCase()),
      );
      if (!official && pressPublishers.size < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["controversies", i, "sourceIds"],
          message:
            "Controversies need one official source or major-press sources from two different publishers",
        });
      }
    });

    for (const section of ["positions", "partyMemberships", "alliances"] as const) {
      payload[section].forEach((claim, i) => {
        const start = toDbDate(claim.start).date;
        const end = toDbDate(claim.end).date;
        if (start && end && end < start) {
          ctx.addIssue({
            code: "custom",
            path: [section, i, "end"],
            message: "Ends before it starts",
          });
        }
      });
    }

    payload.positions.forEach((position, i) => {
      if (position.isCurrent && position.end) {
        ctx.addIssue({
          code: "custom",
          path: ["positions", i, "end"],
          message: "A current position cannot have an end date",
        });
      }
    });
  });

export const claimSections = [
  "positions",
  "partyMemberships",
  "alliances",
  "legislation",
  "statements",
  "controversies",
] as const;

export type ResearchPayload = z.infer<typeof researchPayloadSchema>;
export type ResearchPayloadInput = z.input<typeof researchPayloadSchema>;
export type ClaimSection = (typeof claimSections)[number];

export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}
