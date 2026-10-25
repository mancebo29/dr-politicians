// The research runner's loop, with its side effects injected so the stop rules
// can be tested. scripts/research-run.ts wires it to the API and to headless
// Claude Code sessions.
import type { Brief } from "./research-client";

export type SessionResult = {
  exitCode: number | null;
  timedOut: boolean;
  // From the session's final result event, when it reported one.
  costUsd?: number;
  turns?: number;
};

export type RunnerDeps = {
  claim: () => Promise<Brief | null>;
  // Called when the queue is empty: queues the next wave segment's discovery,
  // or reports the roster that is still in progress or awaiting review.
  discoverNext: () => Promise<{
    queued: { title: string | null } | null;
    pending: { title: string | null; status: string } | null;
  }>;
  status: (jobId: string) => Promise<{ status: string; heldByYou: boolean }>;
  release: (jobId: string) => Promise<{ status: string }>;
  heartbeat: (jobId: string) => Promise<unknown>;
  runSession: (brief: Brief) => Promise<SessionResult>;
  shouldStop: () => boolean;
  now: () => number;
  log: (line: string) => void;
};

export type RunnerOptions = {
  maxJobs: number;
  maxHours: number;
  maxConsecutiveFailures: number;
  heartbeatMs: number;
};

export type RunSummary = {
  processed: number;
  submitted: number;
  failed: number;
  costUsd: number;
  stopReason: string;
};

export async function runQueue(deps: RunnerDeps, options: RunnerOptions): Promise<RunSummary> {
  const started = deps.now();
  const summary: RunSummary = { processed: 0, submitted: 0, failed: 0, costUsd: 0, stopReason: "" };
  let consecutiveFailures = 0;

  while (true) {
    if (deps.shouldStop()) {
      summary.stopReason = "stopped";
      break;
    }
    if (summary.processed >= options.maxJobs) {
      summary.stopReason = `job limit (${options.maxJobs})`;
      break;
    }
    if (deps.now() - started >= options.maxHours * 3_600_000) {
      summary.stopReason = `time limit (${options.maxHours} h)`;
      break;
    }
    const brief = await deps.claim();
    if (!brief) {
      const { queued, pending } = await deps.discoverNext();
      if (queued) {
        deps.log(`Queue empty; queued discovery for ${queued.title}.`);
        continue;
      }
      summary.stopReason = pending
        ? `queue empty; ${pending.title} is ${pending.status === "submitted" ? "waiting for your approval" : pending.status}`
        : "queue empty";
      break;
    }

    const id = brief.job.id;
    const target = brief.job.requestedName ?? brief.currentProfile?.payload.politician.fullName;
    deps.log(`▶ ${brief.job.kind} · ${target ?? id} · ${id}`);
    const jobStarted = deps.now();
    // The runner keeps the lease alive, so a long session never loses its job.
    const timer = setInterval(() => {
      deps.heartbeat(id).catch((error) => deps.log(`  heartbeat failed: ${String(error)}`));
    }, options.heartbeatMs);
    let session: SessionResult;
    try {
      session = await deps.runSession(brief);
    } finally {
      clearInterval(timer);
    }
    summary.processed++;
    summary.costUsd += session.costUsd ?? 0;

    const minutes = Math.round((deps.now() - jobStarted) / 60_000);
    const cost = session.costUsd === undefined ? "" : ` · $${session.costUsd.toFixed(2)}`;
    const { status, heldByYou } = await deps.status(id);
    if (status === "submitted") {
      summary.submitted++;
      consecutiveFailures = 0;
      deps.log(`  ✓ submitted for review · ${minutes} min${cost}`);
      continue;
    }

    summary.failed++;
    consecutiveFailures++;
    const why = session.timedOut ? "timed out" : `exited with code ${session.exitCode}`;
    if (status === "claimed" && heldByYou) {
      const released = await deps.release(id);
      deps.log(`  ✗ not submitted (${why}); job is now ${released.status} · ${minutes} min${cost}`);
    } else {
      deps.log(`  ✗ not submitted (${why}); job is ${status}`);
    }
    if (consecutiveFailures >= options.maxConsecutiveFailures) {
      summary.stopReason = `${consecutiveFailures} failures in a row`;
      break;
    }
  }
  return summary;
}
