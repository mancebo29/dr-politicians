import { slugify } from "./slug";

// A deliberately small markup for admin-edited texts (methodology, privacy,
// terms). It is parsed into data and rendered as React elements, never as
// HTML, so stored text cannot inject markup or scripts.
//
//   ## Heading {#anchor}     ### Subheading      - list item
//   **bold**                 [link text](/path, #anchor, https://…, mailto:…)
//
// Blank lines separate paragraphs; consecutive lines of a paragraph are joined.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; level: 2 | 3; id: string; content: Inline[]; text: string }
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "list"; items: Inline[][] };

const SAFE_HREF = /^(\/(?!\/)|#|https?:\/\/|mailto:)/i;
const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) out.push({ kind: "text", text: text.slice(last, match.index) });
    if (match[1] !== undefined) {
      out.push({ kind: "strong", text: match[1] });
    } else if (SAFE_HREF.test(match[3])) {
      out.push({ kind: "link", text: match[2], href: match[3] });
    } else {
      out.push({ kind: "text", text: match[2] });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

const HEADING = /^(#{2,3})\s+(.+?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/;
const LIST_ITEM = /^[-*]\s+(.*)$/;

export function parseRichText(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flush = () => {
    if (paragraph.length)
      blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ")) });
    if (list) blocks.push({ kind: "list", items: list.map(parseInline) });
    paragraph = [];
    list = null;
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const text = heading[2];
      blocks.push({
        kind: "heading",
        level: heading[1].length as 2 | 3,
        id: heading[3] ?? slugify(text),
        content: parseInline(text),
        text: text.replace(/\*\*/g, ""),
      });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      if (paragraph.length) flush();
      (list ??= []).push(item[1]);
      continue;
    }
    if (list) {
      // A line under a list item continues that item.
      list[list.length - 1] += ` ${line}`;
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}
