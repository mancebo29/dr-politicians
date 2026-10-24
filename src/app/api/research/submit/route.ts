import { db } from "@/db";
import { requireString, researchEndpoint } from "@/lib/research/api";
import { submitResearch } from "@/lib/research/queue";
import { checkSourcesOverHttp } from "@/lib/research/source-check";

// Source reachability checks run inline and can take a while for long source lists.
export const maxDuration = 120;

export const POST = researchEndpoint(({ tokenId, body }) =>
  submitResearch(db, {
    tokenId,
    jobId: requireString(body, "jobId"),
    payload: body.payload,
    checkSources: checkSourcesOverHttp,
  }),
);
