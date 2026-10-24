import type { UserRole } from "@/db/schema";

export const STAFF_ROLES: readonly UserRole[] = ["admin", "moderator"];

export function hasRole(
  user: { role?: string | null; banned?: boolean | null } | null | undefined,
  allowed: readonly UserRole[],
): boolean {
  if (!user || user.banned) return false;
  return allowed.includes(user.role as UserRole);
}
