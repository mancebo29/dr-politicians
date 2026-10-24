import { describe, expect, it } from "vitest";
import { defaultFilters, listHref, parseListFilters } from "./filters";

describe("parseListFilters", () => {
  it("reads the Spanish query keys and normalizes values", () => {
    expect(
      parseListFilters({
        q: "  José   Peña ",
        partido: "prm",
        cargo: "senado",
        provincia: "la-vega",
        orden: "name",
        pagina: "3",
      }),
    ).toEqual({
      q: "José Peña",
      party: "prm",
      role: "senado",
      province: "la-vega",
      sort: "name",
      page: 3,
    });
  });

  it("falls back to defaults for missing or invalid values", () => {
    expect(parseListFilters({})).toEqual(defaultFilters);
    expect(
      parseListFilters({
        partido: "PRM; drop",
        cargo: "rey",
        orden: "random",
        pagina: "-2",
        provincia: ["santiago", "azua"],
      }),
    ).toEqual({ ...defaultFilters, province: "santiago" });
    expect(parseListFilters({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
});

describe("listHref", () => {
  it("omits defaults and keeps a stable order", () => {
    expect(listHref("/", {})).toBe("/");
    expect(listHref("/", { page: 2, q: "jose", sort: "name", role: "senado" })).toBe(
      "/?q=jose&cargo=senado&orden=name&pagina=2",
    );
  });

  it("does not repeat filters fixed by the path", () => {
    expect(listHref("/partidos/prm", { party: "prm", page: 2 }, { party: true })).toBe(
      "/partidos/prm?pagina=2",
    );
  });

  it("round-trips through parseListFilters", () => {
    const filters = { ...defaultFilters, q: "maría", party: "fp", province: "santiago", page: 4 };
    const query = Object.fromEntries(new URLSearchParams(listHref("/", filters).split("?")[1]));
    expect(parseListFilters(query)).toEqual(filters);
  });
});
