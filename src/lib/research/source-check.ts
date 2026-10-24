import type { SourceCheck, SourceChecker } from "./queue";

const TIMEOUT_MS = 8000;
const CONCURRENCY = 6;

// Best-effort reachability report for the reviewer. Many news sites block
// automated requests, so a failure is a flag to check by hand, not a rejection.
export const checkSourcesOverHttp: SourceChecker = async (sources) => {
  const results: SourceCheck[] = [];
  const queue = [...sources];
  async function worker() {
    for (let source = queue.shift(); source; source = queue.shift()) {
      try {
        const response = await fetch(source.url, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { "user-agent": "dr-politicians-source-check/0.1" },
        });
        await response.body?.cancel();
        results.push({ id: source.id, url: source.url, ok: response.ok, status: response.status });
      } catch {
        results.push({ id: source.id, url: source.url, ok: false, status: null });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return sources.map((s) => results.find((r) => r.id === s.id)!);
};
