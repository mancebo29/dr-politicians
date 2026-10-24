import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cron-auth";

describe("cron authorization", () => {
  it("accepts only the configured bearer secret", () => {
    const request = (authorization?: string) =>
      new Request("https://example.com/api/cron/popularity", {
        headers: authorization ? { authorization } : {},
      });
    expect(isCronAuthorized(request("Bearer correct"), "correct")).toBe(true);
    expect(isCronAuthorized(request("Bearer wrong"), "correct")).toBe(false);
    expect(isCronAuthorized(request(), "correct")).toBe(false);
    expect(isCronAuthorized(request("Bearer correct"), undefined)).toBe(false);
  });
});
