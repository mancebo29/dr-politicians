// Public list state lives in the URL query string so results are shareable
// (PLAN §7.2). This module parses and builds those URLs; it has no I/O.

export const roleGroups = [
  "ejecutivo",
  "senado",
  "camara",
  "alcaldia",
  "parlacen",
  "partido",
  "exfuncionario",
] as const;
export type RoleGroup = (typeof roleGroups)[number];

export const listSorts = ["rank", "name"] as const;
export type ListSort = (typeof listSorts)[number];

export type ListFilters = {
  q: string;
  party: string | null;
  role: RoleGroup | null;
  province: string | null;
  sort: ListSort;
  page: number;
};

export const defaultFilters: ListFilters = {
  q: "",
  party: null,
  role: null,
  province: null,
  sort: "rank",
  page: 1,
};

type RawParams = Record<string, string | string[] | undefined>;

const MAX_QUERY_LENGTH = 100;
const SLUG = /^[a-z0-9-]{1,80}$/;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function oneOf<T extends string>(values: readonly T[], value: string): T | null {
  return (values as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseListFilters(params: RawParams): ListFilters {
  const page = Number.parseInt(first(params.pagina), 10);
  const party = first(params.partido);
  const province = first(params.provincia);
  return {
    q: first(params.q).replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH),
    party: SLUG.test(party) ? party : null,
    role: oneOf(roleGroups, first(params.cargo)),
    province: SLUG.test(province) ? province : null,
    sort: oneOf(listSorts, first(params.orden)) ?? "rank",
    page: Number.isSafeInteger(page) && page > 1 ? page : 1,
  };
}

// Builds `path?…` with only non-default values, in a stable order. Keys `fixed`
// are part of the path (e.g. the party on /partidos/[slug]) and never repeated.
export function listHref(
  path: string,
  filters: Partial<ListFilters>,
  fixed: Partial<Record<"party" | "province", true>> = {},
): string {
  const f = { ...defaultFilters, ...filters };
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.party && !fixed.party) params.set("partido", f.party);
  if (f.role) params.set("cargo", f.role);
  if (f.province && !fixed.province) params.set("provincia", f.province);
  if (f.sort !== "rank") params.set("orden", f.sort);
  if (f.page > 1) params.set("pagina", String(f.page));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function hasActiveFilters(filters: ListFilters): boolean {
  return Boolean(filters.q || filters.party || filters.role || filters.province);
}
