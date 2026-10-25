import { db } from "@/db";
import { requireString, researchEndpoint } from "@/lib/research/api";
import { jobStatus } from "@/lib/research/queue";

export const POST = researchEndpoint(({ tokenId, body }) =>
  jobStatus(db, tokenId, requireString(body, "jobId")),
);
