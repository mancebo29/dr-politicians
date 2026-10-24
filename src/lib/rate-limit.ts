import { createHmac } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import type { Executor } from "@/db/client";
import { actionRateLimits } from "@/db/schema";
import { env } from "@/lib/env";

// Rate limits for the app's own write paths (PLAN §7.3). Better Auth limits
// its own endpoints (see src/lib/auth.ts). Counters are fixed windows in the
// database so they hold across serverless instances.

export type RateLimitRule = { max: number; windowSeconds: number };

export const RATE_LIMITS = {
  comment: [
    { max: 5, windowSeconds: 60 },
    { max: 60, windowSeconds: 24 * 60 * 60 },
  ],
  report: [{ max: 20, windowSeconds: 60 * 60 }],
  feedback: [{ max: 5, windowSeconds: 60 * 60 }],
} satisfies Record<string, RateLimitRule[]>;

const RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

// Counts one attempt against every rule and returns whether all still allow
// it. Attempts over the limit are counted too, so hammering does not help.
export async function consumeRateLimit(
  db: Executor,
  key: string,
  rules: readonly RateLimitRule[],
  now = new Date(),
): Promise<boolean> {
  let allowed = true;
  for (const rule of rules) {
    const windowMs = rule.windowSeconds * 1000;
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const [row] = await db
      .insert(actionRateLimits)
      .values({ key: `${key}:${rule.windowSeconds}`, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [actionRateLimits.key, actionRateLimits.windowStart],
        set: { count: sql`${actionRateLimits.count} + 1` },
      })
      .returning({ count: actionRateLimits.count });
    if (row.count > rule.max) allowed = false;
  }
  await db
    .delete(actionRateLimits)
    .where(lt(actionRateLimits.windowStart, new Date(now.getTime() - RETENTION_MS)));
  return allowed;
}

// The client address as Vercel forwards it.
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || null;
}

// A keyed hash of the client IP for anonymous rate limits, so the raw address
// is never stored (Ley 172-13 data minimization).
export function clientFingerprint(headers: Headers): string {
  const ip = clientIp(headers) ?? "unknown";
  return createHmac("sha256", env().BETTER_AUTH_SECRET)
    .update(`rate-limit:${ip}`)
    .digest("base64url")
    .slice(0, 22);
}
