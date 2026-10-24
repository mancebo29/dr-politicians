import { describe, expect, it } from "vitest";
import { containsBlockedTerm, editDeadline, isBanned, participation } from "./comments";

const now = new Date("2026-10-24T12:00:00Z");
const author = {
  id: "u1",
  emailVerified: true,
  username: "ana",
  banned: false,
  banExpires: null,
};

describe("participation", () => {
  it("requires a verified, unbanned account with a username", () => {
    expect(participation(null, now)).toBe("signed_out");
    expect(participation(author, now)).toBe("ok");
    expect(participation({ ...author, emailVerified: false }, now)).toBe("unverified");
    expect(participation({ ...author, username: null }, now)).toBe("no_username");
    expect(participation({ ...author, banned: true }, now)).toBe("banned");
  });

  it("treats an expired ban as lifted", () => {
    const expired = { banned: true, banExpires: new Date("2026-10-23T00:00:00Z") };
    expect(isBanned(expired, now)).toBe(false);
    expect(isBanned({ ...expired, banExpires: new Date("2026-10-25T00:00:00Z") }, now)).toBe(true);
    expect(isBanned({ banned: true, banExpires: null }, now)).toBe(true);
  });
});

describe("containsBlockedTerm", () => {
  it("matches whole words and phrases, ignoring accents and case", () => {
    expect(containsBlockedTerm("Eso es una ESTAFÁ total", ["estafa"])).toBe(true);
    expect(containsBlockedTerm("No hay estafadores aquí", ["estafa"])).toBe(false);
    expect(containsBlockedTerm("Dijo: ¡vete al diablo!", ["al diablo"])).toBe(true);
    expect(containsBlockedTerm("Texto limpio", [" ", ""])).toBe(false);
  });
});

describe("editDeadline", () => {
  it("adds the edit window to the creation time", () => {
    expect(editDeadline(now, { editWindowMinutes: 15 }).toISOString()).toBe(
      "2026-10-24T12:15:00.000Z",
    );
  });
});
