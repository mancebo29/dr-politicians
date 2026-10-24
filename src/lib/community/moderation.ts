import { and, eq, isNull } from "drizzle-orm";
import type { Database, Transaction } from "@/db/client";
import { auditLog, commentReports, comments, sessions, type UserRole, users } from "@/db/schema";
import { CommunityError } from "./comments";

// Moderator and admin actions on comments and accounts (PLAN §8.2, §8.4).
// Every action writes an audit_log row in the same transaction.

export const moderationActions = ["approve", "restore", "dismiss", "hide", "delete"] as const;
export type ModerationAction = (typeof moderationActions)[number];

const outcome = {
  approve: { status: "visible", resolution: "dismissed" },
  restore: { status: "visible", resolution: "dismissed" },
  // Keeps a visible comment and closes its reports.
  dismiss: { status: "visible", resolution: "dismissed" },
  hide: { status: "hidden", resolution: "hidden" },
  delete: { status: "deleted", resolution: "deleted" },
} as const;

export async function moderateComment(
  db: Database,
  input: { actorUserId: string; commentId: string; action: ModerationAction },
  now = new Date(),
) {
  if (!moderationActions.includes(input.action)) throw new CommunityError("Acción no válida.");
  const { status, resolution } = outcome[input.action];
  await db.transaction(async (tx) => {
    const [comment] = await tx
      .select({ status: comments.status, reportCount: comments.reportCount })
      .from(comments)
      .where(eq(comments.id, input.commentId))
      .for("update");
    if (!comment) throw new CommunityError("No encontramos ese comentario.", 404);
    // Resolving reports resets the count, so later reports can hide it again.
    await tx
      .update(commentReports)
      .set({ resolvedByUserId: input.actorUserId, resolution, resolvedAt: now })
      .where(and(eq(commentReports.commentId, input.commentId), isNull(commentReports.resolvedAt)));
    await tx
      .update(comments)
      .set({ status, reportCount: 0 })
      .where(eq(comments.id, input.commentId));
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: `comment.${input.action}`,
      entity: "comment",
      entityId: input.commentId,
      before: comment,
      after: { status, reportCount: 0 },
    });
  });
}

type Actor = { id: string; role: UserRole };

async function targetUser(tx: Transaction, userId: string) {
  const [user] = await tx
    .select({
      id: users.id,
      role: users.role,
      banned: users.banned,
      banReason: users.banReason,
      banExpires: users.banExpires,
    })
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  if (!user) throw new CommunityError("No encontramos esa cuenta.", 404);
  return user;
}

// Moderators may act on regular accounts only; nobody acts on themselves, so
// staff cannot lock themselves out.
function assertCanManage(actor: Actor, target: { id: string; role: UserRole }) {
  if (actor.id === target.id)
    throw new CommunityError("No puedes aplicar esto a tu propia cuenta.", 403);
  if (actor.role !== "admin" && target.role !== "user") {
    throw new CommunityError("Solo un administrador puede gestionar cuentas del equipo.", 403);
  }
}

export async function banUser(
  db: Database,
  input: { actor: Actor; userId: string; reason: string; days: number | null },
  now = new Date(),
) {
  const reason = input.reason.trim();
  if (!reason) throw new CommunityError("Indica el motivo de la suspensión.");
  const banExpires = input.days ? new Date(now.getTime() + input.days * 86_400_000) : null;
  await db.transaction(async (tx) => {
    const target = await targetUser(tx, input.userId);
    assertCanManage(input.actor, target);
    await tx
      .update(users)
      .set({ banned: true, banReason: reason, banExpires })
      .where(eq(users.id, target.id));
    // Signs the account out everywhere, as Better Auth's own ban does.
    await tx.delete(sessions).where(eq(sessions.userId, target.id));
    await tx.insert(auditLog).values({
      actorUserId: input.actor.id,
      action: "user.ban",
      entity: "user",
      entityId: target.id,
      before: { banned: target.banned, banReason: target.banReason, banExpires: target.banExpires },
      after: { banned: true, banReason: reason, banExpires },
    });
  });
}

export async function unbanUser(db: Database, input: { actor: Actor; userId: string }) {
  await db.transaction(async (tx) => {
    const target = await targetUser(tx, input.userId);
    assertCanManage(input.actor, target);
    await tx
      .update(users)
      .set({ banned: false, banReason: null, banExpires: null })
      .where(eq(users.id, target.id));
    await tx.insert(auditLog).values({
      actorUserId: input.actor.id,
      action: "user.unban",
      entity: "user",
      entityId: target.id,
      before: { banned: target.banned, banReason: target.banReason, banExpires: target.banExpires },
      after: { banned: false },
    });
  });
}

export async function setUserRole(
  db: Database,
  input: { actor: Actor; userId: string; role: UserRole },
) {
  if (input.actor.role !== "admin")
    throw new CommunityError("Solo un administrador puede cambiar roles.", 403);
  await db.transaction(async (tx) => {
    const target = await targetUser(tx, input.userId);
    assertCanManage(input.actor, target);
    if (target.role === input.role) return;
    await tx.update(users).set({ role: input.role }).where(eq(users.id, target.id));
    await tx.insert(auditLog).values({
      actorUserId: input.actor.id,
      action: "user.set_role",
      entity: "user",
      entityId: target.id,
      before: { role: target.role },
      after: { role: input.role },
    });
  });
}

export async function revokeUserSessions(db: Database, input: { actor: Actor; userId: string }) {
  await db.transaction(async (tx) => {
    const target = await targetUser(tx, input.userId);
    assertCanManage(input.actor, target);
    const revoked = await tx
      .delete(sessions)
      .where(eq(sessions.userId, target.id))
      .returning({ id: sessions.id });
    await tx.insert(auditLog).values({
      actorUserId: input.actor.id,
      action: "user.revoke_sessions",
      entity: "user",
      entityId: target.id,
      after: { revoked: revoked.length },
    });
  });
}

// Deletes the account and its sign-in data. Comments, reports and feedback
// stay with their author set to null, shown as "usuario eliminado".
export async function deleteUserAccount(db: Database, input: { actor: Actor; userId: string }) {
  if (input.actor.role !== "admin")
    throw new CommunityError("Solo un administrador puede eliminar cuentas.", 403);
  await db.transaction(async (tx) => {
    const target = await targetUser(tx, input.userId);
    assertCanManage(input.actor, target);
    const [snapshot] = await tx
      .select({ name: users.name, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.id, target.id));
    await tx.delete(users).where(eq(users.id, target.id));
    // The email is left out of the audit row on purpose: the account is gone.
    await tx.insert(auditLog).values({
      actorUserId: input.actor.id,
      action: "user.delete",
      entity: "user",
      entityId: target.id,
      before: snapshot,
    });
  });
}
