// CLI used by Claude Code research sessions (see .claude/skills/research-politician).
//   pnpm research:claim                     claim the next job, save its brief
//   pnpm research:validate <file>           check a profile or roster payload locally
//   pnpm research:submit <jobId> <file>     submit a payload for admin review
//   pnpm research:heartbeat <jobId>         extend the 2h lease while still working
import { readFile } from "node:fs/promises";
import { rosterPayloadSchema } from "@/lib/research/roster";
import { formatIssues, researchPayloadSchema } from "@/lib/research/schema";
import { briefTarget, call, claimAndSaveBrief } from "./research-client";

async function readPayload(file: string) {
  return JSON.parse(await readFile(file, "utf8")) as unknown;
}

const commands: Record<string, (args: string[]) => Promise<void>> = {
  async claim() {
    const claimed = await claimAndSaveBrief();
    if (!claimed) {
      console.log("Queue is empty.");
      return;
    }
    const { brief, file } = claimed;
    console.log(`Claimed ${brief.job.kind} job ${brief.job.id} for "${briefTarget(brief)}".`);
    console.log(`Lease expires ${brief.job.leaseExpiresAt}. Brief: ${file}`);
    if (brief.reviewNotes) console.log(`Reviewer notes: ${brief.reviewNotes}`);
  },

  async validate([file]) {
    if (!file) throw new Error("Usage: pnpm research:validate <file>");
    const input = await readPayload(file);
    if (input && typeof input === "object" && "people" in input) {
      const roster = rosterPayloadSchema.safeParse(input);
      if (roster.success) {
        console.log(
          `Valid roster for ${roster.data.segment}: ${roster.data.people.length} people, ${roster.data.sources.length} sources.`,
        );
      } else {
        console.error(["Invalid roster:", ...formatIssues(roster.error)].join("\n  "));
        process.exitCode = 1;
      }
      return;
    }
    const result = researchPayloadSchema.safeParse(input);
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
