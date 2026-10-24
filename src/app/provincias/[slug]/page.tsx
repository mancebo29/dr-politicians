import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PoliticianDirectory } from "@/components/public/politician-directory";
import { getFilterOptions, getProvince } from "@/lib/public/data";

export async function generateStaticParams() {
  const { provinces } = await getFilterOptions();
  return provinces.length ? provinces.map(({ slug }) => ({ slug })) : [{ slug: "santiago" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/provincias/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const province = await getProvince(slug);
  if (!province) return { title: "Provincia no encontrada" };
  return {
    title: `Políticos de ${province.name}`,
    description: `Políticos que ocupan u ocuparon cargos en ${province.name}, con perfiles y fuentes.`,
    alternates: { canonical: `/provincias/${slug}` },
  };
}

export default function ProvincePage(props: PageProps<"/provincias/[slug]">) {
  return (
    <Suspense fallback={<DirectoryPageSkeleton />}>
      <ProvinceContent {...props} />
    </Suspense>
  );
}

async function ProvinceContent({ params, searchParams }: PageProps<"/provincias/[slug]">) {
  const { slug } = await params;
  const province = await getProvince(slug);
  if (!province) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <nav aria-label="Ruta de navegación" className="mb-4 text-sm">
        <Link href="/" className="text-muted underline-offset-4 hover:underline">
          ← Todos los políticos
        </Link>
      </nav>
      <p className="text-sm font-semibold tracking-wide text-highlight uppercase">
        Provincia{province.region && ` · región ${province.region}`}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{province.name}</h1>
      <p className="mt-2 text-muted">
        Políticos que ocupan u ocuparon un cargo en esta provincia o en uno de sus municipios.
      </p>
      <div className="mt-6">
        <PoliticianDirectory
          path={`/provincias/${slug}`}
          searchParams={searchParams}
          fixed={{ province: slug }}
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
