import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
// Accepted by helpers that work both standalone and inside a caller's transaction.
export type Executor = Database | Transaction;

export function createDb(url: string, options: { max?: number } = {}) {
  // DATABASE_URL goes through Supabase's transaction pooler, which hands each
  // transaction to an arbitrary backend, so named prepared statements cannot be
  // reused. With them enabled, writes intermittently returned success but were
  // never committed.
  const client = postgres(url, { max: options.max ?? 10, prepare: false, onnotice: () => {} });
  return drizzle({ client, schema, casing: "snake_case" });
}
