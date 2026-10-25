import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import {
  Badge,
  buttonClass,
  inputClass,
  PageTitle,
  Panel,
  secondaryButtonClass,
} from "@/components/admin/ui";
import { db } from "@/db";
import { politicians, researchJobs, researchTokens } from "@/db/schema";
import { jobKindLabel, jobStatusLabel } from "@/lib/labels";
import { requireRole } from "@/lib/session";
import { waveSegments } from "@/lib/research/waves";
import {
  createJobAction,
  createJobsAction,
  jobStatusAction,
  startDiscoveryAction,
} from "./actions";

export const metadata: Metadata = { title: "Investigación" };
export const instant = false;

const statusTone = {
  queued: "neutral",
  claimed: "info",
  submitted: "info",
  in_review: "info",
  needs_changes: "danger",
  approved: "success",
  rejected: "neutral",
  failed: "danger",
  cancelled: "neutral",
} as const;

// Open work first, then the most recently touched.
const statusOrder = sql`case ${researchJobs.status}
  when 'submitted' then 0 when 'needs_changes' then 1 when 'claimed' then 2 when 'queued' then 3
  else 4 end`;

export default async function ResearchQueuePage() {
  await requireRole(["admin"], "/admin/investigacion");
  const [jobs, profiles, discoveries] = await Promise.all([
    db
      .select({
        job: researchJobs,
        politician: { fullName: politicians.fullName, slug: politicians.slug },
        tokenName: researchTokens.name,
      })
      .from(researchJobs)
      .leftJoin(politicians, eq(researchJobs.politicianId, politicians.id))
      .leftJoin(researchTokens, eq(researchJobs.claimedByTokenId, researchTokens.id))
      .orderBy(statusOrder, desc(researchJobs.priority), desc(researchJobs.updatedAt))
      .limit(200),
    db
      .select({ id: politicians.id, fullName: politicians.fullName })
      .from(politicians)
      .orderBy(politicians.fullName),
    db
      .select({ segment: researchJobs.rosterSegment, status: researchJobs.status })
      .from(researchJobs)
      .where(eq(researchJobs.kind, "roster_discovery"))
      .orderBy(desc(researchJobs.createdAt)),
  ]);
  // Latest discovery status per segment; the default choice is the first
  // segment that has not been discovered or queued yet.
  const segmentStatus = new Map<string, (typeof discoveries)[number]["status"]>();
  for (const d of discoveries)
    if (d.segment && !segmentStatus.has(d.segment)) segmentStatus.set(d.segment, d.status);
  const nextSegment = waveSegments.find(
    (s) =>
      !segmentStatus.has(s.key) ||
      ["rejected", "cancelled", "failed"].includes(segmentStatus.get(s.key)!),
  );

  return (
    <div>
      <PageTitle
        actions={
          <Link href="/admin/investigacion/tokens" className={secondaryButtonClass}>
            Tokens de investigación
          </Link>
        }
      >
        Investigación
      </PageTitle>

      <Panel title="Descubrir una ola">
        <ActionForm
          action={startDiscoveryAction}
          submitLabel="Descubrir con IA"
          submitClassName={buttonClass}
        >
          <p className="text-sm text-muted">
            La IA busca en fuentes oficiales quiénes forman el segmento y entrega la lista para tu
            aprobación. Al aprobarla se ponen en cola sus perfiles y el descubrimiento del segmento
            siguiente. Se procesa con <code className="font-mono">pnpm research:run</code>.
          </p>
          <label className="flex flex-col gap-1 text-sm sm:max-w-md">
            Segmento
            <select name="segment" className={inputClass} defaultValue={nextSegment?.key}>
              {waveSegments.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.title}
                  {segmentStatus.has(s.key) && ` — ${jobStatusLabel[segmentStatus.get(s.key)!]}`}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>
      </Panel>

      <Panel title="Nueva investigación">
        <ActionForm
          action={createJobAction}
          submitLabel="Agregar a la cola"
          submitClassName={buttonClass}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Tipo
              <select name="kind" className={inputClass} defaultValue="new_profile">
                {Object.entries(jobKindLabel)
                  .filter(([value]) => value !== "roster_discovery")
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Persona (perfil nuevo)
              <input name="requestedName" className={inputClass} placeholder="Nombre completo" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Perfil existente (actualización o corrección)
              <select name="politicianId" className={inputClass} defaultValue="">
                <option value="">—</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Prioridad
                <input name="priority" type="number" defaultValue={0} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Ola
                <input name="wave" type="number" min={0} className={inputClass} />
              </label>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Instrucciones para la investigación
            <textarea
              name="instructions"
              rows={2}
              className={inputClass}
              placeholder="Ej.: verificar el cambio de partido de 2019"
            />
          </label>
        </ActionForm>
      </Panel>

      <Panel title="Agregar una ola">
        <ActionForm
          action={createJobsAction}
          submitLabel="Agregar personas a la cola"
          submitClassName={buttonClass}
        >
          <label className="flex flex-col gap-1 text-sm">
            Personas (una por línea; instrucciones opcionales después de «|»)
            <textarea
              name="people"
              rows={8}
              required
              className={`${inputClass} font-mono`}
              placeholder={
                "Raquel Peña Rodríguez | vicepresidenta desde 2020\nRicardo de los Santos"
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <label className="flex flex-col gap-1 text-sm">
              Prioridad
              <input name="priority" type="number" defaultValue={0} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Ola
              <input name="wave" type="number" min={0} className={inputClass} />
            </label>
          </div>
          <p className="text-sm text-muted">
            Se crean perfiles nuevos en el orden de la lista. Se omiten los nombres repetidos, los
            que ya tienen una investigación abierta y los que coinciden con un perfil existente.
          </p>
        </ActionForm>
      </Panel>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">Persona</th>
              <th className="py-2 pr-3 font-medium">Tipo</th>
              <th className="py-2 pr-3 font-medium">Estado</th>
              <th className="py-2 pr-3 font-medium">Prioridad</th>
              <th className="py-2 pr-3 font-medium">Intentos</th>
              <th className="py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-muted">
                  La cola está vacía.
                </td>
              </tr>
            )}
            {jobs.map(({ job, politician, tokenName }) => (
              <tr key={job.id} className="border-b border-border align-top">
                <td className="py-2 pr-3">
                  <Link
                    href={`/admin/investigacion/${job.id}`}
                    className="font-medium hover:underline"
                  >
                    {politician?.fullName ?? job.requestedName}
                  </Link>
                  {job.instructions && <p className="text-xs text-muted">{job.instructions}</p>}
                </td>
                <td className="py-2 pr-3">{jobKindLabel[job.kind]}</td>
                <td className="py-2 pr-3">
                  <Badge tone={statusTone[job.status]}>{jobStatusLabel[job.status]}</Badge>
                  {job.status === "claimed" && (
                    <p className="mt-1 text-xs text-muted">
                      {tokenName} · vence {job.leaseExpiresAt?.toLocaleString("es-DO")}
                    </p>
                  )}
                </td>
                <td className="py-2 pr-3 tabular-nums">{job.priority}</td>
                <td className="py-2 pr-3 tabular-nums">{job.attempts}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-2">
                    {job.status === "submitted" && (
                      <Link href={`/admin/investigacion/${job.id}`} className={buttonClass}>
                        Revisar
                      </Link>
                    )}
                    {job.status === "claimed" && (
                      <form action={jobStatusAction.bind(null, job.id, "release")}>
                        <button className={secondaryButtonClass}>Liberar</button>
                      </form>
                    )}
                    {!["approved", "cancelled"].includes(job.status) && (
                      <form action={jobStatusAction.bind(null, job.id, "cancel")}>
                        <button className={secondaryButtonClass}>Cancelar</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
