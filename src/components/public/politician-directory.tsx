import Link from "next/link";
import { Suspense } from "react";
import { formatPartialDate } from "@/lib/partial-date";
import { getFilterOptions, getPoliticianList } from "@/lib/public/data";
import {
  hasActiveFilters,
  type ListFilters,
  listHref,
  parseListFilters,
} from "@/lib/public/filters";
import type { PoliticianListItem } from "@/lib/public/politicians";
import { ListFiltersForm } from "./list-filters";
import { PartyBadge } from "./party-badge";
import { RankChange } from "./rank-change";

type Fixed = { party?: string; province?: string };

// Search, filters, ranked list and pagination for "/" and the party and
// province pages. The query string is request-time data, so everything that
// depends on it streams in behind a fallback the size of the real content.
export function PoliticianDirectory({
  path,
  searchParams,
  fixed = {},
}: {
  path: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  fixed?: Fixed;
}) {
  return (
    <Suspense fallback={<DirectorySkeleton />}>
      <Directory path={path} searchParams={searchParams} fixed={fixed} />
    </Suspense>
  );
}

async function Directory({
  path,
  searchParams,
  fixed,
}: {
  path: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  fixed: Fixed;
}) {
  const parsed = parseListFilters(await searchParams);
  const filters: ListFilters = {
    ...parsed,
    party: fixed.party ?? parsed.party,
    province: fixed.province ?? parsed.province,
  };
  const fixedKeys = {
    party: fixed.party ? true : undefined,
    province: fixed.province ? true : undefined,
  } as const;
  const [options, list] = await Promise.all([getFilterOptions(), getPoliticianList(filters)]);
  const href = (changes: Partial<ListFilters>) =>
    listHref(path, { ...filters, ...changes }, fixedKeys);
  // Filters the visitor chose, not the ones implied by the page itself.
  const filtered = hasActiveFilters({
    ...filters,
    party: fixed.party ? null : filters.party,
    province: fixed.province ? null : filters.province,
  });

  return (
    <div>
      <ListFiltersForm
        key={href({})}
        path={path}
        filters={filters}
        options={options}
        fixed={fixedKeys}
        filtered={filtered}
      />

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <p role="status" className="text-sm text-muted">
          {list.total === 1 ? "1 político" : `${list.total} políticos`}
          {filters.q && ` para «${filters.q}»`}
        </p>
        {filters.sort === "rank" && (
          <p className="text-sm text-muted">
            <Link
              href="/metodologia#ranking"
              className="text-accent underline underline-offset-4 hover:decoration-2"
            >
              Relevancia en noticias, actualizado semanalmente
            </Link>
            {list.rankingWeek
              ? ` · semana del ${formatPartialDate(list.rankingWeek)}`
              : " · aún sin datos; orden alfabético"}
          </p>
        )}
      </div>

      {list.items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center">
          <p className="font-medium">
            {filtered
              ? "No encontramos políticos con esos criterios."
              : "Aún no hay perfiles publicados aquí."}
          </p>
          {filtered && (
            <Link
              href={listHref(path, {}, fixedKeys)}
              className="mt-2 inline-block text-sm text-accent underline underline-offset-4 hover:decoration-2"
            >
              Ver todos
            </Link>
          )}
        </div>
      ) : (
        <ol
          className="mt-4 divide-y divide-border border-y border-border"
          data-testid="politician-list"
        >
          {list.items.map((item) => (
            <PoliticianRow
              key={item.slug}
              item={item}
              showRank={filters.sort === "rank" && list.rankingWeek !== null}
            />
          ))}
        </ol>
      )}

      {list.pageCount > 1 && (
        <nav
          aria-label="Paginación"
          className="mt-6 flex items-center justify-between gap-4 text-sm"
        >
          {list.page > 1 ? (
            <Link href={href({ page: list.page - 1 })} rel="prev" className={pageLinkClass}>
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Página {list.page} de {list.pageCount}
          </span>
          {list.page < list.pageCount ? (
            <Link href={href({ page: list.page + 1 })} rel="next" className={pageLinkClass}>
              Siguiente →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

const pageLinkClass =
  "rounded-md border border-border px-3 py-1.5 font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function PoliticianRow({ item, showRank }: { item: PoliticianListItem; showRank: boolean }) {
  return (
    <li className="flex items-center gap-3 py-3 sm:gap-4">
      {showRank && (
        <div className="flex w-10 shrink-0 flex-col items-center text-center">
          {item.rank !== null ? (
            <>
              <span className="text-lg font-semibold tabular-nums">
                <span className="sr-only">Puesto </span>
                {item.rank}
              </span>
              <RankChange delta={item.rankDelta} />
            </>
          ) : (
            <span className="text-muted" aria-label="Sin puesto esta semana">
              —
            </span>
          )}
        </div>
      )}
      {item.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote, license-tracked photos from varied hosts
        <img
          src={item.photoUrl}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          className="size-12 shrink-0 rounded-full border border-border object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-semibold text-muted"
        >
          {initials(item.name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/politicos/${item.slug}`}
            className="font-semibold break-words underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {item.name}
          </Link>
          {item.party && <PartyBadge party={item.party} />}
          {item.deceased && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
              Fallecido
            </span>
          )}
        </p>
        <p className="mt-0.5 text-sm break-words text-muted">
          {item.role
            ? [
                item.role.isCurrent ? item.role.title : `Antes: ${item.role.title}`,
                item.role.province,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Sin cargos registrados"}
        </p>
      </div>
    </li>
  );
}

function DirectorySkeleton() {
  return (
    <div aria-hidden>
      <div className="h-[13.5rem] rounded-lg border border-border bg-surface sm:h-40 lg:h-[10.5rem]" />
      <div className="mt-6 h-5 w-40 rounded bg-surface" />
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex items-center gap-4 py-3">
            <span className="size-12 rounded-full bg-surface" />
            <span className="h-4 w-48 rounded bg-surface" />
          </li>
        ))}
      </ul>
    </div>
  );
}
