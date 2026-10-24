"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/app/admin/investigacion/actions";
import { buttonClass, inputClass } from "./ui";

// Controlled so a validation error doesn't wipe the admin's edits.
export function JsonEditorForm({
  action,
  initial,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <textarea
        name="payload"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={24}
        spellCheck={false}
        className={`${inputClass} font-mono text-xs`}
        aria-label="Contenido de la investigación (JSON)"
      />
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
      <div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Validando…" : "Guardar como nueva versión"}
        </button>
      </div>
    </form>
  );
}
