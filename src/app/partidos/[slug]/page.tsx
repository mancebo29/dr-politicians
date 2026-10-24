import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PoliticianDirectory } from "@/components/public/politician-directory";
import { getFilterOptions, getParty } from "@/lib/public/data";

export async function generateStaticParams() {
  const { parties } = await getFilterOptions();
  return parties.length ? parties.map(({ slug }) => ({ slug })) : [{ slug: "prm" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/partidos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party) return { title: "Partido no encontrado" };
  return {
    title: `${party.name} (${party.acronym})`,
    description: `Políticos con militancia actual en el ${party.name} (${party.acronym}), con perfiles y fuentes.`,
    alternates: { canonical: `/partidos/${slug}` },
  };
}

export default function PartyPage(props: PageProps<"/partidos/[slug]">) {
  return (
    <Suspense fallback={<DirectoryPageSkeleton />}>
      <PartyContent {...props} />
    </Suspense>
  );
}

async function PartyContent({ params, searchParams }: PageProps<"/partidos/[slug]">) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <nav aria-label="Ruta de navegación" className="mb-4 text-sm">
        <Link href="/" className="text-muted underline-offset-4 hover:underline">
          ← Todos los políticos
        </Link>
      </nav>
      <p className="text-sm font-semibold tracking-wide text-highlight uppercase">Partido</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {party.name} ({party.acronym})
      </h1>
      <p className="mt-2 text-muted">
        Políticos cuya militancia actual registrada es en este partido.
        {party.status !== "active" && " Este partido ya no está activo."}
      </p>
      <div className="mt-6">
        <PoliticianDirectory
          path={`/partidos/${slug}`}
          searchParams={searchParams}
          fixed={{ party: slug }}
        />
      </div>
    </div>
  );
}

function DirectoryPageSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <div className="h-4 w-36 rounded bg-surface" />
      <div className="mt-5 h-9 w-72 max-w-full rounded bg-surface" />
      <div className="mt-6 h-64 rounded-lg bg-surface" />
    </div>
  );
}
