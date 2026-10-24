import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Perfiles investigados con ayuda de IA y revisados por personas. Cada dato enlaza a su
          fuente.
        </p>
        <nav aria-label="Pie de página" className="flex gap-4">
          <Link href="/metodologia" className="underline-offset-4 hover:underline">
            Metodología
          </Link>
          {/* The feedback page ships in Phase 5; no prefetch until it exists. */}
          <Link href="/feedback" prefetch={false} className="underline-offset-4 hover:underline">
            Reportar un error
          </Link>
        </nav>
      </div>
    </footer>
  );
}
