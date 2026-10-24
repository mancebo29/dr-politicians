"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import type { ActionState } from "@/app/admin/investigacion/actions";
import { type UserRole, userRoles } from "@/db/schema";
import { CommunityError } from "@/lib/community/comments";
import { deleteUserAccount, revokeUserSessions, setUserRole } from "@/lib/community/moderation";
import { requireRole } from "@/lib/session";

const PATH = "/admin/usuarios";

async function admin() {
  const { user } = await requireRole(["admin"], PATH);
  return { id: user.id, role: user.role as UserRole };
}

async function attempt(work: () => Promise<void>): Promise<ActionState> {
  try {
    await work();
  } catch (error) {
    if (error instanceof CommunityError) return { error: error.message };
    throw error;
  }
  revalidatePath(PATH, "layout");
  return null;
}

export async function setRoleAction(userId: string, _: ActionState, form: FormData) {
  const actor = await admin();
  const role = form.get("role") as UserRole;
  if (!userRoles.includes(role)) return { error: "Rol no válido." };
  return attempt(() => setUserRole(db, { actor, userId, role }));
}

export async function revokeSessionsAction(userId: string) {
  const actor = await admin();
  return attempt(() => revokeUserSessions(db, { actor, userId }));
}

export async function deleteUserAction(userId: string, _: ActionState, form: FormData) {
  const actor = await admin();
  if (form.get("confirm") !== "on") return { error: "Confirma que quieres eliminar la cuenta." };
  const result = await attempt(() => deleteUserAccount(db, { actor, userId }));
  if (result) return result;
  redirect(PATH);
}
