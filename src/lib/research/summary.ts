import {
  allianceKindLabel,
  involvementLabel,
  legalStatusLabel,
  membershipRoleLabel,
  statementKindLabel,
  workRecordKindLabel,
  workRecordStatusLabel,
} from "@/lib/labels";
import { formatPartialDate } from "@/lib/partial-date";
import type { ClaimSection, ResearchPayload } from "./schema";

export const sectionLabel: Record<ClaimSection | "politician" | "photo", string> = {
  politician: "Datos personales y resumen",
  photo: "Foto",
  positions: "Cargos",
  workRecord: "Gestión",
  partyMemberships: "Partidos",
  alliances: "Alianzas",
  legislation: "Leyes e iniciativas",
  statements: "Declaraciones e influencias",
  controversies: "Controversias",
};

function span(start?: string | null, end?: string | null) {
  if (!start && !end) return "";
  return ` (${formatPartialDate(start) || "¿?"}–${formatPartialDate(end) || "…"})`;
}

// One-line description of a claim for review diffs.
export function claimSummary<S extends ClaimSection>(
  section: S,
  claim: ResearchPayload[S][number],
): string {
  switch (section) {
    case "positions": {
      const c = claim as ResearchPayload["positions"][number];
      const place = [c.municipality, c.province].filter(Boolean).join(", ");
      return `${c.title} — ${c.institution}${place ? `, ${place}` : ""}${span(c.start, c.isCurrent ? null : c.end)}`;
    }
    case "workRecord": {
      const c = claim as ResearchPayload["workRecord"][number];
      return `${workRecordKindLabel[c.kind]} · ${c.topic}: ${c.title} · ${workRecordStatusLabel[c.status]}${span(c.start, c.end)}`;
    }
    case "partyMemberships": {
      const c = claim as ResearchPayload["partyMemberships"][number];
      return `${c.party.acronym} · ${membershipRoleLabel[c.role]}${span(c.start, c.end)}`;
    }
    case "alliances": {
      const c = claim as ResearchPayload["alliances"][number];
      return `${allianceKindLabel[c.kind]}: ${c.counterparty} — ${c.description}`;
    }
    case "legislation": {
      const c = claim as ResearchPayload["legislation"][number];
      return `${c.number ? `${c.number}: ` : ""}${c.title} · ${involvementLabel[c.involvement]}`;
    }
    case "statements": {
      const c = claim as ResearchPayload["statements"][number];
      return `${statementKindLabel[c.kind]} · ${c.topic}: ${c.quote ?? c.context}`;
    }
    default: {
      const c = claim as ResearchPayload["controversies"][number];
      return `${c.title} · ${legalStatusLabel[c.legalStatus]}`;
    }
  }
}
