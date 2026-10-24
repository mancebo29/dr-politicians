// Shared by the server rules and the browser UI, so it imports nothing.

export const MAX_COMMENT_LENGTH = 5000;

export const reportReasons = {
  spam: "Publicidad o spam",
  abuse: "Insultos, acoso o amenazas",
  hate: "Discurso de odio",
  false_claim: "Acusación sin fuente o información falsa",
  personal_data: "Datos personales",
  other: "Otro motivo",
} as const;
export type ReportReason = keyof typeof reportReasons;
