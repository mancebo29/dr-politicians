import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("strips Spanish accents and ñ diacritics", () => {
    expect(slugify("Monseñor Nouel")).toBe("monsenor-nouel");
    expect(slugify("San José de Ocoa")).toBe("san-jose-de-ocoa");
  });

  it("collapses punctuation and whitespace into single hyphens", () => {
    expect(slugify("  Santo Domingo   Este (SDE) ")).toBe("santo-domingo-este-sde");
  });
});
