import { notFound } from "next/navigation";
import { getPrerenderSlugs, getPublicProfile } from "@/lib/public/data";
import { ogCard, ogSize } from "@/lib/public/og";

export const alt = "Perfil con fuentes en Políticos RD";
export const size = ogSize;
export const contentType = "image/png";

export async function generateStaticParams() {
  const slugs = await getPrerenderSlugs();
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "sin-perfiles" }];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) notFound();
  const { politician, positions } = profile.payload;
  const current = positions.find((p) => p.isCurrent);
  return ogCard({
    eyebrow: profile.party ? `${profile.party.name} (${profile.party.acronym})` : "Perfil",
    title: politician.knownAs ?? politician.fullName,
    lines: current
      ? [[current.title, current.municipality ?? current.province].filter(Boolean).join(", ")]
      : [],
  });
}
