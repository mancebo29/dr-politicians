import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { auditLog, feedback, politicians } from "@/db/schema";
import { createJob } from "@/lib/research/queue";
import { CommunityError } from "./comments";
import { type ProfileSection, profileSections } from "./profile-sections";

// Site feedback and profile corrections (PLAN §7.5). Anyone may send it; the
// admin inbox triages it and can turn a correction into a research job.

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null);

export const feedbackInputSchema = z.object({
  kind: z.enum(feedback.kind.enumValues, { error: "Elige el tipo de mensaje." }),
  message: z
    .string()
    .trim()
    .min(10, { error: "Cuéntanos un poco más (al menos 10 caracteres)." })
    .max(5000, { error: "El mensaje puede tener como máximo 5000 caracteres." }),
  politicianSlug: optionalText,
  section: optionalText.pipe(z.enum(Object.keys(profileSections) as [ProfileSection]).nullable()),
  sourceUrl: optionalText.pipe(
    z
      .url({ protocol: /^https?$/, error: "La fuente debe ser un enlace que empiece por http." })
      .max(2000)
      .nullable(),
  ),
  contactEmail: optionalText.pipe(
    z.email({ error: "El correo de contacto no es válido." }).max(320).nullable(),
  ),
});
export type FeedbackInput = z.input<typeof feedbackInputSchema>;

export async function submitFeedback(
  db: Database,
  input: FeedbackInput & { userId: string | null },
) {
  const parsed = feedbackInputSchema.safeParse(input);
  if (!parsed.success) throw new CommunityError(parsed.error.issues[0].message);
  const data = parsed.data;

  let politicianId: string | null = null;
  if (data.politicianSlug) {
    const [row] = await db
      .select({ id: politicians.id })
      .from(politicians)
      .where(eq(politicians.slug, data.politicianSlug));
    politicianId = row?.id ?? null;
  }
  const [row] = await db
    .insert(feedback)
    .values({
      kind: data.kind,
      politicianId,
      section: politicianId ? data.section : null,
      message: data.message,
      sourceUrl: data.sourceUrl,
      contactEmail: data.contactEmail,
      userId: input.userId,
    })
    .returning({ id: feedback.id });
  return row;
}

export async function setFeedbackStatus(
  db: Database,
  input: {
    actorUserId: string;
    feedbackId: string;
    status: (typeof feedback.status.enumValues)[number];
    note?: string | null;
  },
) {
  if (!feedback.status.enumValues.includes(input.status)) {
    throw new CommunityError("Estado no válido.");
  }
  const note = input.note?.trim() || null;
  if ((input.status === "resolved" || input.status === "dismissed") && !note) {
    throw new CommunityError("Explica brevemente cómo se resolvió.");
  }
  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ status: feedback.status, resolutionNote: feedback.resolutionNote })
      .from(feedback)
      .where(eq(feedback.id, input.feedbackId))
      .for("update");
    if (!before) throw new CommunityError("No encontramos ese mensaje.", 404);
    const after = { status: input.status, resolutionNote: note ?? before.resolutionNote };
    await tx.update(feedback).set(after).where(eq(feedback.id, input.feedbackId));
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: "feedback.set_status",
      entity: "feedback",
      entityId: input.feedbackId,
      before,
      after,
    });
  });
}

// Queues a targeted_correction research job for the profile the feedback is
// about, with the report as the job's instructions.
export async function convertFeedbackToResearchJob(
  db: Database,
  input: { actorUserId: string; feedbackId: string },
) {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(feedback)
      .where(eq(feedback.id, input.feedbackId))
      .for("update");
    if (!item) throw new CommunityError("No encontramos ese mensaje.", 404);
    if (!item.politicianId)
      throw new CommunityError("El mensaje no se refiere a ningún perfil.", 409);
    if (item.researchJobId)
      throw new CommunityError("Este mensaje ya tiene una investigación.", 409);

    const section = item.section ? profileSections[item.section as ProfileSection] : null;
    const instructions = [
      `Corrección reportada${section ? ` (sección: ${section})` : ""}: ${item.message}`,
      item.sourceUrl && `Fuente aportada: ${item.sourceUrl}`,
    ]
      .filter(Boolean)
      .join("\n");
    const job = await createJob(tx, {
      kind: "targeted_correction",
      politicianId: item.politicianId,
      instructions,
      createdByUserId: input.actorUserId,
    });
    await tx
      .update(feedback)
      .set({ researchJobId: job.id, status: "triaged" })
      .where(eq(feedback.id, item.id));
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: "feedback.create_research_job",
      entity: "feedback",
      entityId: item.id,
      before: { status: item.status },
      after: { status: "triaged", researchJobId: job.id },
    });
    return job;
  });
}
