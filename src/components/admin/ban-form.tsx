import { ActionForm } from "./action-form";
import { inputClass, secondaryButtonClass } from "./ui";
import type { ActionState } from "@/app/admin/investigacion/actions";

// Suspension form shared by the moderation queue and the user page.
export function BanForm({
  action,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
}) {
  return (
    <ActionForm
      action={action}
      submitLabel="Suspender cuenta"
      submitClassName={secondaryButtonClass}
      className="flex flex-wrap items-end gap-2"
    >
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
        Motivo de la suspensión
        <input name="reason" required maxLength={500} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Duración
        <select name="duration" defaultValue="7" className={inputClass}>
          <option value="1">1 día</option>
          <option value="7">7 días</option>
          <option value="30">30 días</option>
          <option value="permanent">Indefinida</option>
        </select>
      </label>
    </ActionForm>
  );
}
