import { env } from "@/lib/env";
import { createDb, type Database } from "./client";

export type { Database } from "./client";

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { db?: Database };

export const db: Database = globalForDb.db ?? createDb(env().DATABASE_URL);

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
