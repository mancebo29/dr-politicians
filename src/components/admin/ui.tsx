import type { ReactNode } from "react";

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {actions}
    </div>
  );
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-6 rounded-lg border border-border p-4">
      {title && <h2 className="mb-3 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

const tones = {
  neutral: "border-border text-muted",
  info: "border-accent text-accent",
  success: "border-success text-success",
  danger: "border-danger text-danger",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export const inputClass =
  "border-border bg-background focus-visible:ring-accent w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2";

export const buttonClass =
  "bg-accent text-accent-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60";

export const secondaryButtonClass =
  "border-border rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-surface disabled:opacity-60";
