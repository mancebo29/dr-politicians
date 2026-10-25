import type { RosterPayloadInput } from "./roster";
import type { ResearchPayloadInput } from "./schema";

// A small, valid submission for tests. Values are illustrative, not research.
export function samplePayload(overrides: Partial<ResearchPayloadInput> = {}): ResearchPayloadInput {
  return {
    schemaVersion: 1,
    livingStatus: { isAlive: true, checkedOn: "2026-10-24" },
    politician: {
      fullName: "Persona de Prueba Ejemplo",
      knownAs: "Persona Prueba",
      aliases: ["P. Prueba"],
      birthDate: "1970-05",
      summary: "Político de prueba con una carrera ficticia.",
      summarySourceIds: ["s1"],
    },
    positions: [
      {
        title: "Senador",
        institution: "Senado de la República",
        province: "Santiago",
        start: "2020-08-16",
        end: "2024-08-16",
        howObtained: "elected",
        sourceIds: ["s1"],
      },
      {
        title: "Ministro de Prueba",
        institution: "Ministerio de Pruebas",
        institutionKind: "ministry",
        start: "2024-08",
        isCurrent: true,
        howObtained: "appointed",
        sourceIds: ["s2"],
      },
    ],
    workRecord: [
      {
        title: "Programa de prueba",
        kind: "program",
        status: "completed",
        topic: "Educación",
        office: "Ministro de Prueba",
        description: "Programa ficticio ejecutado desde el ministerio.",
        start: "2024-09",
        end: "2025",
        sourceIds: ["s2"],
      },
    ],
    partyMemberships: [
      {
        party: { acronym: "PRM", name: "Partido Revolucionario Moderno" },
        start: "2014",
        sourceIds: ["s1"],
      },
    ],
    legislation: [
      {
        title: "Ley de prueba",
        number: "1-99",
        kind: "law",
        status: "promulgated",
        involvement: "author",
        sourceIds: ["s3"],
      },
    ],
    statements: [
      { kind: "statement", topic: "Economía", context: "Entrevista de prueba.", sourceIds: ["s2"] },
      {
        kind: "position",
        topic: "Educación",
        context: "Defiende ampliar la tanda extendida.",
        saidOn: "2025-03",
        sourceIds: ["s1"],
      },
    ],
    controversies: [
      {
        title: "Controversia de prueba",
        summary: "Hechos ficticios reportados por dos medios.",
        legalStatus: "allegation",
        sourceIds: ["s1", "s2"],
      },
    ],
    sources: [
      {
        id: "s1",
        url: "https://example.org/a",
        title: "Artículo A",
        publisher: "Diario Uno",
        accessedOn: "2026-10-24",
        tier: "major_press",
        excerpt: "Fragmento A",
      },
      {
        id: "s2",
        url: "https://example.org/b",
        title: "Artículo B",
        publisher: "Diario Dos",
        accessedOn: "2026-10-24",
        tier: "major_press",
      },
      {
        id: "s3",
        url: "https://example.gob.do/ley",
        title: "Ley 1-99",
        publisher: "Gaceta Oficial",
        accessedOn: "2026-10-24",
        tier: "official",
      },
    ],
    gaps: [],
    ...overrides,
  };
}

// A small, valid roster for tests. Names are invented.
export function sampleRoster(overrides: Partial<RosterPayloadInput> = {}): RosterPayloadInput {
  return {
    schemaVersion: 1,
    segment: "ola-1",
    people: [
      {
        fullName: "Primera Persona Ficticia",
        office: "Senadora por Santiago (2024–2028)",
        province: "Santiago",
        partyAcronym: "PRM",
        sourceIds: ["s1"],
      },
      {
        fullName: "Segunda Persona Ficticia",
        knownAs: "Segunda",
        office: "Ministro de Pruebas",
        notes: "No confundir con su hermano.",
        sourceIds: ["s1"],
      },
      { fullName: "Persona de Prueba Ejemplo", office: "Diputado", sourceIds: ["s1"] },
    ],
    sources: [
      {
        id: "s1",
        url: "https://example.gob.do/listado",
        title: "Listado oficial",
        publisher: "Senado de la República",
        accessedOn: "2026-10-24",
        tier: "official",
      },
    ],
    gaps: [],
    ...overrides,
  };
}
