import { db } from "@/db";
import { requireString, researchEndpoint } from "@/lib/research/api";
import { releaseJob } from "@/lib/research/queue";

export const POST = researchEndpoint(({ tokenId, body }) =>
  releaseJob(db, tokenId, requireString(body, "jobId")),
);
