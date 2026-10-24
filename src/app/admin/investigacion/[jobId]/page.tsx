import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { JsonEditorForm } from "@/components/admin/json-editor-form";
import {
  Badge,
  buttonClass,
  inputClass,
  PageTitle,
  Panel,
  secondaryButtonClass,
} from "@/components/admin/ui";
import { ProfileView } from "@/components/profile/profile-view";
import { db } from "@/db";
import { researchJobs, researchSubmissions } from "@/db/schema";
import { jobKindLabel, jobStatusLabel } from "@/lib/labels";
import { loadProfile } from "@/lib/profiles/load";
import { diffPayloads } from "@/lib/research/diff";
import { publishSections } from "@/lib/research/publish";
import type { ValidationReport } from "@/lib/research/queue";
import { claimSections, researchPayloadSchema } from "@/lib/research/schema";
import { claimSummary, sectionLabel } from "@/lib/research/summary";
import { requireRole } from "@/lib/session";
import { decideAction, publishAction, reviseAction } from "../actions";

export const metadata: Metadata = { title: "Revisión" };
export const instant = false;

function show(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return Array.isArray(value) ? value.join(", ") || "—" : String(value);
}

export default async function ReviewPage({ params }: PageProps<"/admin/investigacion/[jobId]">) {
  const { jobId } = await params;
  await requireRole(["admin"], `/admin/investigacion/${jobId}`);
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();

  const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, jobId));
  if (!job) notFound();
  const submissions = await db
    .select()
    .from(researchSubmissions)
    .where(eq(researchSubmissions.jobId, job.id))
    .orderBy(desc(researchSubmissions.createdAt));
  const pending = job.status === "submitted" ? submissions.find((s) => !s.decidedAt) : undefined;
  const current = job.politicianId ? await loadProfile(db, { id: job.politicianId }) : null;
  const name = current?.payload.politician.fullName ?? job.requestedName;

  return (
    <div>
      <Link href="/admin/investigacion" className="text-sm text-muted hover:underline">
        ← Investigación
      </Link>
      <PageTitle
        actions={
          current && (
            <Link href={`/admin/perfiles/${current.slug}`} className={secondaryButtonClass}>
              Ver perfil publicado
            </Link>
          )
        }
      >
        {name}
      </PageTitle>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        {jobKindLabel[job.kind]} · <Badge>{jobStatusLabel[job.status]}</Badge> · intentos:{" "}
        {job.attempts}
        {job.instructions && <> · Instrucciones: {job.instructions}</>}
      </p>

      {pending ? (
        <Review
          key={pending.id}
          submission={pending}
          isNew={!job.politicianId}
          current={current?.payload ?? null}
        />
      ) : (
        <Panel>
          <p className="text-sm text-muted">No hay una entrega pendiente de revisión.</p>
        </Panel>
      )}

      <Panel title="Historial de entregas">
        {submissions.length === 0 ? (
          <p className="text-sm text-muted">Sin entregas todavía.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {submissions.map((s) => (
              <li key={s.id}>
                <span className="tabular-nums">{s.createdAt.toLocaleString("es-DO")}</span> ·{" "}
                {s.decidedAt ? `decidida ${s.decidedAt.toLocaleString("es-DO")}` : "pendiente"}
                {s.reviewNotes && <span className="text-muted"> · {s.reviewNotes}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Review({
  submission,
  isNew,
  current,
}: {
  submission: typeof researchSubmissions.$inferSelect;
  isNew: boolean;
  current: Parameters<typeof diffPayloads>[0];
}) {
  const parsed = researchPayloadSchema.safeParse(submission.payload);
  if (!parsed.success) {
    return (
      <Panel title="Entrega">
        <p className="text-sm text-danger">
          Esta entrega ya no cumple el esquema actual. Corrígela en el editor JSON o solicita
          cambios.
        </p>
      </Panel>
    );
  }
  const payload = parsed.data;
  const report = submission.validationReport as ValidationReport | null;
  const diff = diffPayloads(current, payload);
  const failedSources = report?.sources.filter((s) => !s.ok) ?? [];
  const blocking = report?.references.errors ?? [];

  return (
    <>
      <Panel title="Validación">
        <ul className="space-y-2 text-sm">
          {blocking.map((e) => (
            <li key={e} className="text-danger">
              ✗ {e}
            </li>
          ))}
          {report?.references.newParties.map((p) => (
            <li key={p.acronym}>
              Se creará el partido <strong>{p.name}</strong> ({p.acronym}).
            </li>
          ))}
          {report?.references.newInstitutions.map((i) => (
            <li key={i}>
              Se creará la institución <strong>{i}</strong>.
            </li>
          ))}
          {report?.possibleDuplicates.map((d) => (
            <li key={d.id} className="text-danger">
              Posible duplicado:{" "}
              <Link href={`/admin/perfiles/${d.slug}`} className="underline">
                {d.fullName}
              </Link>
            </li>
          ))}
          <li>
            Fuentes: {payload.sources.length}, {failedSources.length} no respondieron a la
            verificación automática
            {failedSources.length > 0 &&
              " (revisar a mano; muchos medios bloquean accesos automáticos)"}
            .
          </li>
          {failedSources.map((s) => (
            <li key={s.id} className="pl-4 text-xs break-all text-muted">
              {s.id} · {s.status ?? "sin respuesta"} · {s.url}
            </li>
          ))}
          {payload.gaps.length > 0 && (
            <li>
              Vacíos señalados por la investigación:
              <ul className="list-disc pl-5 text-muted">
                {payload.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </li>
          )}
          {payload.confidenceNotes && (
            <li className="text-muted">Notas: {payload.confidenceNotes}</li>
          )}
        </ul>
      </Panel>

      <Panel title="Cambios respecto al perfil publicado">
        {diff.politician.length > 0 && (
          <table className="mb-4 w-full text-sm">
            <tbody>
              {diff.politician.map((c) => (
                <tr key={c.field} className="border-b border-border align-top">
                  <th className="py-1 pr-3 text-left font-medium">{c.field}</th>
                  <td className="py-1 pr-3 text-muted line-through">{show(c.before)}</td>
                  <td className="py-1">{show(c.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {diff.photo.before !== diff.photo.after && (
          <p className="mb-4 text-sm">Foto: {show(diff.photo.after)}</p>
        )}
        <div className="space-y-4">
          {claimSections.map((section) => {
            const d = diff[section];
            return (
              <div key={section}>
                <h3 className="text-sm font-medium">
                  {sectionLabel[section]}{" "}
                  <span className="font-normal text-muted">
                    +{d.added.length} −{d.removed.length} · {d.unchanged} sin cambios
                  </span>
                </h3>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {d.added.map((c, i) => (
                    <li key={`a${i}`} className="text-success">
                      + {claimSummary(section, c)}
                    </li>
                  ))}
                  {d.removed.map((c, i) => (
                    <li key={`r${i}`} className="text-danger">
                      − {claimSummary(section, c)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Decisión">
        <div className="grid gap-6 lg:grid-cols-3">
          <ActionForm
            action={publishAction.bind(null, submission.id)}
            submitLabel="Aprobar y publicar"
            submitClassName={buttonClass}
          >
            <fieldset className="space-y-1 text-sm">
              <legend className="mb-1 font-medium">Secciones a publicar</legend>
              {publishSections.map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={`section:${s}`}
                    defaultChecked
                    disabled={isNew && s === "politician"}
                  />
                  {sectionLabel[s]}
                  {isNew && s === "politician" && (
                    <input type="hidden" name={`section:${s}`} value="on" />
                  )}
                </label>
              ))}
            </fieldset>
            <textarea
              name="note"
              rows={2}
              className={inputClass}
              placeholder="Nota de la revisión (opcional, visible en el historial)"
            />
          </ActionForm>
          <ActionForm
            action={decideAction.bind(null, submission.id, "needs_changes")}
            submitLabel="Solicitar cambios"
            submitClassName={secondaryButtonClass}
          >
            <textarea
              name="note"
              required
              rows={5}
              className={inputClass}
              placeholder="Qué debe corregir la investigación (se envía con el próximo reclamo)"
            />
          </ActionForm>
          <ActionForm
            action={decideAction.bind(null, submission.id, "rejected")}
            submitLabel="Rechazar"
            submitClassName={secondaryButtonClass}
          >
            <textarea
              name="note"
              required
              rows={5}
              className={inputClass}
              placeholder="Motivo del rechazo"
            />
          </ActionForm>
        </div>
      </Panel>

      <details className="mt-6 rounded-lg border border-border p-4">
        <summary className="cursor-pointer font-semibold">
          Vista previa del perfil propuesto
        </summary>
        <div className="mt-4">
          <ProfileView payload={payload} idPrefix="propuesta-" />
        </div>
      </details>

      <details className="mt-6 rounded-lg border border-border p-4">
        <summary className="cursor-pointer font-semibold">Editar la entrega (JSON)</summary>
        <p className="mt-2 text-sm text-muted">
          Guardar crea una nueva versión de la entrega; la original queda en el historial.
        </p>
        <div className="mt-3">
          <JsonEditorForm
            action={reviseAction.bind(null, submission.id)}
            initial={JSON.stringify(payload, null, 2)}
          />
        </div>
      </details>
    </>
  );
}
