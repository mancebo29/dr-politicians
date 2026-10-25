import { describe, expect, it } from "vitest";
import { deployMigrationUrl } from "./migrate";

describe("deployMigrationUrl", () => {
  it("skips preview, development and local builds", () => {
    const url = "postgres://migrator@db/prod";
    expect(deployMigrationUrl({ VERCEL_ENV: "preview", MIGRATION_DATABASE_URL: url })).toBeNull();
    expect(
      deployMigrationUrl({ VERCEL_ENV: "development", MIGRATION_DATABASE_URL: url }),
    ).toBeNull();
    expect(deployMigrationUrl({ MIGRATION_DATABASE_URL: url })).toBeNull();
  });

  it("migrates production through MIGRATION_DATABASE_URL, not DATABASE_URL", () => {
    expect(
      deployMigrationUrl({
        VERCEL_ENV: "production",
        DATABASE_URL: "postgres://app@pooler:6543/prod",
        MIGRATION_DATABASE_URL: "postgres://migrator@pooler:5432/prod",
      }),
    ).toBe("postgres://migrator@pooler:5432/prod");
  });

  it("fails a production build without MIGRATION_DATABASE_URL", () => {
    expect(() =>
      deployMigrationUrl({ VERCEL_ENV: "production", DATABASE_URL: "postgres://app@pooler/prod" }),
    ).toThrow("MIGRATION_DATABASE_URL");
  });
});
