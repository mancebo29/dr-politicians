import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/roles";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

// Authorization boundary for admin pages and server actions. proxy.ts only does
// an optimistic cookie check, so every protected entry point must call this.
// (Next's forbidden() would give a 403 but still needs an experimental flag.)
export async function requireRole(allowed: readonly UserRole[], returnTo = "/admin") {
  const session = await getSession();
  if (!session) redirect(`/iniciar-sesion?next=${encodeURIComponent(returnTo)}`);
  if (!hasRole(session.user, allowed)) redirect("/acceso-denegado");
  return session;
}
