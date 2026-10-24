import { afterEach, describe, expect, it, vi } from "vitest";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  RESEND_API_KEY: "",
  NEXT_PHASE: "",
};

// env.ts reads NODE_ENV/NEXT_PHASE at import time, so each case re-imports it.
async function loadEnv(vars: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...base, ...vars })) vi.stubEnv(key, value);
  return (await import("./env")).env;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env", () => {
  it("treats blank provider keys as unset outside production", async () => {
    const env = await loadEnv({ NODE_ENV: "development" });
    expect(env().GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it("requires provider keys when the production server runs", async () => {
    const env = await loadEnv({ NODE_ENV: "production" });
    expect(() => env()).toThrow(/GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, RESEND_API_KEY/);
  });

  it("does not require provider keys during next build", async () => {
    const env = await loadEnv({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" });
    expect(() => env()).not.toThrow();
  });

  it("rejects a short auth secret", async () => {
    const env = await loadEnv({ NODE_ENV: "development", BETTER_AUTH_SECRET: "short" });
    expect(() => env()).toThrow(/BETTER_AUTH_SECRET/);
  });
});
