import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, PageTitle, secondaryButtonClass } from "@/components/admin/ui";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Auditoría" };
export const instant = false;

const entities = {
  comment: "Comentarios",
  user: "Cuentas",
  feedback: "Mensajes",
  site_setting: "Configuración",
  research_job: "Investigación",
  research_token: "Tokens",
} as const;

const dateTime = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "America/Santo_Domingo",
});

// Read-only view of audit_log: every admin and moderator change (PLAN §5).
export default async function AuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  await requireRole(["admin"], "/admin/auditoria");
  const requested = (await searchParams).entidad;
  const entity =
    typeof requested === "string" && Object.hasOwn(entities, requested) ? requested : null;
  const rows = await db
    .select({ entry: auditLog, actor: users.name })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(entity ? eq(auditLog.entity, entity) : undefined)
    .orderBy(desc(auditLog.at))
    .limit(200);

  return (
    <div>
      <PageTitle>Auditoría</PageTitle>
      <nav aria-label="Filtrar por tipo" className="mt-4 flex flex-wrap gap-2">
        <Link href="/admin/auditoria" className={entity ? secondaryButtonClass : buttonClass}>
          Todo
        </Link>
        {Object.entries(entities).map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/auditoria?entidad=${key}`}
            className={key === entity ? buttonClass : secondaryButtonClass}
          >
            {label}
          </Link>
        ))}
      </nav>
      <ul className="mt-6 divide-y divide-border text-sm">
        {rows.length === 0 && <li className="py-3 text-muted">Sin registros.</li>}
        {rows.map(({ entry, actor }) => (
          <li key={entry.id} className="py-3" data-testid="audit-entry">
            <div className="flex flex-wrap gap-x-2">
              <time dateTime={entry.at.toISOString()} className="text-muted">
                {dateTime.format(entry.at)}
              </time>
              <span className="font-mono">{entry.action}</span>
              <span className="text-muted">
                por {actor ?? (entry.actorUserId ? "cuenta eliminada" : "el sistema")}
              </span>
            </div>
            {(entry.before !== null || entry.after !== null) && (
              <details className="mt-1">
                <summary className="cursor-pointer text-accent">
                  Detalles{entry.entityId && ` · ${entry.entity} ${entry.entityId}`}
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-md bg-surface p-2 font-mono text-xs">
                  {JSON.stringify({ antes: entry.before, después: entry.after }, null, 2)}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
