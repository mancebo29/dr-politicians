import Link from "next/link";
import type { PartyRef } from "@/lib/public/politicians";

export function PartyBadge({ party, link = true }: { party: PartyRef; link?: boolean }) {
  const content = (
    <>
      {party.color && (
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ backgroundColor: party.color }}
        />
      )}
      <abbr title={party.name} className="no-underline">
        {party.acronym}
      </abbr>
    </>
  );
  const className =
    "inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium whitespace-nowrap";
  return link ? (
    <Link
      href={`/partidos/${party.slug}`}
      className={`${className} hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
    >
      {content}
    </Link>
  ) : (
    <span className={className}>{content}</span>
  );
}
