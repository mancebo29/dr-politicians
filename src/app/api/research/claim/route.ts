import { db } from "@/db";
import { researchEndpoint } from "@/lib/research/api";
import { claimNextJob } from "@/lib/research/queue";

export const POST = researchEndpoint(async ({ tokenId }) => ({
  brief: await claimNextJob(db, tokenId),
}));
