import { describe, expect, it } from "vitest";
import {
  defaultNewsQuery,
  matchesQuery,
  normalizeText,
  parseQuery,
  QuerySyntaxError,
} from "./query";

describe("news query language", () => {
  it("matches phrases on whole words without case or accents", () => {
    const query = parseQuery('"Jose Peña"');
    expect(matchesQuery(query, normalizeText("José Peña habló en el Senado"))).toBe(true);
    expect(matchesQuery(parseQuery("Ana"), normalizeText("Anabel Acosta"))).toBe(false);
  });

  it("supports AND, OR, grouping and exclusions", () => {
    const query = parseQuery('"Manuel Jiménez" (alcalde OR "Santo Domingo Este") -cantante');
    expect(
      matchesQuery(query, normalizeText("El alcalde Manuel Jiménez visitó Santo Domingo Este")),
    ).toBe(true);
    expect(
      matchesQuery(query, normalizeText("El cantante Manuel Jiménez ofreció un concierto")),
    ).toBe(false);
  });

  it("rejects incomplete and exclusion-only expressions", () => {
    for (const value of ["", "-ruido", "nombre OR", "(nombre", "nombre -"]) {
      expect(() => parseQuery(value)).toThrow(QuerySyntaxError);
    }
  });

  it("builds a safe fallback from multi-word names", () => {
    expect(
      defaultNewsQuery({ fullName: "José Ramón Peña", knownAs: "José Peña", aliases: ["Joselo"] }),
    ).toBe('"José Peña" OR "José Ramón Peña"');
  });
});
