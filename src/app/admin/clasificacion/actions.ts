"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { decideRefreshProposal } from "@/lib/popularity/refresh";
import { requireRole } from "@/lib/session";

export async function decideRefreshProposalAction(
  proposalId: string,
  decision: "approved" | "dismissed",
) {
  const { user } = await requireRole(["admin"], "/admin/clasificacion");
  await decideRefreshProposal(db, { proposalId, actorUserId: user.id, decision });
  revalidatePath("/admin/clasificacion");
  revalidatePath("/admin");
}
