import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Acceso denegado", robots: { index: false } };

export default function AccessDeniedPage() {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Acceso denegado</h1>
      <p className="mt-4 text-muted">Tu cuenta no tiene permiso para ver esta sección.</p>
      <Link href="/" className="mt-6 inline-block text-accent underline-offset-4 hover:underline">
        Volver al inicio
      </Link>
    </section>
  );
}
