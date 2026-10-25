import { describe, expect, it } from "vitest";
import type { Brief } from "./research-client";
import { type RunnerDeps, runQueue, type SessionResult } from "./research-runner";

const options = { maxJobs: 10, maxHours: 8, maxConsecutiveFailures: 3, heartbeatMs: 60_000 };

function brief(id: string): Brief {
  return { job: { id, kind: "new_profile", requestedName: `Persona ${id}` } } as Brief;
}

// A fake queue: each job's session either submits it or leaves it claimed.
function fakeQueue(outcomes: ("submit" | "fail")[], overrides: Partial<RunnerDeps> = {}) {
  const jobs = outcomes.map((outcome, i) => ({ id: `j${i + 1}`, outcome, status: "queued" }));
  const released: string[] = [];
  const lines: string[] = [];
  let clock = 0;
  const deps: RunnerDeps = {
    claim: async () => {
      const job = jobs.find((j) => j.status === "queued");
      if (!job) return null;
      job.status = "claimed";
      return brief(job.id);
    },
    runSession: async (b): Promise<SessionResult> => {
      clock += 30 * 60_000;
      const job = jobs.find((j) => j.id === b.job.id)!;
      if (job.outcome === "submit") job.status = "submitted";
      return { exitCode: job.outcome === "submit" ? 0 : 1, timedOut: false, costUsd: 1.5 };
    },
    status: async (id) => ({
      status: jobs.find((j) => j.id === id)!.status,
      heldByYou: true,
    }),
    release: async (id) => {
      released.push(id);
      jobs.find((j) => j.id === id)!.status = "failed";
      return { status: "failed" };
    },
    heartbeat: async () => null,
    discoverNext: async () => ({ queued: null, pending: null }),
    shouldStop: () => false,
    now: () => clock,
    log: (line) => lines.push(line),
    ...overrides,
  };
  return { deps, released, lines };
}

describe("runQueue", () => {
  it("works until the queue is empty, releasing jobs that were not submitted", async () => {
    const { deps, released } = fakeQueue(["submit", "fail", "submit"]);
    expect(await runQueue(deps, options)).toEqual({
      processed: 3,
      submitted: 2,
      failed: 1,
      costUsd: 4.5,
      stopReason: "queue empty",
    });
    expect(released).toEqual(["j2"]);
  });

  it("stops after repeated failures in a row", async () => {
    const { deps } = fakeQueue(["fail", "fail", "fail", "submit"]);
    const summary = await runQueue(deps, options);
    expect(summary).toMatchObject({ processed: 3, stopReason: "3 failures in a row" });
  });

  it("respects the job and time limits", async () => {
    const queue = ["submit", "submit", "submit", "submit"] as const;
    expect(await runQueue(fakeQueue([...queue]).deps, { ...options, maxJobs: 2 })).toMatchObject({
      processed: 2,
      stopReason: "job limit (2)",
    });
    // Each fake session takes 30 minutes; a one-hour budget fits two.
    expect(await runQueue(fakeQueue([...queue]).deps, { ...options, maxHours: 1 })).toMatchObject({
      processed: 2,
      stopReason: "time limit (1 h)",
    });
  });

  it("does not release a job another holder took over", async () => {
    const { deps, released, lines } = fakeQueue(["fail"], {
      status: async () => ({ status: "claimed", heldByYou: false }),
    });
    await runQueue(deps, options);
    expect(released).toEqual([]);
    expect(lines.at(-1)).toContain("job is claimed");
  });

  it("queues the next discovery when the queue runs dry, and names a pending roster", async () => {
    let discovered = false;
    const { deps } = fakeQueue([], {
      discoverNext: async () => {
        if (discovered) return { queued: null, pending: { title: "Ola 1", status: "submitted" } };
        discovered = true;
        return { queued: { title: "Ola 1" }, pending: null };
      },
    });
    // The fake queue stays empty, so the second claim finds the roster pending.
    expect(await runQueue(deps, options)).toMatchObject({
      processed: 0,
      stopReason: "queue empty; Ola 1 is waiting for your approval",
    });
  });

  it("stops before claiming when asked to", async () => {
    const { deps } = fakeQueue(["submit"], { shouldStop: () => true });
    expect(await runQueue(deps, options)).toMatchObject({ processed: 0, stopReason: "stopped" });
  });
});
