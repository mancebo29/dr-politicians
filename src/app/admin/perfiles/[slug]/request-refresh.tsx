"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/admin/investigacion/actions";

export function RequestRefreshButton({
  action,
  politicianId,
  className,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  politicianId: string;
  className: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="kind" value="refresh" />
      <input type="hidden" name="politicianId" value={politicianId} />
      {state?.error && <span className="text-sm text-danger">{state.error}</span>}
      <button type="submit" disabled={pending} className={className}>
        {pending ? "Un momento…" : "Encolar actualización"}
      </button>
    </form>
  );
}
