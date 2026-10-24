import { describe, expect, it } from "vitest";
import { samplePayload } from "./fixtures";
import { formatIssues, researchPayloadSchema } from "./schema";

function issues(input: unknown) {
  const result = researchPayloadSchema.safeParse(input);
  return result.success ? [] : formatIssues(result.error);
}

describe("research payload schema", () => {
  it("accepts a complete, sourced submission", () => {
    expect(issues(samplePayload())).toEqual([]);
  });

  it("rejects claims without sources or with unknown source ids", () => {
    const payload = samplePayload();
    payload.positions![0].sourceIds = [];
    payload.statements![0].sourceIds = ["s99"];
    expect(issues(payload)).toEqual([
      "positions.0.sourceIds: Every claim needs at least one source",
      'statements.0.sourceIds.0: Unknown source id "s99"',
    ]);
  });

  it("requires two press publishers or one official source for controversies", () => {
    const onePublisher = samplePayload();
    onePublisher.sources![1].publisher = "Diario Uno";
    expect(issues(onePublisher)).toEqual([
      expect.stringContaining("controversies.0.sourceIds: Controversies need"),
    ]);

    const official = samplePayload();
    official.controversies![0].sourceIds = ["s3"];
    expect(issues(official)).toEqual([]);
  });

  it("rejects non-web URLs so links are safe to render", () => {
    const payload = samplePayload();
    payload.sources![0].url = "javascript:alert(1)";
    expect(issues(payload)).toEqual([expect.stringMatching(/^sources\.0\.url:/)]);
  });

  it("rejects periods that end before they start and current roles with an end", () => {
    const payload = samplePayload();
    payload.positions![0].end = "2019";
    payload.positions![1].end = "2025";
    expect(issues(payload)).toEqual([
      "positions.0.end: Ends before it starts",
      "positions.1.end: A current position cannot have an end date",
    ]);
  });

  it("requires a source when reporting that the person has died", () => {
    expect(
      issues(samplePayload({ livingStatus: { isAlive: false, checkedOn: "2026-10-24" } })),
    ).toEqual(["livingStatus.sourceIds: A death report needs a source"]);
  });
});
