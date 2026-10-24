import type { Metadata } from "next";
import { RichText } from "@/components/public/rich-text";
import { getContentSettings } from "@/lib/public/data";
import { parseRichText } from "@/lib/rich-text";

export const metadata: Metadata = {
  title: "Metodología",
  description:
    "Cómo se investigan, revisan y corrigen los perfiles de Políticos RD, qué fuentes se aceptan y qué mide la relevancia en noticias.",
  alternates: { canonical: "/metodologia" },
};

// The text is edited in /admin/configuracion (PLAN §8.3); its section
// headings carry the anchors other pages link to, e.g. #ranking.
export default async function MethodologyPage() {
  const blocks = parseRichText((await getContentSettings()).methodology);
  // An opening paragraph is shown as the page's lead.
  const lead = blocks[0]?.kind === "paragraph" ? blocks[0] : null;
  const rest = lead ? blocks.slice(1) : blocks;
  const sections = rest.flatMap((b) => (b.kind === "heading" && b.level === 2 ? [b] : []));

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Metodología</h1>
      {lead && (
        <div className="mt-3 text-lg text-muted">
          <RichText blocks={[lead]} />
        </div>
      )}

      {sections.length > 1 && (
        <nav
          aria-label="En esta página"
          className="mt-6 rounded-lg border border-border p-4 text-sm"
        >
          <p className="font-medium">En esta página</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-accent underline underline-offset-4 hover:decoration-2"
                >
                  {s.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-3">
        <RichText blocks={rest} />
      </div>
    </article>
  );
}
