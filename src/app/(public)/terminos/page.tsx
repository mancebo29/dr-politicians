import type { Metadata } from "next";
import { RichText } from "@/components/public/rich-text";
import { getContentSettings } from "@/lib/public/data";
import { parseRichText } from "@/lib/rich-text";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Condiciones de uso de Políticos RD y normas de los comentarios.",
  alternates: { canonical: "/terminos" },
};

// Edited in /admin/configuracion (PLAN §8.3).
export default async function TermsPage() {
  const { terms } = await getContentSettings();
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Términos de uso</h1>
      <div className="mt-4">
        <RichText blocks={parseRichText(terms)} />
      </div>
    </article>
  );
}
