import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditLog, refreshProposals, researchJobs } from "@/db/schema";

const ACTIVE = ["queued", "claimed", "submitted", "in_review", "needs_changes"] as const;

export class RefreshProposalError extends Error {}

export async function decideRefreshProposal(
  db: Database,
  input: { proposalId: string; actorUserId: string; decision: "approved" | "dismissed" },
) {
  return db.transaction(async (tx) => {
    const [proposal] = await tx
      .select()
      .from(refreshProposals)
      .where(eq(refreshProposals.id, input.proposalId))
      .for("update");
    if (!proposal) throw new RefreshProposalError("La propuesta no existe.");
    if (proposal.status !== "pending") {
      throw new RefreshProposalError("La propuesta ya fue decidida.");
    }

    let jobId: string | null = null;
    if (input.decision === "approved") {
      const [active] = await tx
        .select({ id: researchJobs.id })
        .from(researchJobs)
        .where(
          and(
            eq(researchJobs.politicianId, proposal.politicianId),
            inArray(researchJobs.status, ACTIVE),
          ),
        )
        .limit(1);
      if (active) {
        throw new RefreshProposalError("El perfil ya tiene una investigación activa.");
      }
      const [job] = await tx
        .insert(researchJobs)
        .values({
          politicianId: proposal.politicianId,
          kind: "refresh",
          status: "queued",
          priority: Math.max(0, 1_000 - proposal.rank),
          instructions: `Actualización sugerida por la clasificación de la semana ${proposal.weekStart} (puesto ${proposal.rank}).`,
          createdByUserId: input.actorUserId,
        })
        .returning({ id: researchJobs.id });
      jobId = job.id;
    }

    const decidedAt = new Date();
    const [updated] = await tx
      .update(refreshProposals)
      .set({
        status: input.decision,
        jobId,
        decidedByUserId: input.actorUserId,
        decidedAt,
      })
      .where(eq(refreshProposals.id, proposal.id))
      .returning();
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: `refresh_proposal.${input.decision}`,
      entity: "refresh_proposal",
      entityId: proposal.id,
      before: proposal,
      after: updated,
    });
    return updated;
  });
}
