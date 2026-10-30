// Works the research queue unattended: claims each job, runs one fresh headless
// Claude Code session for it, and releases jobs a session did not submit.
// Nothing is published; every submission waits for admin review.
//   pnpm research:run [--max-jobs 5] [--max-hours 8] [--timeout-min 100] [--model <id>]
// Ctrl-C stops after the current session ends; its job is released.
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { type Brief, BRIEFS_DIR, call, claimAndSaveBrief } from "./research-client";
import { runQueue, type SessionResult } from "./research-runner";

const LOGS_DIR = "research/logs";

// Everything a research session may do. Anything else is denied, since a
// headless session cannot ask for permission.
const ALLOWED_TOOLS = [
  "Read",
  "Glob",
  "Grep",
  "WebSearch",
  "WebFetch",
  // Edit rules cover every file-writing tool, Write included.
  "Edit(research/out/**)",
  "Bash(pnpm research:validate:*)",
  "Bash(pnpm research:submit:*)",
];

const { values: args } = parseArgs({
  options: {
    "max-jobs": { type: "string", default: "5" },
    "max-hours": { type: "string", default: "8" },
    "timeout-min": { type: "string", default: "100" },
    model: { type: "string" },
  },
});

function number(name: keyof typeof args) {
  const value = Number(args[name]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`--${name} must be a positive number`);
  return value;
}

const options = {
  maxJobs: number("max-jobs"),
  maxHours: number("max-hours"),
  timeoutMs: number("timeout-min") * 60_000,
  maxConsecutiveFailures: 3,
  heartbeatMs: 30 * 60_000,
};

function prompt(brief: Brief) {
  const id = brief.job.id;
  const skill =
    brief.job.kind === "roster_discovery"
      ? ".claude/skills/discover-roster/SKILL.md"
      : ".claude/skills/research-politician/SKILL.md";
  return [
    `You are running unattended as the dr-politicians research runner; nobody is watching.`,
    `Job ${id} is already claimed for you and its brief is at ${path.join(BRIEFS_DIR, `${id}.json`)}.`,
    `Follow ${skill}, skipping the claim step: do not run research:claim, and do not run`,
    `research:heartbeat (the runner keeps the lease alive).`,
    `Write the payload to research/out/${id}.json, run \`pnpm research:validate research/out/${id}.json\``,
    `until it passes, then \`pnpm research:submit ${id} research/out/${id}.json\`.`,
    `If you cannot produce a submission that meets the skill's rules, stop without submitting`,
    `and say why. End with the report the skill asks for.`,
  ].join(" ");
}

let stopRequested = false;
let runLog = "";
let written = Promise.resolve();

// Appends are chained so the run log keeps the order of the console.
function log(line: string) {
  console.log(line);
  written = written.then(() => appendFile(runLog, line + "\n"));
  return written;
}

async function runSession(brief: Brief): Promise<SessionResult> {
  const logFile = path.join(LOGS_DIR, `${stamp()}-${brief.job.id}.jsonl`);
  const out = createWriteStream(logFile);
  const child = spawn(
    "claude",
    [
      "-p",
      prompt(brief),
      "--output-format",
      "stream-json",
      "--verbose",
      ...(args.model ? ["--model", args.model] : []),
      "--allowedTools",
      ...ALLOWED_TOOLS,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stdout.pipe(out);
  child.stderr.pipe(out);

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, options.timeoutMs);
  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("error", (error) => {
      out.write(JSON.stringify({ type: "runner_error", message: String(error) }) + "\n");
      resolve(null);
    });
    child.on("close", resolve);
  });
  clearTimeout(timer);
  await new Promise((resolve) => out.end(resolve));

  const result = (await readFile(logFile, "utf8"))
    .split("\n")
    .flatMap((line) => {
      try {
        const event = JSON.parse(line);
        return event?.type === "result" ? [event] : [];
      } catch {
        return [];
      }
    })
    .at(-1);
  await log(`  log: ${logFile}`);
  return {
    exitCode,
    timedOut,
    costUsd: typeof result?.total_cost_usd === "number" ? result.total_cost_usd : undefined,
    turns: typeof result?.num_turns === "number" ? result.num_turns : undefined,
  };
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
  await mkdir(LOGS_DIR, { recursive: true });
  runLog = path.join(LOGS_DIR, `run-${stamp()}.log`);
  process.on("SIGINT", () => {
    if (stopRequested) process.exit(130);
    stopRequested = true;
    console.log("\nStopping after the current session (Ctrl-C again to quit now).");
  });

  await log(
    `Research runner: up to ${options.maxJobs} jobs, ${options.maxHours} h, ` +
      `${options.timeoutMs / 60_000} min per job${args.model ? `, model ${args.model}` : ""}.`,
  );
  const summary = await runQueue(
    {
      claim: async () => (await claimAndSaveBrief())?.brief ?? null,
      discoverNext: () => call("discover-next", {}),
      status: (jobId) => call("status", { jobId }),
      release: (jobId) => call("release", { jobId }),
      heartbeat: (jobId) => call("heartbeat", { jobId }),
      runSession,
      shouldStop: () => stopRequested,
      now: Date.now,
      log: (line) => void log(line),
    },
    options,
  );
  await log(
    `Done (${summary.stopReason}): ${summary.processed} jobs, ${summary.submitted} submitted, ` +
      `${summary.failed} not submitted${summary.costUsd ? `, $${summary.costUsd.toFixed(2)} reported` : ""}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
