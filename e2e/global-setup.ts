import { rm } from "node:fs/promises";
import postgres from "postgres";
import { runMigrations } from "@/db/migrate";
import { seedReferenceData } from "@/db/seed/reference";
import { e2eDatabaseUrl, e2eDb, MAIL_OUTBOX_DIR } from "./support";

export default async function globalSetup() {
  const url = e2eDatabaseUrl();
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await client.unsafe(
      "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
    );
  } finally {
    await client.end();
  }
  await runMigrations(url);
  const db = e2eDb();
  try {
    await seedReferenceData(db);
  } finally {
    await db.$client.end();
  }
  await rm(MAIL_OUTBOX_DIR, { recursive: true, force: true });
}
