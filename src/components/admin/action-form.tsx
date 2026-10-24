"use client";

import { type ReactNode, useActionState } from "react";
import type { ActionState } from "@/app/admin/investigacion/actions";

// A form bound to a server action that reports errors (and an optional
// one-time token) back to the page.
export function ActionForm({
  action,
  children,
  submitLabel,
  className = "flex flex-col gap-3",
  submitClassName,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: string;
  className?: string;
  submitClassName: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <div role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
          <p>{state.error}</p>
          {state.issues && (
            <ul className="mt-1 list-disc pl-5 font-mono text-xs">
              {state.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state?.token && (
        <div role="status" className="rounded-md border border-success px-3 py-2 text-sm">
          <p className="font-medium text-success">
            Token creado. Cópialo ahora; no se mostrará de nuevo.
          </p>
          <code
            className="mt-1 block font-mono text-xs break-all select-all"
            data-testid="new-token"
          >
            {state.token}
          </code>
        </div>
      )}
      <div>
        <button type="submit" disabled={pending} className={submitClassName}>
          {pending ? "Un momento…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
