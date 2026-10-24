import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { createDb, type Database } from "@/db/client";

config({ path: ".env.local", quiet: true });

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  // Guard against pointing the destructive test setup at a real database.
  if (!new URL(url).pathname.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL must name a database ending in _test");
  }
  return url;
}

export function createTestDb(): Database {
  return createDb(testDatabaseUrl(), { max: 2 });
}

export async function truncateAll(db: Database) {
  const rows = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.execute(sql.raw(`truncate ${tables} restart identity cascade`));
}
