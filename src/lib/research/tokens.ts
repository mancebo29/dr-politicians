import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Database } from "@/db/client";
import { researchTokens } from "@/db/schema";

const PREFIX = "rt_";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Only the hash is stored; the plaintext is shown once at creation.
export async function createResearchToken(
  db: Database,
  input: { name: string; createdByUserId?: string | null; expiresAt?: Date | null },
) {
  const token = PREFIX + randomBytes(32).toString("base64url");
  const [row] = await db
    .insert(researchTokens)
    .values({
      name: input.name,
      tokenHash: hashToken(token),
      createdByUserId: input.createdByUserId ?? null,
      expiresAt: input.expiresAt ?? null,
    })
    .returning({ id: researchTokens.id, name: researchTokens.name });
  return { ...row, token };
}

export async function verifyResearchToken(db: Database, token: string | null, now = new Date()) {
  if (!token?.startsWith(PREFIX)) return null;
  const [row] = await db
    .update(researchTokens)
    .set({ lastUsedAt: now })
    .where(
      and(
        eq(researchTokens.tokenHash, hashToken(token)),
        isNull(researchTokens.revokedAt),
        or(isNull(researchTokens.expiresAt), gt(researchTokens.expiresAt, now)),
      ),
    )
    .returning({ id: researchTokens.id, name: researchTokens.name });
  return row ?? null;
}

export async function revokeResearchToken(db: Database, id: string, now = new Date()) {
  await db
    .update(researchTokens)
    .set({ revokedAt: now })
    .where(and(eq(researchTokens.id, id), isNull(researchTokens.revokedAt)));
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}
