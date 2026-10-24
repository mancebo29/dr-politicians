// Profile sections a correction can point at (feedback form, ProfileView,
// research job instructions). Imports nothing, so the browser can use it.
export const profileSections = {
  resumen: "Resumen",
  trayectoria: "Trayectoria",
  partidos: "Partidos y alianzas",
  gestion: "Gestión",
  leyes: "Leyes e iniciativas",
  posturas: "Posturas",
  declaraciones: "Declaraciones e influencias",
  controversias: "Controversias",
  fuentes: "Fuentes",
  foto: "Foto",
} as const;
export type ProfileSection = keyof typeof profileSections;
