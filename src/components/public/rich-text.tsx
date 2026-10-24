import Link from "next/link";
import type { Block, Inline } from "@/lib/rich-text";

const linkClass = "text-accent underline underline-offset-4 hover:decoration-2";

function Inlines({ content }: { content: Inline[] }) {
  return content.map((part, i) => {
    if (part.kind === "strong") return <strong key={i}>{part.text}</strong>;
    if (part.kind === "link") {
      return part.href.startsWith("/") ? (
        <Link key={i} href={part.href} prefetch={false} className={linkClass}>
          {part.text}
        </Link>
      ) : (
        <a key={i} href={part.href} className={linkClass} rel="noopener noreferrer">
          {part.text}
        </a>
      );
    }
    return part.text;
  });
}

// Renders text parsed by parseRichText(). Headings get ids so they can be
// linked (e.g. /metodologia#ranking).
export function RichText({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          const Tag = block.level === 2 ? "h2" : "h3";
          return (
            <Tag
              key={i}
              id={block.id}
              className={`scroll-mt-6 font-semibold ${block.level === 2 ? "pt-7 text-xl" : "pt-3 text-lg"}`}
            >
              <Inlines content={block.content} />
            </Tag>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={i} className="list-disc space-y-2 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inlines content={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <Inlines content={block.content} />
          </p>
        );
      })}
    </div>
  );
}
