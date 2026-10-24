import type { InputHTMLAttributes, ReactNode } from "react";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </div>
  );
}

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const hintId = hint ? `${input.name}-hint` : undefined;
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        {...input}
        aria-describedby={hintId}
        className="rounded-md border border-border bg-background px-3 py-2 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {hint && (
        <span id={hintId} className="text-xs font-normal text-muted">
          {hint}
        </span>
      )}
    </label>
  );
}

export function SubmitButton({
  pending,
  disabled,
  children,
}: {
  pending: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground disabled:opacity-60"
    >
      {pending ? "Un momento…" : children}
    </button>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${
        tone === "error" ? "border-danger text-danger" : "border-success text-success"
      }`}
    >
      {children}
    </p>
  );
}
