"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import type { ActionState } from "@/app/admin/investigacion/actions";
import { CommunityError } from "@/lib/community/comments";
import { convertFeedbackToResearchJob, setFeedbackStatus } from "@/lib/community/feedback";
import { STAFF_ROLES } from "@/lib/roles";
import { requireRole } from "@/lib/session";

const PATH = "/admin/feedback";

function failure(error: unknown): ActionState {
  if (error instanceof CommunityError) return { error: error.message };
  throw error;
}

export async function triageFeedbackAction(feedbackId: string) {
  const { user } = await requireRole(STAFF_ROLES, PATH);
  await setFeedbackStatus(db, { actorUserId: user.id, feedbackId, status: "triaged" });
  revalidatePath("/admin", "layout");
}

export async function closeFeedbackAction(
  feedbackId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireRole(STAFF_ROLES, PATH);
  const status = form.get("status");
  if (status !== "resolved" && status !== "dismissed") return { error: "Elige cómo se cierra." };
  try {
    await setFeedbackStatus(db, {
      actorUserId: user.id,
      feedbackId,
      status,
      note: String(form.get("note") ?? ""),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin", "layout");
  return null;
}

// Research jobs are admin-only, so moderators triage and admins convert.
export async function feedbackToResearchAction(feedbackId: string): Promise<ActionState> {
  const { user } = await requireRole(["admin"], PATH);
  try {
    await convertFeedbackToResearchJob(db, { actorUserId: user.id, feedbackId });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin", "layout");
  return null;
}
