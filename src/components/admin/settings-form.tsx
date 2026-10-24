"use client";

import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import type { ActionState } from "@/app/admin/investigacion/actions";
import { buttonClass } from "./ui";

// Like ActionForm, but submits without React's automatic form reset, so long
// texts keep the admin's edits when validation fails. Shows "Guardado" after
// a successful save.
export function SettingsForm({
  action,
  children,
  submitLabel = "Guardar",
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel?: string;
}) {
  const [state, setState] = useState<ActionState | "saved">(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await action(null, form);
      setState(result ?? "saved");
    });
  }

  const error = state && state !== "saved" ? state : null;
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {children}
      {error?.error && (
        <div role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
          <p>{error.error}</p>
          {error.issues && (
            <ul className="mt-1 list-disc pl-5 font-mono text-xs">
              {error.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Guardando…" : submitLabel}
        </button>
        {state === "saved" && !pending && (
          <span role="status" className="text-sm text-success">
            Guardado.
          </span>
        )}
      </div>
    </form>
  );
}
