import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeRedirectPath("/admin?tab=1")).toBe("/admin?tab=1");
  });

  it("falls back for missing, absolute or protocol-relative destinations", () => {
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
  });

  it("uses the first value when the param repeats", () => {
    expect(safeRedirectPath(["/a", "/b"])).toBe("/a");
  });
});
