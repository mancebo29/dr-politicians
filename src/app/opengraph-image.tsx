import { ogCard, ogSize } from "@/lib/public/og";

export const alt = "Políticos RD: perfiles con fuentes de políticos dominicanos";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "República Dominicana",
    title: "Perfiles con fuentes de sus políticos",
    lines: ["Trayectoria, leyes, partidos, declaraciones y controversias"],
  });
}
