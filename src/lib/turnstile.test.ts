import { afterEach, describe, expect, it, vi } from "vitest";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PHASE: "",
};

async function load(vars: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...base, ...vars })) vi.stubEnv(key, value);
  return (await import("./turnstile")).verifyTurnstile;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const answer = (body: unknown) =>
  vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status: 200 }));

describe("verifyTurnstile", () => {
  it("skips the check in development without a secret", async () => {
    const verify = await load({ NODE_ENV: "development", TURNSTILE_SECRET_KEY: "" });
    const fetchImpl = answer({ success: false });
    expect(await verify(null, null, fetchImpl)).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed in production without a secret", async () => {
    const verify = await load({
      NODE_ENV: "production",
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      RESEND_API_KEY: "re",
      CRON_SECRET: "cron",
      TURNSTILE_SECRET_KEY: "",
    });
    await expect(verify("token", null)).rejects.toThrow(/TURNSTILE_SECRET_KEY/);
  });

  it("asks Cloudflare and reports its verdict", async () => {
    const verify = await load({ NODE_ENV: "development", TURNSTILE_SECRET_KEY: "s3cret" });
    expect(await verify(null, null, answer({ success: true }))).toBe(false);

    const accepted = answer({ success: true });
    expect(await verify("token", "203.0.113.5", accepted)).toBe(true);
    expect(JSON.parse(String(accepted.mock.calls[0][1]?.body))).toEqual({
      secret: "s3cret",
      response: "token",
      remoteip: "203.0.113.5",
    });
    expect(await verify("token", null, answer({ success: false }))).toBe(false);
  });
});
