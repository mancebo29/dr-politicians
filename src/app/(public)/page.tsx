import type { Metadata } from "next";
import Link from "next/link";
import { PoliticianDirectory } from "@/components/public/politician-directory";

export const metadata: Metadata = {
  title: { absolute: "Políticos RD · Perfiles con fuentes de políticos dominicanos" },
  alternates: { canonical: "/" },
};

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <section className="border-b border-border bg-linear-to-b from-surface-tint to-background">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
          <p className="text-sm font-semibold tracking-wide text-highlight uppercase">
            Perfiles con fuentes
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
            Políticos de la República Dominicana
          </h1>
          <p className="mt-3 max-w-3xl text-muted">
            Trayectoria, leyes, partidos, declaraciones y controversias de cada político, con la
            fuente de cada dato. Los perfiles se investigan con ayuda de IA y una persona los revisa
            antes de publicarlos.{" "}
            <Link
              href="/metodologia"
              className="text-accent underline underline-offset-4 hover:decoration-2"
            >
              Cómo trabajamos
            </Link>
          </p>
        </div>
      </section>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
        <PoliticianDirectory path="/" searchParams={searchParams} />
      </div>
    </>
  );
}
