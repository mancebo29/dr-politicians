import { db } from "@/db";
import { researchEndpoint } from "@/lib/research/api";
import { startNextDiscovery } from "@/lib/research/queue";

export const POST = researchEndpoint(() => startNextDiscovery(db));
