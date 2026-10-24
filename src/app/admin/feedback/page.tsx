import { desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import {
  Badge,
  buttonClass,
  inputClass,
  PageTitle,
  secondaryButtonClass,
} from "@/components/admin/ui";
import { db } from "@/db";
import { feedback, politicians, users } from "@/db/schema";
import { type ProfileSection, profileSections } from "@/lib/community/profile-sections";
import { feedbackKindLabel, feedbackStatusLabel } from "@/lib/labels";
import { hasRole, STAFF_ROLES } from "@/lib/roles";
import { requireRole } from "@/lib/session";
import { closeFeedbackAction, feedbackToResearchAction, triageFeedbackAction } from "./actions";

export const metadata: Metadata = { title: "Mensajes" };
export const instant = false;

type Status = (typeof feedback.status.enumValues)[number];
const filters = {
  abiertos: { label: "Abiertos", statuses: ["new", "triaged"] },
  resueltos: { label: "Resueltos", statuses: ["resolved"] },
  descartados: { label: "Descartados", statuses: ["dismissed"] },
} satisfies Record<string, { label: string; statuses: Status[] }>;
type Filter = keyof typeof filters;

const statusTone = {
  new: "info",
  triaged: "neutral",
  resolved: "success",
  dismissed: "neutral",
} as const;

const dateTime = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Santo_Domingo",
});

export default async function FeedbackInboxPage({ searchParams }: PageProps<"/admin/feedback">) {
  const { user } = await requireRole(STAFF_ROLES, "/admin/feedback");
  const isAdmin = hasRole(user, ["admin"]);
  const requested = (await searchParams).estado;
  const filter: Filter =
    typeof requested === "string" && Object.hasOwn(filters, requested)
      ? (requested as Filter)
      : "abiertos";

  const rows = await db
    .select({
      item: feedback,
      politician: { slug: politicians.slug, name: politicians.fullName },
      username: users.username,
    })
    .from(feedback)
    .leftJoin(politicians, eq(politicians.id, feedback.politicianId))
    .leftJoin(users, eq(users.id, feedback.userId))
    .where(inArray(feedback.status, filters[filter].statuses))
    .orderBy(desc(feedback.createdAt))
    .limit(100);

  return (
    <div>
      <PageTitle>Mensajes y correcciones</PageTitle>
      <nav aria-label="Filtrar mensajes" className="mt-4 flex gap-2">
        {Object.entries(filters).map(([key, f]) => (
          <Link
            key={key}
            href={`/admin/feedback?estado=${key}`}
            aria-current={key === filter ? "page" : undefined}
            className={key === filter ? buttonClass : secondaryButtonClass}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          No hay mensajes en esta vista.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map(({ item, politician, username }) => (
            <li
              key={item.id}
              data-testid="feedback-item"
              className="rounded-lg border border-border p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={statusTone[item.status]}>{feedbackStatusLabel[item.status]}</Badge>
                <span className="font-medium">{feedbackKindLabel[item.kind]}</span>
                {politician && (
                  <span>
                    ·{" "}
                    <Link href={`/politicos/${politician.slug}`} className="underline">
                      {politician.name}
                    </Link>
                    {item.section &&
                      ` (${profileSections[item.section as ProfileSection] ?? item.section})`}
                  </span>
                )}
                <span className="text-muted">
                  · {dateTime.format(item.createdAt)} · {username ? `@${username}` : "anónimo"}
                </span>
              </div>
              <p className="mt-2 text-sm break-words whitespace-pre-line">{item.message}</p>
              <dl className="mt-2 space-y-1 text-sm">
                {item.sourceUrl && (
                  <div>
                    <dt className="inline text-muted">Fuente: </dt>
                    <dd className="inline break-all">
                      <a
                        href={item.sourceUrl}
                        rel="noopener noreferrer nofollow"
                        className="text-accent underline"
                      >
                        {item.sourceUrl}
                      </a>
                    </dd>
                  </div>
                )}
                {item.contactEmail && (
                  <div>
                    <dt className="inline text-muted">Contacto: </dt>
                    <dd className="inline">
                      <a href={`mailto:${item.contactEmail}`} className="underline">
                        {item.contactEmail}
                      </a>
                    </dd>
                  </div>
                )}
                {item.researchJobId && (
                  <div>
                    <dt className="inline text-muted">Investigación: </dt>
                    <dd className="inline">
                      <Link
                        href={`/admin/investigacion/${item.researchJobId}`}
                        className="text-accent underline"
                      >
                        ver trabajo
                      </Link>
                    </dd>
                  </div>
                )}
                {item.resolutionNote && (
                  <div>
                    <dt className="inline text-muted">Nota: </dt>
                    <dd className="inline">{item.resolutionNote}</dd>
                  </div>
                )}
              </dl>

              {(item.status === "new" || item.status === "triaged") && (
                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  <div className="flex flex-wrap gap-2">
                    {item.status === "new" && (
                      <form action={triageFeedbackAction.bind(null, item.id)}>
                        <button className={secondaryButtonClass}>Marcar en curso</button>
                      </form>
                    )}
                    {isAdmin && item.politicianId && !item.researchJobId && (
                      <ActionForm
                        action={feedbackToResearchAction.bind(null, item.id)}
                        submitLabel="Crear investigación de corrección"
                        submitClassName={secondaryButtonClass}
                      />
                    )}
                  </div>
                  <ActionForm
                    action={closeFeedbackAction.bind(null, item.id)}
                    submitLabel="Cerrar mensaje"
                    submitClassName={buttonClass}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <label className="flex flex-col gap-1 text-sm">
                      Resultado
                      <select name="status" defaultValue="resolved" className={inputClass}>
                        <option value="resolved">Resuelto</option>
                        <option value="dismissed">Descartado</option>
                      </select>
                    </label>
                    <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
                      Nota de resolución
                      <input name="note" required maxLength={1000} className={inputClass} />
                    </label>
                  </ActionForm>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
