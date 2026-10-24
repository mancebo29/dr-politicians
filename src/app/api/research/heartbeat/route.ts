import { db } from "@/db";
import { requireString, researchEndpoint } from "@/lib/research/api";
import { heartbeat } from "@/lib/research/queue";

export const POST = researchEndpoint(({ tokenId, body }) =>
  heartbeat(db, tokenId, requireString(body, "jobId")),
);
