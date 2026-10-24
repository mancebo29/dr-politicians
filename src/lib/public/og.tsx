import { ImageResponse } from "next/og";
import { SITE_NAME } from "./site";

export const ogSize = { width: 1200, height: 630 };

// Shared social card: text only, so generating it never fetches remote images.
export function ogCard({
  eyebrow,
  title,
  lines = [],
}: {
  eyebrow: string;
  title: string;
  lines?: string[];
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#ffffff",
        color: "#171717",
        borderTop: "16px solid #1d4ed8",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 32, color: "#5f6368" }}>{eyebrow}</div>
        <div
          style={{
            marginTop: 24,
            fontSize: title.length > 40 ? 64 : 80,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>
        {lines.map((line) => (
          <div key={line} style={{ marginTop: 20, fontSize: 36, color: "#5f6368" }}>
            {line}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30 }}>
        <div style={{ color: "#1d4ed8" }}>{SITE_NAME}</div>
        <div style={{ color: "#5f6368" }}>Perfiles con fuentes</div>
      </div>
    </div>,
    ogSize,
  );
}
