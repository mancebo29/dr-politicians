"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";
import { roleGroupLabel } from "@/lib/labels";
import {
  defaultFilters,
  type ListFilters,
  listHref,
  type ListSort,
  type RoleGroup,
  roleGroups,
} from "@/lib/public/filters";
import type { FilterOptions } from "@/lib/public/politicians";

type Fixed = Partial<Record<"party" | "province", true>>;

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

// A plain GET form, so it works without JavaScript; with JavaScript it drops
// empty fields from the URL and navigates client-side.
export function ListFiltersForm({
  path,
  filters,
  options,
  fixed = {},
  filtered,
}: {
  path: string;
  filters: ListFilters;
  // Whether the visitor narrowed the list (shows "Quitar filtros").
  filtered: boolean;
  options: FilterOptions;
  fixed?: Fixed;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => {
      const v = data.get(key);
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };
    const href = listHref(
      path,
      {
        q: value("q") ?? "",
        party: fixed.party ? null : value("partido"),
        role: value("cargo") as RoleGroup | null,
        province: fixed.province ? null : value("provincia"),
        sort: (value("orden") as ListSort | null) ?? "rank",
        page: 1,
      },
      fixed,
    );
    startTransition(() => router.push(href, { scroll: false }));
  }

  // Keep a value from a shared link selectable even if no profile uses it now.
  const parties = options.parties.some((p) => p.slug === filters.party)
    ? options.parties
    : filters.party
      ? [...options.parties, { slug: filters.party, acronym: filters.party, name: filters.party }]
      : options.parties;
  const provinces =
    filters.province && !options.provinces.some((p) => p.slug === filters.province)
      ? [...options.provinces, { slug: filters.province, name: filters.province }]
      : options.provinces;

  const activeCount = [
    !fixed.party && filters.party,
    filters.role,
    !fixed.province && filters.province,
  ].filter(Boolean).length;

  return (
    <form
      role="search"
      aria-label="Buscar y filtrar políticos"
      action={path}
      method="get"
      onSubmit={onSubmit}
      className="rounded-xl border border-border bg-surface p-4"
    >
      <label htmlFor="filtro-q" className="mb-1 block text-sm font-medium">
        Buscar por nombre
      </label>
      <input
        id="filtro-q"
        name="q"
        type="search"
        defaultValue={filters.q}
        placeholder="Ej.: José Peña"
        autoComplete="off"
        maxLength={100}
        className={fieldClass}
      />
      {/* A CSS-only disclosure so the filters stay reachable without
          JavaScript; it only applies below the sm breakpoint. The checkbox
          has no name, so it is never submitted. */}
      <div className="mt-3">
        <input
          id="filtros-mostrar"
          type="checkbox"
          defaultChecked={activeCount > 0 || filters.sort !== defaultFilters.sort}
          className="peer sr-only sm:hidden"
        />
        <label
          htmlFor="filtros-mostrar"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent sm:hidden peer-checked:[&>svg]:rotate-180"
        >
          Filtros y orden
          {activeCount > 0 && (
            <span className="rounded-full bg-accent px-1.5 text-xs leading-5 text-accent-foreground">
              {activeCount}
              <span className="sr-only">{activeCount === 1 ? " activo" : " activos"}</span>
            </span>
          )}
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="size-4 transition-transform motion-reduce:transition-none"
          >
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </label>
        <div className="mt-3 hidden gap-3 peer-checked:grid sm:mt-0 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {!fixed.party && (
            <Select id="filtro-partido" name="partido" label="Partido" value={filters.party}>
              <option value="">Todos los partidos</option>
              {parties.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.acronym === p.name ? p.name : `${p.acronym} · ${p.name}`}
                </option>
              ))}
            </Select>
          )}
          <Select id="filtro-cargo" name="cargo" label="Cargo actual" value={filters.role}>
            <option value="">Todos los cargos</option>
            {roleGroups.map((g) => (
              <option key={g} value={g}>
                {roleGroupLabel[g]}
              </option>
            ))}
          </Select>
          {!fixed.province && (
            <Select
              id="filtro-provincia"
              name="provincia"
              label="Provincia"
              value={filters.province}
            >
              <option value="">Todas las provincias</option>
              {provinces.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <Select id="filtro-orden" name="orden" label="Ordenar por" value={filters.sort}>
            <option value="rank">Relevancia en noticias</option>
            <option value="name">Nombre (A–Z)</option>
          </Select>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {pending ? "Buscando…" : "Buscar"}
        </button>
        {filtered && (
          <Link
            href={listHref(path, { sort: filters.sort }, fixed)}
            scroll={false}
            className="text-sm text-accent underline underline-offset-4 hover:decoration-2"
          >
            Quitar filtros
          </Link>
        )}
      </div>
    </form>
  );
}

function Select({
  id,
  name,
  label,
  value,
  children,
}: {
  id: string;
  name: string;
  label: string;
  value: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <select id={id} name={name} defaultValue={value ?? ""} className={fieldClass}>
        {children}
      </select>
    </div>
  );
}
