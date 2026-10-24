import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { type ProfileSection, profileSections } from "@/lib/community/profile-sections";
import { getPublicProfile } from "@/lib/public/data";

export const metadata: Metadata = {
  title: "Reportar un error",
  description:
    "Envía una corrección, ejerce tu derecho de réplica o cuéntanos un problema o una sugerencia sobre Políticos RD.",
  alternates: { canonical: "/feedback" },
};

const SLUG = /^[a-z0-9-]{1,200}$/;

export default function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reportar un error</h1>
      <p className="mt-3 text-muted">
        Envía una corrección de un perfil, ejerce el derecho de réplica o cuéntanos un problema o
        una sugerencia. Una persona del equipo revisa cada mensaje; si propones una corrección,
        adjuntar una fuente ayuda mucho.
      </p>
      <div className="mt-6">
        <Suspense fallback={<div aria-hidden className="h-96 rounded-lg bg-surface" />}>
          <FeedbackTarget searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

// Reads ?politico= and ?seccion= (set by the links on each profile) at
// request time, behind the page's static shell.
async function FeedbackTarget({ searchParams }: Pick<PageProps<"/feedback">, "searchParams">) {
  const params = await searchParams;
  const slug =
    typeof params.politico === "string" && SLUG.test(params.politico) ? params.politico : null;
  const profile = slug ? await getPublicProfile(slug) : null;
  const section =
    typeof params.seccion === "string" && Object.hasOwn(profileSections, params.seccion)
      ? (params.seccion as ProfileSection)
      : null;
  const p = profile?.payload.politician;
  return (
    <FeedbackForm
      politician={slug && p ? { slug, name: p.knownAs ?? p.fullName } : null}
      section={section}
    />
  );
}
