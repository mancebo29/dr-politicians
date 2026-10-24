import postgres from "postgres";
import { runMigrations } from "@/db/migrate";
import { testDatabaseUrl } from "./db";

// Rebuild the test database from migrations once per run so tests always see
// exactly what production migrations produce.
export default async function setup() {
  const url = testDatabaseUrl();
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await client.unsafe(
      "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
    );
  } finally {
    await client.end();
  }
  await runMigrations(url);
}
