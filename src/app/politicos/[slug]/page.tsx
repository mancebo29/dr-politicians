import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile/profile-view";
import { PartyBadge } from "@/components/public/party-badge";
import { formatPartialDate } from "@/lib/partial-date";
import { getPrerenderSlugs, getPublicProfile } from "@/lib/public/data";

// Profiles only read cached data, so the whole page is static. Requiring that
// also makes a direct visit to a slug that was not prerendered wait for the
// complete render instead of streaming the App Shell, so notFound() sends a
// real 404 status for unknown, draft and archived profiles. Client
// navigations still get the instant shell from the <Suspense> below.
export const ensureStatic = "navigation";

// The most recently published profiles are prerendered; any other slug renders
// on its first visit. Cache Components needs at least one entry to validate
// the route at build time, hence the placeholder before anything is published.
export async function generateStaticParams() {
  const slugs = await getPrerenderSlugs();
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "sin-perfiles" }];
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export async function generateMetadata({
  params,
}: PageProps<"/politicos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) return { title: "Perfil no encontrado" };
  const p = profile.payload.politician;
  const name = p.knownAs ?? p.fullName;
  const description = truncate(p.summary.replace(/\s+/g, " "), 160);
  return {
    title: name,
    description,
    alternates: { canonical: `/politicos/${slug}` },
    openGraph: { type: "profile", title: name, description, url: `/politicos/${slug}` },
  };
}

const dateFormat = new Intl.DateTimeFormat("es-DO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Santo_Domingo",
});

export default function PoliticianPage({ params }: PageProps<"/politicos/[slug]">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <nav aria-label="Ruta de navegación" className="mb-6 text-sm">
        <Link href="/" className="text-muted underline-offset-4 hover:underline">
          ← Todos los políticos
        </Link>
      </nav>
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile params={params} />
      </Suspense>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="h-9 w-64 rounded bg-surface" />
      <div className="h-4 w-80 max-w-full rounded bg-surface" />
      <div className="mt-10 h-40 rounded bg-surface" />
    </div>
  );
}

async function Profile({ params }: Pick<PageProps<"/politicos/[slug]">, "params">) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) notFound();

  const { payload, party, revisions } = profile;
  const current = payload.positions.filter((p) => p.isCurrent);
  const lastRevision = revisions[0];
  const reportHref = `/feedback?politico=${encodeURIComponent(slug)}`;

  return (
    <>
      <ProfileView
        payload={payload}
        archiveUrls={profile.archiveUrls}
        headerAside={
          <div className="mt-3 space-y-2">
            {payload.politician.deathDate && (
              <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
                Persona fallecida ({formatPartialDate(payload.politician.deathDate)}). El perfil se
                conserva como registro histórico.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {party && <PartyBadge party={party} />}
              {current.length > 0 ? (
                <span data-testid="current-roles">
                  {current
                    .map((c) =>
                      [c.title, c.municipality ?? c.province ?? null].filter(Boolean).join(", "),
                    )
                    .join(" · ")}
                </span>
              ) : (
                <span className="text-muted">Sin cargo público actual</span>
              )}
            </div>
            <Link
              href={reportHref}
              prefetch={false}
              className="inline-block text-sm text-accent underline underline-offset-4 hover:decoration-2"
            >
              Reportar un error / Derecho de réplica
            </Link>
          </div>
        }
      />

      <section
        aria-labelledby="actualizacion"
        className="mt-10 rounded-lg border border-border bg-surface p-4 text-sm"
      >
        <h2 id="actualizacion" className="font-semibold">
          Última actualización
        </h2>
        {lastRevision ? (
          <p className="mt-1">
            <time dateTime={lastRevision.at.toISOString()}>
              {dateFormat.format(lastRevision.at)}
            </time>
            {lastRevision.note && <span className="text-muted"> · {lastRevision.note}</span>}
          </p>
        ) : (
          <p className="mt-1 text-muted">Sin revisiones registradas.</p>
        )}
        {revisions.length > 1 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-accent">Historial de cambios</summary>
            <ol className="mt-2 space-y-1">
              {revisions.map((r) => (
                <li key={r.at.toISOString()}>
                  <time dateTime={r.at.toISOString()}>{dateFormat.format(r.at)}</time>
                  {r.note && <span className="text-muted"> · {r.note}</span>}
                </li>
              ))}
            </ol>
          </details>
        )}
        <p className="mt-3 text-muted">
          Cada dato fue revisado por una persona antes de publicarse.{" "}
          <Link
            href="/metodologia"
            className="text-accent underline underline-offset-4 hover:decoration-2"
          >
            Cómo investigamos
          </Link>
          . ¿Ves un error?{" "}
          <Link
            href={reportHref}
            prefetch={false}
            className="text-accent underline underline-offset-4 hover:decoration-2"
          >
            Repórtalo
          </Link>
          .
        </p>
      </section>
    </>
  );
}
