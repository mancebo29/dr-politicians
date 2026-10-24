import { eq, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditLog, users } from "@/db/schema";

// Bootstrap path for the first admin (PLAN §8). Run from a trusted shell only;
// there is deliberately no UI that reaches this.
export async function promoteToAdmin(db: Database, identifier: string) {
  const value = identifier.trim().toLowerCase();
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(or(eq(users.email, value), eq(users.username, value)));
    if (!user) throw new Error(`No account with email or username "${identifier}"`);
    if (user.role === "admin") return { ...user, changed: false };

    await tx.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    await tx.insert(auditLog).values({
      action: "user.promote_admin",
      entity: "user",
      entityId: user.id,
      before: { role: user.role },
      after: { role: "admin" },
    });
    return { ...user, role: "admin" as const, changed: true };
  });
}
