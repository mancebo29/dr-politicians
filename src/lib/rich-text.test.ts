import { describe, expect, it } from "vitest";
import { parseInline, parseRichText } from "./rich-text";
import { defaultContent } from "./site-content";

describe("parseRichText", () => {
  it("parses headings with anchors, paragraphs and lists", () => {
    const blocks = parseRichText(
      "Intro line one\nline two\n\n## Relevancia en noticias {#ranking}\n\n- uno\n- dos\n  sigue\n\n### Sub **tema**",
    );
    expect(blocks).toEqual([
      { kind: "paragraph", content: [{ kind: "text", text: "Intro line one line two" }] },
      {
        kind: "heading",
        level: 2,
        id: "ranking",
        text: "Relevancia en noticias",
        content: [{ kind: "text", text: "Relevancia en noticias" }],
      },
      {
        kind: "list",
        items: [[{ kind: "text", text: "uno" }], [{ kind: "text", text: "dos sigue" }]],
      },
      {
        kind: "heading",
        level: 3,
        id: "sub-tema",
        text: "Sub tema",
        content: [
          { kind: "text", text: "Sub " },
          { kind: "strong", text: "tema" },
        ],
      },
    ]);
  });

  it("keeps only safe link targets", () => {
    const parts = parseInline(
      "[a](/feedback) [b](https://x.do) [c](javascript:alert) [d](//evil.example)",
    );
    expect(parts.filter((p) => p.kind === "link")).toEqual([
      { kind: "link", text: "a", href: "/feedback" },
      { kind: "link", text: "b", href: "https://x.do" },
    ]);
    expect(parts.map((p) => p.text).join("")).toBe("a b c d");
  });

  it("keeps the methodology anchors other pages link to", () => {
    const ids = parseRichText(defaultContent.methodology).flatMap((b) =>
      b.kind === "heading" ? [b.id] : [],
    );
    expect(ids).toContain("ranking");
    expect(ids).toContain("correcciones");
  });
});
