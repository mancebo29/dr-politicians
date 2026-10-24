import type {
  allianceKind,
  commentStatus,
  feedbackKind,
  feedbackStatus,
  legalStatus,
  legislationInvolvement,
  legislationKind,
  legislationStatus,
  membershipRole,
  positionOrigin,
  reportResolution,
  researchJobKind,
  researchJobStatus,
  sourceTier,
  statementKind,
  workRecordKind,
  workRecordStatus,
  UserRole,
} from "@/db/schema";
import type { RoleGroup } from "@/lib/public/filters";

type Values<E extends { enumValues: readonly string[] }> = E["enumValues"][number];
type Labels<E extends { enumValues: readonly string[] }> = Record<Values<E>, string>;

export const legalStatusLabel: Labels<typeof legalStatus> = {
  allegation: "Denuncia o señalamiento",
  under_investigation: "En investigación",
  charged: "Acusado formalmente",
  convicted: "Condenado",
  acquitted: "Absuelto",
  dismissed: "Caso archivado o desestimado",
  settled: "Resuelto por acuerdo",
  no_legal_action: "Sin acción judicial",
};

export const involvementLabel: Labels<typeof legislationInvolvement> = {
  author: "Autor",
  co_sponsor: "Coproponente",
  promoter: "Impulsor",
  promulgated: "Promulgó",
  voted_for: "Votó a favor",
  voted_against: "Votó en contra",
  public_advocate: "Defendió públicamente",
  public_opponent: "Se opuso públicamente",
};

export const legislationKindLabel: Labels<typeof legislationKind> = {
  law: "Ley",
  bill: "Proyecto de ley",
  resolution: "Resolución",
  decree: "Decreto",
  other: "Otro",
};

export const legislationStatusLabel: Labels<typeof legislationStatus> = {
  introduced: "Depositado",
  passed: "Aprobado",
  promulgated: "Promulgado",
  rejected: "Rechazado",
  archived: "Archivado",
  unknown: "Estado desconocido",
};

export const membershipRoleLabel: Labels<typeof membershipRole> = {
  member: "Miembro",
  leader: "Dirigente",
  founder: "Fundador",
  candidate: "Candidato",
};

export const allianceKindLabel: Labels<typeof allianceKind> = {
  coalition: "Coalición",
  faction: "Corriente interna",
  mentor: "Mentor",
  ally: "Aliado",
  rival: "Rival",
  other: "Otro",
};

export const statementKindLabel: Labels<typeof statementKind> = {
  statement: "Declaración",
  position: "Postura",
  influence: "Influencia",
};

export const workRecordKindLabel: Labels<typeof workRecordKind> = {
  program: "Programa",
  public_work: "Obra pública",
  policy: "Política pública",
  institutional: "Cambio institucional",
  international: "Acuerdo o gestión internacional",
  other: "Otro",
};

export const workRecordStatusLabel: Labels<typeof workRecordStatus> = {
  announced: "Anunciado",
  in_progress: "En ejecución",
  completed: "Completado",
  cancelled: "Cancelado",
  unknown: "Estado desconocido",
};

export const positionOriginLabel: Labels<typeof positionOrigin> = {
  elected: "Electo",
  appointed: "Designado",
  acting: "Interino",
  other: "Otro",
};

export const sourceTierLabel: Labels<typeof sourceTier> = {
  official: "Fuente oficial",
  major_press: "Prensa",
  other: "Otra",
};

export const jobKindLabel: Labels<typeof researchJobKind> = {
  new_profile: "Perfil nuevo",
  refresh: "Actualización",
  targeted_correction: "Corrección puntual",
};

export const jobStatusLabel: Labels<typeof researchJobStatus> = {
  queued: "En cola",
  claimed: "En investigación",
  submitted: "Pendiente de revisión",
  in_review: "En revisión",
  approved: "Publicado",
  rejected: "Rechazado",
  needs_changes: "Cambios solicitados",
  failed: "Fallido",
  cancelled: "Cancelado",
};

// Public list filter "cargo actual" (PLAN §7.2).
export const roleGroupLabel: Record<RoleGroup, string> = {
  ejecutivo: "Ejecutivo",
  senado: "Senado",
  camara: "Cámara de Diputados",
  alcaldia: "Alcaldía",
  parlacen: "Parlacen",
  partido: "Dirección de partido",
  exfuncionario: "Ex-funcionario",
};

export const feedbackKindLabel: Labels<typeof feedbackKind> = {
  correction: "Corrección de un perfil",
  bug: "Error del sitio",
  suggestion: "Sugerencia",
  other: "Otro",
};

export const feedbackStatusLabel: Labels<typeof feedbackStatus> = {
  new: "Nuevo",
  triaged: "En curso",
  resolved: "Resuelto",
  dismissed: "Descartado",
};

export const commentStatusLabel: Labels<typeof commentStatus> = {
  visible: "Visible",
  pending: "Pendiente",
  hidden: "Oculto",
  deleted: "Eliminado",
};

export const roleLabel: Record<UserRole, string> = {
  user: "Usuario",
  moderator: "Moderación",
  admin: "Administración",
};

export const reportResolutionLabel: Labels<typeof reportResolution> = {
  dismissed: "descartado",
  hidden: "comentario oculto",
  deleted: "comentario eliminado",
};
