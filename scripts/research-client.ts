// HTTP client for the research API, shared by the research CLI and runner.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResearchBrief } from "@/lib/research/queue";

export const BRIEFS_DIR = "research/briefs";

function config() {
  const token = process.env.RESEARCH_TOKEN;
  if (!token)
    throw new Error("RESEARCH_TOKEN is not set (create one in /admin/investigacion/tokens)");
  return { token, baseUrl: process.env.RESEARCH_API_URL ?? "http://localhost:3000" };
}

export async function call(endpoint: string, body: unknown) {
  const { token, baseUrl } = config();
  const response = await fetch(`${baseUrl}/api/research/${endpoint}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const issues: string[] = data?.issues ?? [];
    throw new Error(
      [
        `${endpoint} failed (${response.status}): ${data?.error ?? response.statusText}`,
        ...issues,
      ].join("\n  "),
    );
  }
  return data;
}

// The brief as received over JSON (dates arrive as strings).
export type Brief = Omit<ResearchBrief, "job"> & {
  job: Omit<ResearchBrief["job"], "leaseExpiresAt"> & { leaseExpiresAt: string };
};

// Claims the next job and saves its brief; null when the queue is empty.
export async function claimAndSaveBrief(): Promise<{ brief: Brief; file: string } | null> {
  const { brief } = (await call("claim", {})) as { brief: Brief | null };
  if (!brief) return null;
  await mkdir(BRIEFS_DIR, { recursive: true });
  const file = path.join(BRIEFS_DIR, `${brief.job.id}.json`);
  await writeFile(file, JSON.stringify(brief, null, 2) + "\n");
  return { brief, file };
}

export function briefTarget(brief: Brief) {
  return (
    brief.job.requestedName ?? brief.currentProfile?.payload.politician.fullName ?? brief.job.id
  );
}
