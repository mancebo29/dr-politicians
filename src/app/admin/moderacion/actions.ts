"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import type { ActionState } from "@/app/admin/investigacion/actions";
import type { UserRole } from "@/db/schema";
import { CommunityError } from "@/lib/community/comments";
import {
  banUser,
  type ModerationAction,
  moderateComment,
  unbanUser,
} from "@/lib/community/moderation";
import { STAFF_ROLES } from "@/lib/roles";
import { requireRole } from "@/lib/session";

function refresh() {
  revalidatePath("/admin", "layout");
}

export async function moderateCommentAction(commentId: string, action: ModerationAction) {
  const { user } = await requireRole(STAFF_ROLES, "/admin/moderacion");
  await moderateComment(db, { actorUserId: user.id, commentId, action });
  refresh();
}

const banDays = { "1": 1, "7": 7, "30": 30, permanent: null } as const;

export async function banUserAction(
  userId: string,
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireRole(STAFF_ROLES, "/admin/moderacion");
  const duration = String(form.get("duration")) as keyof typeof banDays;
  if (!Object.hasOwn(banDays, duration)) return { error: "Elige la duración." };
  try {
    await banUser(db, {
      actor: { id: user.id, role: user.role as UserRole },
      userId,
      reason: String(form.get("reason") ?? ""),
      days: banDays[duration],
    });
  } catch (error) {
    if (error instanceof CommunityError) return { error: error.message };
    throw error;
  }
  refresh();
  return null;
}

export async function unbanUserAction(userId: string): Promise<ActionState> {
  const { user } = await requireRole(STAFF_ROLES, "/admin/moderacion");
  try {
    await unbanUser(db, { actor: { id: user.id, role: user.role as UserRole }, userId });
  } catch (error) {
    if (error instanceof CommunityError) return { error: error.message };
    throw error;
  }
  refresh();
  return null;
}
