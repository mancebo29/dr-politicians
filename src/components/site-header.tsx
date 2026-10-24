"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { hasRole, STAFF_ROLES } from "@/lib/roles";

// Session is read client-side so public pages stay statically renderable.
export function SiteHeader() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Políticos RD
        </Link>
        <nav aria-label="Cuenta" className="flex items-center gap-4 text-sm">
          {isPending ? null : session ? (
            <>
              {hasRole(session.user, STAFF_ROLES) && (
                <Link href="/admin" className="hover:underline">
                  Administración
                </Link>
              )}
              <span className="text-muted" data-testid="session-user">
                {session.user.displayUsername ?? session.user.name}
              </span>
              <button type="button" onClick={signOut} className="hover:underline">
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link href="/iniciar-sesion" className="hover:underline">
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-foreground"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
