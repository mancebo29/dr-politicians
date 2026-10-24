import type { Metadata } from "next";
import { RichText } from "@/components/public/rich-text";
import { getContentSettings } from "@/lib/public/data";
import { parseRichText } from "@/lib/rich-text";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos personales trata Políticos RD, para qué y cómo ejercer tus derechos.",
  alternates: { canonical: "/privacidad" },
};

// Edited in /admin/configuracion (PLAN §8.3).
export default async function PrivacyPage() {
  const { privacy } = await getContentSettings();
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Política de privacidad</h1>
      <div className="mt-4">
        <RichText blocks={parseRichText(privacy)} />
      </div>
    </article>
  );
}
