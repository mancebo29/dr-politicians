import type { ReactNode } from "react";
import {
  allianceKindLabel,
  involvementLabel,
  legalStatusLabel,
  legislationKindLabel,
  legislationStatusLabel,
  membershipRoleLabel,
  positionOriginLabel,
  sourceTierLabel,
  statementKindLabel,
} from "@/lib/labels";
import { formatPartialDate } from "@/lib/partial-date";
import type { ResearchPayload } from "@/lib/research/schema";

type Cite = (ids: string[]) => ReactNode;

export function periodLabel(start?: string | null, end?: string | null, isCurrent?: boolean) {
  const from = formatPartialDate(start) || "¿?";
  const to = isCurrent ? "actualidad" : formatPartialDate(end);
  return to ? `${from} – ${to}` : from;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="border-b border-border pb-2 text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="text-sm text-muted">Sin información publicada.</p>;
}

// Renders a profile in the research-payload shape with numbered source
// footnotes. Footnote numbers follow the order of `payload.sources`.
export function ProfileView({
  payload,
  idPrefix = "",
  archiveUrls = {},
  headerAside,
}: {
  payload: ResearchPayload;
  idPrefix?: string;
  // Archived copy of a source, keyed by source URL.
  archiveUrls?: Record<string, string>;
  // Extra header content, e.g. party and current role on the public page.
  headerAside?: ReactNode;
}) {
  const numbers = new Map(payload.sources.map((s, i) => [s.id, i + 1]));
  const cite: Cite = (ids) => (
    <sup className="ml-0.5 space-x-0.5 text-xs">
      {ids.map((id) => (
        <a
          key={id}
          href={`#${idPrefix}fuente-${numbers.get(id)}`}
          className="text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="sr-only">fuente </span>[{numbers.get(id)}]
        </a>
      ))}
    </sup>
  );
  const p = payload.politician;

  return (
    <article>
      <header className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        {payload.photo && (
          // eslint-disable-next-line @next/next/no-img-element -- license-tracked photos come from varied remote hosts (e.g. Wikimedia), so next/image remotePatterns would have to allow any host
          <img
            src={payload.photo.url}
            alt={p.fullName}
            width={112}
            height={128}
            className="h-32 w-28 shrink-0 rounded-md border border-border object-cover"
          />
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
            {p.knownAs ?? p.fullName}
          </h1>
          {p.knownAs && <p className="mt-1 text-muted">{p.fullName}</p>}
          <p className="mt-2 text-sm text-muted">
            {[
              p.birthDate && `Nacimiento: ${formatPartialDate(p.birthDate)}`,
              p.birthPlace,
              p.deathDate && `Fallecimiento: ${formatPartialDate(p.deathDate)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {headerAside}
        </div>
      </header>

      <Section title="Resumen">
        <p className="leading-relaxed whitespace-pre-line">
          {p.summary}
          {cite(p.summarySourceIds)}
        </p>
      </Section>

      <Section title="Trayectoria">
        {payload.positions.length ? (
          <ol className="space-y-3">
            {payload.positions.map((c, i) => (
              <li key={i}>
                <p className="font-medium">
                  {c.title}
                  {cite(c.sourceIds)}
                </p>
                <p className="text-sm text-muted">
                  {[c.institution, c.municipality, c.province].filter(Boolean).join(" · ")} ·{" "}
                  {periodLabel(c.start, c.end, c.isCurrent)}
                  {c.howObtained && ` · ${positionOriginLabel[c.howObtained]}`}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <Empty />
        )}
      </Section>

      <Section title="Partidos y alianzas">
        {payload.partyMemberships.length || payload.alliances.length ? (
          <ul className="space-y-3">
            {payload.partyMemberships.map((c, i) => (
              <li key={`m${i}`}>
                <p className="font-medium">
                  {c.party.name} ({c.party.acronym}) · {membershipRoleLabel[c.role]}
                  {cite(c.sourceIds)}
                </p>
                <p className="text-sm text-muted">
                  {periodLabel(c.start, c.end, !c.end)}
                  {c.exitReason && ` · ${c.exitReason}`}
                </p>
              </li>
            ))}
            {payload.alliances.map((c, i) => (
              <li key={`a${i}`}>
                <p className="font-medium">
                  {allianceKindLabel[c.kind]}: {c.counterparty}
                  {cite(c.sourceIds)}
                </p>
                <p className="text-sm text-muted">{c.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </Section>

      <Section title="Leyes e iniciativas">
        {payload.legislation.length ? (
          <ul className="space-y-3">
            {payload.legislation.map((c, i) => (
              <li key={i}>
                <p className="font-medium">
                  {legislationKindLabel[c.kind]} {c.number && `${c.number}: `}
                  {c.title}
                  {cite(c.sourceIds)}
                </p>
                <p className="text-sm text-muted">
                  {involvementLabel[c.involvement]} · {legislationStatusLabel[c.status]}
                  {c.promulgatedOn && ` · ${formatPartialDate(c.promulgatedOn)}`}
                  {c.notes && ` · ${c.notes}`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </Section>

      <Section title="Declaraciones e influencias">
        {payload.statements.length ? (
          <ul className="space-y-4">
            {payload.statements.map((c, i) => (
              <li key={i}>
                <p className="text-sm text-muted">
                  {statementKindLabel[c.kind]} · {c.topic}
                  {c.saidOn && ` · ${formatPartialDate(c.saidOn)}`}
                </p>
                {c.quote && (
                  <blockquote className="mt-1 border-l-2 border-border pl-3 italic">
                    “{c.quote}”
                  </blockquote>
                )}
                <p className="mt-1">
                  {c.context}
                  {cite(c.sourceIds)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </Section>

      <Section title="Controversias">
        {payload.controversies.length ? (
          <ul className="space-y-5">
            {payload.controversies.map((c, i) => (
              <li key={i}>
                <p className="font-medium">
                  {c.title}
                  {cite(c.sourceIds)}
                </p>
                <p className="text-sm text-muted">
                  {legalStatusLabel[c.legalStatus]}
                  {c.startedOn && ` · desde ${formatPartialDate(c.startedOn)}`}
                </p>
                <p className="mt-1">{c.summary}</p>
                {c.politicianResponse && (
                  <p className="mt-1 text-sm text-muted">Respuesta: {c.politicianResponse}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </Section>

      <Section title="Fuentes">
        <ol className="space-y-2 text-sm">
          {payload.sources.map((s, i) => (
            <li
              key={s.id}
              id={`${idPrefix}fuente-${i + 1}`}
              className="scroll-mt-20 break-words target:rounded target:bg-surface"
            >
              <span className="mr-1 text-muted tabular-nums">[{i + 1}]</span>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-accent underline underline-offset-2 hover:decoration-2"
              >
                {s.title}
              </a>
              <span className="text-muted">
                {" "}
                · {s.publisher}
                {s.publishedOn && ` · ${formatPartialDate(s.publishedOn)}`} ·{" "}
                {sourceTierLabel[s.tier]} · consultado {formatPartialDate(s.accessedOn)}
              </span>
              {archiveUrls[s.url] && (
                <>
                  {" · "}
                  <a
                    href={archiveUrls[s.url]}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-accent underline underline-offset-2 hover:decoration-2"
                  >
                    copia archivada<span className="sr-only"> de {s.title}</span>
                  </a>
                </>
              )}
              {s.excerpt && <p className="mt-0.5 text-muted italic">“{s.excerpt}”</p>}
            </li>
          ))}
        </ol>
      </Section>
    </article>
  );
}
