import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SettingsForm } from "@/components/admin/settings-form";
import { inputClass, PageTitle, Panel } from "@/components/admin/ui";
import { db } from "@/db";
import { googleEnabled } from "@/lib/auth";
import { loadRankingSettings } from "@/lib/popularity/settings";
import { requireRole } from "@/lib/session";
import { loadSetting } from "@/lib/site-settings";
import {
  saveCommentSettingsAction,
  saveContentSettingsAction,
  saveRankingSettingsAction,
  saveRegistrationSettingsAction,
} from "./actions";

export const metadata: Metadata = { title: "Configuración" };
export const instant = false;

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

const markupHint =
  "Formato: línea en blanco entre párrafos, «## Título {#ancla}» para secciones, «- » para listas, **negrita** y [texto](/enlace).";

export default async function SettingsPage() {
  await requireRole(["admin"], "/admin/configuracion");
  const [comments, registration, content, ranking] = await Promise.all([
    loadSetting(db, "comments"),
    loadSetting(db, "registration"),
    loadSetting(db, "content"),
    loadRankingSettings(db),
  ]);

  return (
    <div>
      <PageTitle>Configuración</PageTitle>
      <p className="mt-2 text-sm text-muted">
        Cada cambio queda registrado en la auditoría y se aplica de inmediato.
      </p>

      <Panel title="Comentarios">
        <SettingsForm action={saveCommentSettingsAction}>
          <Check name="enabled" label="Permitir comentarios" checked={comments.enabled} />
          <Check
            name="preModeration"
            label="Revisar cada comentario antes de publicarlo"
            checked={comments.preModeration}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reportes para ocultar un comentario">
              <input
                name="autoHideThreshold"
                type="number"
                min={1}
                max={100}
                required
                defaultValue={comments.autoHideThreshold}
                className={inputClass}
              />
            </Field>
            <Field label="Minutos para editar un comentario">
              <input
                name="editWindowMinutes"
                type="number"
                min={0}
                max={1440}
                required
                defaultValue={comments.editWindowMinutes}
                className={inputClass}
              />
            </Field>
          </div>
          <Field
            label="Términos bloqueados"
            hint="Uno por línea. Los comentarios que los contienen esperan revisión."
          >
            <textarea
              name="blockedTerms"
              rows={4}
              defaultValue={comments.blockedTerms.join("\n")}
              className={inputClass}
            />
          </Field>
        </SettingsForm>
      </Panel>

      <Panel title="Registro de cuentas">
        <SettingsForm action={saveRegistrationSettingsAction}>
          <Check
            name="enabled"
            label="Permitir crear cuentas nuevas"
            checked={registration.enabled}
          />
          <Check name="password" label="Con usuario y contraseña" checked={registration.password} />
          <Check name="google" label="Con Google" checked={registration.google} />
          {!googleEnabled && (
            <p className="text-xs text-muted">
              Google no está configurado en este entorno, así que no se muestra.
            </p>
          )}
        </SettingsForm>
      </Panel>

      <Panel title="Contenido">
        <SettingsForm action={saveContentSettingsAction}>
          <Field
            label="Aviso destacado"
            hint="Se muestra arriba en todas las páginas públicas. Vacío para ocultarlo."
          >
            <input
              name="banner"
              defaultValue={content.banner}
              maxLength={500}
              className={inputClass}
            />
          </Field>
          <Check
            name="maintenance"
            label="Modo mantenimiento (las páginas públicas muestran solo el mensaje)"
            checked={content.maintenance}
          />
          <Field label="Mensaje de mantenimiento">
            <input
              name="maintenanceMessage"
              defaultValue={content.maintenanceMessage}
              required
              maxLength={1000}
              className={inputClass}
            />
          </Field>
          <Field label="Texto del pie de página">
            <textarea name="about" rows={2} defaultValue={content.about} className={inputClass} />
          </Field>
          <Field label="Metodología" hint={markupHint}>
            <textarea
              name="methodology"
              rows={14}
              required
              defaultValue={content.methodology}
              className={`${inputClass} font-mono text-xs`}
            />
          </Field>
          <Field label="Política de privacidad" hint={markupHint}>
            <textarea
              name="privacy"
              rows={10}
              required
              defaultValue={content.privacy}
              className={`${inputClass} font-mono text-xs`}
            />
          </Field>
          <Field label="Términos de uso" hint={markupHint}>
            <textarea
              name="terms"
              rows={10}
              required
              defaultValue={content.terms}
              className={`${inputClass} font-mono text-xs`}
            />
          </Field>
        </SettingsForm>
      </Panel>

      <Panel title="Clasificación semanal">
        <SettingsForm action={saveRankingSettingsAction}>
          <Field
            label="Configuración (JSON)"
            hint="Pesos de noticias y visitas, medios y sus feeds, mínimo de menciones y criterios de actualización."
          >
            <textarea
              name="ranking"
              rows={16}
              spellCheck={false}
              defaultValue={JSON.stringify(ranking, null, 2)}
              className={`${inputClass} font-mono text-xs`}
            />
          </Field>
        </SettingsForm>
      </Panel>
    </div>
  );
}
