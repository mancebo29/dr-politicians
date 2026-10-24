import type { institutionKind } from "@/db/schema";

type InstitutionKind = (typeof institutionKind.enumValues)[number];

export const institutions: { slug: string; name: string; kind: InstitutionKind }[] = [
  { slug: "presidencia", name: "Presidencia de la República", kind: "executive" },
  { slug: "vicepresidencia", name: "Vicepresidencia de la República", kind: "executive" },
  { slug: "senado", name: "Senado de la República", kind: "legislature" },
  { slug: "camara-de-diputados", name: "Cámara de Diputados", kind: "legislature" },
  { slug: "parlacen", name: "Parlamento Centroamericano", kind: "international" },
  { slug: "ayuntamiento", name: "Ayuntamiento municipal", kind: "local_government" },
  {
    slug: "junta-distrito-municipal",
    name: "Junta de distrito municipal",
    kind: "local_government",
  },
  { slug: "gobernacion-provincial", name: "Gobernación provincial", kind: "executive" },
];
