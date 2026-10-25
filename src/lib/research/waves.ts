// Who each wave covers (PLAN §6.5), split into segments small enough for one
// roster-discovery session. Order matters: approving a segment's roster queues
// discovery for the next segment. Add stage 2 periods at the end as needed.
export type WaveSegment = {
  key: string;
  wave: number;
  title: string;
  // Instructions for the discovery session, in Spanish like the profiles.
  criteria: string;
};

export const waveSegments: readonly WaveSegment[] = [
  {
    key: "ola-1",
    wave: 1,
    title: "Ola 1 · Figuras nacionales",
    criteria:
      "Presidente y vicepresidente de la República en funciones; las candidaturas presidenciales de 2024 (toda la boleta); presidentes y secretarios generales de los partidos con representación en el Congreso; presidentes del Senado y de la Cámara de Diputados; titulares en funciones de los ministerios de la Presidencia, Hacienda y Economía, Interior y Policía, Relaciones Exteriores, Defensa, Educación, Salud Pública, Obras Públicas, Justicia, Industria y Comercio, Energía y Minas y Turismo. Unas 25 personas.",
  },
  {
    key: "ola-2",
    wave: 2,
    title: "Ola 2 · Senado y gabinete",
    criteria:
      "Los senadores en funciones del período 2024–2028 y los ministros en funciones que no estén en la ola 1. Unas 50 personas.",
  },
  {
    key: "ola-3",
    wave: 3,
    title: "Ola 3 · Cámara de Diputados",
    criteria:
      "Los diputados en funciones del período 2024–2028, incluidos los diputados nacionales y los de la circunscripción exterior.",
  },
  {
    key: "ola-4",
    wave: 4,
    title: "Ola 4 · Grandes alcaldías y Parlacen",
    criteria:
      "Alcaldes en funciones (2024–2028) de los 20 municipios más poblados según el censo más reciente de la ONE, y los diputados dominicanos al Parlamento Centroamericano en funciones.",
  },
  {
    key: "ola-5-alcaldes",
    wave: 5,
    title: "Ola 5 · Alcaldías restantes",
    criteria:
      "Alcaldes en funciones (2024–2028) de los municipios que no están entre los 20 más poblados.",
  },
  {
    key: "ola-5-gabinetes",
    wave: 5,
    title: "Ola 5 · Exministros desde 2016",
    criteria:
      "Vicepresidentes y ministros de los gobiernos 2016–2020 y 2020–2024 que hoy no ocupan un cargo de las olas 1 a 4.",
  },
  {
    key: "ola-5-congreso-2020",
    wave: 5,
    title: "Ola 5 · Exlegisladores 2020–2024",
    criteria:
      "Senadores y diputados del período 2020–2024 que hoy no ocupan un cargo de las olas 1 a 4.",
  },
  {
    key: "ola-5-congreso-2016",
    wave: 5,
    title: "Ola 5 · Exlegisladores 2016–2020",
    criteria:
      "Senadores y diputados del período 2016–2020 que hoy no ocupan un cargo de las olas 1 a 4.",
  },
  {
    key: "ola-5-alcaldes-anteriores",
    wave: 5,
    title: "Ola 5 · Exalcaldes 2016–2024",
    criteria:
      "Alcaldes de los períodos 2016–2020 y 2020–2024 que hoy no ocupan un cargo de las olas 1 a 4.",
  },
  {
    key: "ola-5-candidatos",
    wave: 5,
    title: "Ola 5 · Candidaturas presidenciales 2016 y 2020",
    criteria:
      "Candidatos a presidente y vicepresidente en las elecciones de 2016 y 2020 que no estén en olas anteriores.",
  },
  {
    key: "ola-6",
    wave: 6,
    title: "Ola 6 · Gobierno 2012–2016",
    criteria:
      "Presidente, vicepresidente y ministros del gobierno 2012–2016 que no estén en olas anteriores.",
  },
  {
    key: "ola-7",
    wave: 7,
    title: "Ola 7 · Congreso 2010–2016",
    criteria:
      "Senadores y diputados del período 2010–2016 que no estén en olas anteriores; primero los senadores.",
  },
  {
    key: "ola-8",
    wave: 8,
    title: "Ola 8 · Alcaldes 2010–2016",
    criteria: "Alcaldes del período 2010–2016 que no estén en olas anteriores.",
  },
  {
    key: "ola-9",
    wave: 9,
    title: "Ola 9 · Gobiernos 2004–2012",
    criteria:
      "Presidente, vicepresidente y ministros de los gobiernos 2004–2008 y 2008–2012 que no estén en olas anteriores.",
  },
];

export function waveSegment(key: string) {
  return waveSegments.find((s) => s.key === key);
}

export function nextWaveSegment(key: string) {
  const i = waveSegments.findIndex((s) => s.key === key);
  return i >= 0 ? waveSegments[i + 1] : undefined;
}
