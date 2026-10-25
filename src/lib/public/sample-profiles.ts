// Fictional sample profiles for local development and end-to-end tests. They
// go through the real research pipeline (job → claim → submit → publish) so
// the public site renders exactly what publishing produces. Every name, claim
// and source here is invented; none of it describes a real person.
import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { politicians, sources, users } from "@/db/schema";
import { publishSections, publishSubmission } from "@/lib/research/publish";
import { claimNextJob, createJob, type SourceChecker, submitResearch } from "@/lib/research/queue";
import type { ResearchPayloadInput } from "@/lib/research/schema";
import { createResearchToken, revokeResearchToken } from "@/lib/research/tokens";

const CHECKED_ON = "2026-10-24";
const SAMPLE_PRIORITY = 1_000_000;

type SourceInput = ResearchPayloadInput["sources"][number];

function source(key: string, n: number, extra: Partial<SourceInput> = {}): SourceInput {
  return {
    id: `s${n}`,
    url: `https://example.org/muestra/${key}/${n}`,
    title: `Artículo de ejemplo ${n} sobre ${key}`,
    publisher: n % 2 ? "Diario Ejemplo" : "Noticias de Muestra",
    publishedOn: "2024-05-10",
    accessedOn: CHECKED_ON,
    tier: "major_press",
    excerpt: `Fragmento ilustrativo ${n}.`,
    ...extra,
  };
}

function profile(
  key: string,
  input: Pick<ResearchPayloadInput, "politician"> & Partial<ResearchPayloadInput>,
): ResearchPayloadInput {
  return {
    schemaVersion: 1,
    livingStatus: { isAlive: true, checkedOn: CHECKED_ON },
    positions: [],
    partyMemberships: [],
    alliances: [],
    legislation: [],
    statements: [],
    controversies: [],
    photo: null,
    sources: [source(key, 1), source(key, 2)],
    gaps: [],
    ...input,
  };
}

export const sampleProfiles: ResearchPayloadInput[] = [
  profile("jose-pena", {
    politician: {
      fullName: "José Ramón Peña Ejemplo",
      knownAs: "José Peña",
      aliases: ["Joselo Peña"],
      birthDate: "1968-03",
      birthPlace: "Santiago de los Caballeros",
      summary:
        "Perfil ficticio de ejemplo. Senador por Santiago desde 2020, antes diputado por la misma provincia.",
      summarySourceIds: ["s1"],
    },
    positions: [
      {
        title: "Diputado",
        institution: "Cámara de Diputados",
        province: "Santiago",
        start: "2016-08-16",
        end: "2020-08-16",
        howObtained: "elected",
        sourceIds: ["s2"],
      },
      {
        title: "Senador",
        institution: "Senado de la República",
        province: "Santiago",
        start: "2020-08-16",
        isCurrent: true,
        howObtained: "elected",
        sourceIds: ["s1"],
      },
    ],
    partyMemberships: [
      {
        party: { acronym: "PRM", name: "Partido Revolucionario Moderno" },
        start: "2014",
        sourceIds: ["s1"],
      },
    ],
    workRecord: [
      {
        title: "Comisión de ejemplo sobre presupuestos municipales",
        kind: "institutional",
        status: "completed",
        topic: "Gobierno local",
        office: "Senador",
        description: "Presidió una comisión ficticia que revisó presupuestos municipales.",
        start: "2021",
        end: "2022",
        sourceIds: ["s1"],
      },
    ],
    alliances: [
      {
        counterparty: "Corriente de ejemplo",
        kind: "faction",
        description: "Integra una corriente interna ficticia.",
        sourceIds: ["s2"],
      },
    ],
    legislation: [
      {
        title: "Ley de ejemplo sobre transparencia municipal",
        number: "E-101-21",
        kind: "law",
        status: "promulgated",
        promulgatedOn: "2021-06",
        involvement: "author",
        sourceIds: ["s3"],
      },
    ],
    statements: [
      {
        kind: "statement",
        topic: "Presupuesto",
        quote: "Cita ficticia usada solo como ejemplo.",
        context: "Declaración de ejemplo en una entrevista inventada.",
        saidOn: "2024-02-01",
        sourceIds: ["s2"],
      },
      {
        kind: "position",
        topic: "Educación",
        context: "Apoya, en un ejemplo inventado, ampliar la tanda extendida.",
        saidOn: "2023-09",
        sourceIds: ["s1"],
      },
    ],
    controversies: [
      {
        title: "Controversia de ejemplo",
        summary: "Hechos ficticios reportados por dos medios inventados.",
        startedOn: "2023",
        legalStatus: "allegation",
        politicianResponse: "Respuesta ficticia de ejemplo.",
        sourceIds: ["s1", "s2"],
      },
    ],
    sources: [
      source("jose-pena", 1),
      source("jose-pena", 2),
      source("jose-pena", 3, {
        title: "Gaceta de ejemplo",
        publisher: "Gaceta Oficial de Muestra",
        tier: "official",
        excerpt: null,
      }),
    ],
  }),
  profile("maria-nunez", {
    politician: {
      fullName: "María Altagracia Núñez Prueba",
      knownAs: "María Núñez",
      summary: "Perfil ficticio de ejemplo. Diputada por La Vega desde 2024.",
      summarySourceIds: ["s1"],
    },
    positions: [
      {
        title: "Diputada",
        institution: "Cámara de Diputados",
        province: "La Vega",
        start: "2024-08-16",
        isCurrent: true,
        howObtained: "elected",
        sourceIds: ["s1"],
      },
    ],
    partyMemberships: [
      { party: { acronym: "FP", name: "Fuerza del Pueblo" }, start: "2019", sourceIds: ["s2"] },
    ],
  }),
  profile("carlos-ficticio", {
    politician: {
      fullName: "Carlos Manuel Ficticio Demo",
      knownAs: "Carlos Ficticio",
      summary: "Perfil ficticio de ejemplo. Ministro de un ministerio inventado.",
      summarySourceIds: ["s1"],
    },
    positions: [
      {
        title: "Ministro de Ejemplo",
        institution: "Ministerio de Ejemplo",
        institutionKind: "ministry",
        start: "2024-08",
        isCurrent: true,
        howObtained: "appointed",
        sourceIds: ["s1"],
      },
    ],
    partyMemberships: [
      {
        party: { acronym: "PLD", name: "Partido de la Liberación Dominicana" },
        start: "2005",
        sourceIds: ["s2"],
      },
    ],
  }),
  profile("ana-prueba", {
    politician: {
      fullName: "Ana Lucía Prueba Ejemplar",
      knownAs: "Ana Prueba",
      summary: "Perfil ficticio de ejemplo. Exsenadora por Santiago y dirigente de su partido.",
      summarySourceIds: ["s1"],
    },
    positions: [
      {
        title: "Senadora",
        institution: "Senado de la República",
        province: "Santiago",
        start: "2016-08-16",
        end: "2020-08-16",
        howObtained: "elected",
        sourceIds: ["s1"],
      },
    ],
    partyMemberships: [
      {
        party: { acronym: "PRM", name: "Partido Revolucionario Moderno" },
        role: "leader",
        start: "2015",
        sourceIds: ["s2"],
      },
    ],
  }),
  profile("luis-demo", {
    politician: {
      fullName: "Luis Alberto Demo Muestra",
      knownAs: "Luis Demo",
      summary: "Perfil ficticio de ejemplo. Alcalde de Jarabacoa.",
      summarySourceIds: ["s1"],
    },
    positions: [
      {
        title: "Alcalde",
        institution: "Ayuntamiento municipal",
        municipality: "Jarabacoa",
        start: "2024-04-24",
        isCurrent: true,
        howObtained: "elected",
        sourceIds: ["s1"],
      },
    ],
    partyMemberships: [
      {
        party: { acronym: "PRSC", name: "Partido Reformista Social Cristiano" },
        start: "2010",
        sourceIds: ["s2"],
      },
    ],
  }),
  profile("pedro-muestra", {
    politician: {
      fullName: "Pedro Ejemplo Muestra",
      knownAs: "Pedro Muestra",
      summary: "Perfil ficticio de ejemplo. Diputado al Parlamento Centroamericano.",
      summarySourceIds: ["s1"],
    },
    positions: [
      {
        title: "Diputado al Parlacen",
        institution: "Parlamento Centroamericano",
        start: "2024-08-16",
        isCurrent: true,
        howObtained: "elected",
        sourceIds: ["s1"],
      },
    ],
    partyMemberships: [
      { party: { acronym: "FP", name: "Fuerza del Pueblo" }, start: "2020", sourceIds: ["s2"] },
    ],
  }),
  profile("rafael-difunto", {
    politician: {
      fullName: "Rafael Antonio Ejemplo Difunto",
      knownAs: "Rafael Difunto",
      summary: "Perfil ficticio de ejemplo. Exdiputado por Duarte.",
      summarySourceIds: ["s1"],
    },
    positions: [
      {
        title: "Diputado",
        institution: "Cámara de Diputados",
        province: "Duarte",
        start: "2016-08-16",
        end: "2020-08-16",
        howObtained: "elected",
        sourceIds: ["s1"],
      },
    ],
    partyMemberships: [
      {
        party: { acronym: "PRD", name: "Partido Revolucionario Dominicano" },
        start: "2000",
        sourceIds: ["s2"],
      },
    ],
  }),
];

// Filler profiles so lists have more than one page.
export function fillerProfiles(count: number): ResearchPayloadInput[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return profile(`relleno-${n}`, {
      politician: {
        fullName: `Persona de Relleno ${n}`,
        summary: "Perfil ficticio de relleno para probar la paginación.",
        summarySourceIds: ["s1"],
      },
      positions: [
        {
          title: "Diputado",
          institution: "Cámara de Diputados",
          province: "Azua",
          start: "2024-08-16",
          isCurrent: true,
          howObtained: "elected",
          sourceIds: ["s1"],
        },
      ],
      partyMemberships: [
        {
          party: { acronym: "PLD", name: "Partido de la Liberación Dominicana" },
          start: "2010",
          sourceIds: ["s2"],
        },
      ],
    });
  });
}

const allReachable: SourceChecker = async (list) =>
  list.map((s) => ({ id: s.id, url: s.url, ok: true, status: 200 }));

// Publishes the samples that are not already in the database; returns the
// slugs of everything it published. Rafael Difunto is then marked deceased
// through a refresh job, and José Peña's first source gets an archived copy,
// as the Wayback archiving step would record it.
export async function publishSampleProfiles(
  db: Database,
  options: { fillers?: number } = {},
): Promise<string[]> {
  const email = "muestras@example.org";
  const [reviewer] = await db
    .insert(users)
    .values({ name: "Datos de muestra", email, role: "admin" })
    .onConflictDoUpdate({ target: users.email, set: { name: "Datos de muestra" } })
    .returning({ id: users.id });
  const { id: tokenId } = await createResearchToken(db, {
    name: "datos de muestra",
    createdByUserId: reviewer.id,
  });

  async function run(
    payload: ResearchPayloadInput,
    job: { kind: "new_profile" | "refresh"; politicianId?: string },
    sections: readonly (typeof publishSections)[number][],
  ) {
    const created = await createJob(db, {
      kind: job.kind,
      politicianId: job.politicianId ?? null,
      requestedName: payload.politician.fullName,
      priority: SAMPLE_PRIORITY,
      createdByUserId: reviewer.id,
    });
    const brief = await claimNextJob(db, tokenId);
    if (brief?.job.id !== created.id) {
      throw new Error("Another queued job was claimed first; clear the queue and retry");
    }
    const { submissionId } = await submitResearch(db, {
      tokenId,
      jobId: created.id,
      payload,
      checkSources: allReachable,
    });
    return publishSubmission(db, {
      submissionId,
      reviewerUserId: reviewer.id,
      sections,
      note: "Datos de muestra ficticios",
    });
  }

  const published: string[] = [];
  try {
    for (const payload of [...sampleProfiles, ...fillerProfiles(options.fillers ?? 0)]) {
      const [existing] = await db
        .select({ id: politicians.id })
        .from(politicians)
        .where(eq(politicians.fullName, payload.politician.fullName));
      if (existing) continue;
      const { slug, politicianId } = await run(payload, { kind: "new_profile" }, publishSections);
      published.push(slug);

      if (payload.politician.fullName === "Rafael Antonio Ejemplo Difunto") {
        await run(
          {
            ...payload,
            livingStatus: { isAlive: false, checkedOn: CHECKED_ON, sourceIds: ["s3"] },
            politician: { ...payload.politician, deathDate: "2025-03" },
            sources: [
              ...payload.sources,
              source("rafael-difunto", 3, { title: "Nota luctuosa de ejemplo" }),
            ],
          },
          { kind: "refresh", politicianId },
          ["politician"],
        );
      }
    }
    await db
      .update(sources)
      .set({
        archiveUrl: "https://web.archive.org/web/2026/https://example.org/muestra/jose-pena/1",
      })
      .where(eq(sources.url, "https://example.org/muestra/jose-pena/1"));
  } finally {
    await revokeResearchToken(db, tokenId);
  }
  return published;
}
