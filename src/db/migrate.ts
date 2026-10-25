import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export const migrationsFolder = path.join(process.cwd(), "src/db/migrations");

// The database a deploy build migrates, or null to skip. Only production
// migrates: previews build unmerged branches and must not change its schema.
// MIGRATION_DATABASE_URL is a session-mode or direct connection; the app's
// DATABASE_URL goes through Supabase's transaction pooler, which is not meant
// for schema changes.
export function deployMigrationUrl(env: Record<string, string | undefined>): string | null {
  if (env.VERCEL_ENV !== "production") return null;
  if (!env.MIGRATION_DATABASE_URL) {
    throw new Error("MIGRATION_DATABASE_URL must be set for production builds");
  }
  return env.MIGRATION_DATABASE_URL;
}

export async function runMigrations(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle({ client }), { migrationsFolder });
  } finally {
    await client.end();
  }
}
