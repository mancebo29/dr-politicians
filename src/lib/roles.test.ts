import { describe, expect, it } from "vitest";
import { hasRole, STAFF_ROLES } from "./roles";

describe("hasRole", () => {
  it("allows listed roles", () => {
    expect(hasRole({ role: "admin" }, ["admin"])).toBe(true);
    expect(hasRole({ role: "moderator" }, STAFF_ROLES)).toBe(true);
  });

  it("rejects other roles, missing users and unknown roles", () => {
    expect(hasRole({ role: "user" }, STAFF_ROLES)).toBe(false);
    expect(hasRole({ role: "moderator" }, ["admin"])).toBe(false);
    expect(hasRole({ role: "superuser" }, ["admin"])).toBe(false);
    expect(hasRole(null, ["admin"])).toBe(false);
  });

  it("rejects banned users even with an allowed role", () => {
    expect(hasRole({ role: "admin", banned: true }, ["admin"])).toBe(false);
  });
});
