import "server-only";
import { db } from "@/db";
import { QueueError } from "./queue";
import { bearerToken, verifyResearchToken } from "./tokens";

type Handler = (ctx: { tokenId: string; body: Record<string, unknown> }) => Promise<unknown>;

// Shared wrapper for the CLI-facing research endpoints: bearer-token auth,
// JSON parsing and QueueError → HTTP status mapping.
export function researchEndpoint(handler: Handler) {
  return async (request: Request) => {
    const token = await verifyResearchToken(db, bearerToken(request));
    if (!token)
      return Response.json({ error: "Invalid or revoked research token" }, { status: 401 });

    let body: Record<string, unknown> = {};
    if (request.headers.get("content-length") !== "0") {
      try {
        body = (await request.json()) ?? {};
      } catch {
        return Response.json({ error: "Body must be JSON" }, { status: 400 });
      }
    }

    try {
      const result = await handler({ tokenId: token.id, body });
      return Response.json(result ?? null);
    } catch (error) {
      if (error instanceof QueueError) {
        return Response.json(
          { error: error.message, issues: error.issues },
          { status: error.status },
        );
      }
      throw error;
    }
  };
}

export function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value) throw new QueueError(`"${key}" is required`, 400);
  return value;
}
