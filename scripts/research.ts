// CLI used by Claude Code research sessions (see .claude/skills/research-politician).
//   pnpm research:claim                     claim the next job, save its brief
//   pnpm research:validate <file>           check a payload against the schema locally
//   pnpm research:submit <jobId> <file>     submit a payload for admin review
//   pnpm research:heartbeat <jobId>         extend the 2h lease while still working
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatIssues, researchPayloadSchema } from "@/lib/research/schema";

const BRIEFS_DIR = "research/briefs";

function config() {
  const token = process.env.RESEARCH_TOKEN;
  if (!token)
    throw new Error("RESEARCH_TOKEN is not set (create one in /admin/investigacion/tokens)");
  return { token, baseUrl: process.env.RESEARCH_API_URL ?? "http://localhost:3000" };
}

async function call(endpoint: string, body: unknown) {
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

async function readPayload(file: string) {
  return JSON.parse(await readFile(file, "utf8")) as unknown;
}

const commands: Record<string, (args: string[]) => Promise<void>> = {
  async claim() {
    const { brief } = await call("claim", {});
    if (!brief) {
      console.log("Queue is empty.");
      return;
    }
    await mkdir(BRIEFS_DIR, { recursive: true });
    const file = path.join(BRIEFS_DIR, `${brief.job.id}.json`);
    await writeFile(file, JSON.stringify(brief, null, 2) + "\n");
    const target = brief.job.requestedName ?? brief.currentProfile?.payload.politician.fullName;
    console.log(`Claimed ${brief.job.kind} job ${brief.job.id} for "${target}".`);
    console.log(`Lease expires ${brief.job.leaseExpiresAt}. Brief: ${file}`);
    if (brief.reviewNotes) console.log(`Reviewer notes: ${brief.reviewNotes}`);
  },

  async validate([file]) {
    if (!file) throw new Error("Usage: pnpm research:validate <file>");
    const result = researchPayloadSchema.safeParse(await readPayload(file));
    if (result.success) {
      const p = result.data;
      console.log(
        `Valid. ${p.sources.length} sources; ${p.positions.length} positions, ${p.workRecord.length} work record, ` +
          `${p.partyMemberships.length} memberships, ` +
          `${p.legislation.length} legislation, ${p.statements.length} statements, ${p.controversies.length} controversies.`,
      );
      return;
    }
    console.error(["Invalid payload:", ...formatIssues(result.error)].join("\n  "));
    process.exitCode = 1;
  },

  async submit([jobId, file]) {
    if (!jobId || !file) throw new Error("Usage: pnpm research:submit <jobId> <file>");
    const result = await call("submit", { jobId, payload: await readPayload(file) });
    console.log(
      result.duplicate
        ? `Identical payload already submitted (${result.submissionId}).`
        : `Submitted for review: ${result.submissionId}`,
    );
  },

  async heartbeat([jobId]) {
    if (!jobId) throw new Error("Usage: pnpm research:heartbeat <jobId>");
    const { leaseExpiresAt } = await call("heartbeat", { jobId });
    console.log(`Lease extended until ${leaseExpiresAt}.`);
  },
};

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const run = command ? commands[command] : undefined;
  if (!run) throw new Error(`Usage: research <${Object.keys(commands).join("|")}> ...`);
  await run(args);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
