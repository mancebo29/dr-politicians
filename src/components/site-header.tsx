"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { hasRole, STAFF_ROLES } from "@/lib/roles";

const navLinkClass =
  "text-white/80 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

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
    <header className="border-b-4 border-brand-red bg-brand-blue text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <FlagMark />
            Políticos RD
          </Link>
          <nav aria-label="Principal" className="text-sm">
            <Link href="/metodologia" className={navLinkClass}>
              Metodología
            </Link>
          </nav>
        </div>
        <nav aria-label="Cuenta" className="flex items-center gap-4 text-sm">
          {isPending ? null : session ? (
            <>
              {hasRole(session.user, STAFF_ROLES) && (
                <Link href="/admin" className={navLinkClass}>
                  Administración
                </Link>
              )}
              <span className="text-white/70" data-testid="session-user">
                {session.user.displayUsername ?? session.user.name}
              </span>
              <button type="button" onClick={signOut} className={navLinkClass}>
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link href="/iniciar-sesion" className={navLinkClass}>
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="rounded-md bg-brand-red px-3 py-1.5 font-medium text-white hover:bg-brand-red/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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

// The flag's quarters and white cross, without the coat of arms.
function FlagMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 14"
      className="h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-white/40"
    >
      <rect width="20" height="14" fill="#ffffff" />
      <rect width="8.5" height="5.5" fill="#002d62" />
      <rect x="11.5" width="8.5" height="5.5" fill="#ce1126" />
      <rect y="8.5" width="8.5" height="5.5" fill="#ce1126" />
      <rect x="11.5" y="8.5" width="8.5" height="5.5" fill="#002d62" />
    </svg>
  );
}
