import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Página no encontrada</h1>
      <p className="mt-4 text-muted">
        No existe esta página o el perfil no está publicado. Puedes buscar a la persona en el
        listado.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-accent underline underline-offset-4 hover:decoration-2"
      >
        Ir al listado de políticos
      </Link>
    </section>
  );
}
