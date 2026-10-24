import type { Metadata } from "next";
import Link from "next/link";
import { PoliticianDirectory } from "@/components/public/politician-directory";

export const metadata: Metadata = {
  title: { absolute: "Políticos RD · Perfiles con fuentes de políticos dominicanos" },
  alternates: { canonical: "/" },
};

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Políticos de la República Dominicana
      </h1>
      <p className="mt-2 max-w-3xl text-muted">
        Trayectoria, leyes, partidos, declaraciones y controversias de cada político, con la fuente
        de cada dato. Los perfiles se investigan con ayuda de IA y una persona los revisa antes de
        publicarlos.{" "}
        <Link
          href="/metodologia"
          className="text-accent underline underline-offset-4 hover:decoration-2"
        >
          Cómo trabajamos
        </Link>
      </p>
      <div className="mt-6">
        <PoliticianDirectory path="/" searchParams={searchParams} />
      </div>
    </div>
  );
}
