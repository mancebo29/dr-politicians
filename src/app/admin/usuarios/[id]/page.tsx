import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unbanUserAction, banUserAction } from "@/app/admin/moderacion/actions";
import { ActionForm } from "@/components/admin/action-form";
import { BanForm } from "@/components/admin/ban-form";
import {
  Badge,
  buttonClass,
  inputClass,
  PageTitle,
  Panel,
  secondaryButtonClass,
} from "@/components/admin/ui";
import { db } from "@/db";
import { commentReports, comments, politicians, sessions, userRoles, users } from "@/db/schema";
import { isBanned } from "@/lib/community/comments";
import { commentStatusLabel, reportResolutionLabel, roleLabel } from "@/lib/labels";
import { requireRole } from "@/lib/session";
import { deleteUserAction, revokeSessionsAction, setRoleAction } from "../actions";

export const metadata: Metadata = { title: "Cuenta" };
export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dateTime = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Santo_Domingo",
});

export default async function UserPage({ params }: PageProps<"/admin/usuarios/[id]">) {
  const { id } = await params;
  const { user: actor } = await requireRole(["admin"], `/admin/usuarios/${id}`);
  if (!UUID.test(id)) notFound();
  const [account] = await db.select().from(users).where(eq(users.id, id));
  if (!account) notFound();

  const [recentComments, reports, sessionCount] = await Promise.all([
    db
      .select({ comment: comments, slug: politicians.slug, name: politicians.fullName })
      .from(comments)
      .innerJoin(politicians, eq(politicians.id, comments.politicianId))
      .where(eq(comments.userId, id))
      .orderBy(desc(comments.createdAt))
      .limit(20),
    db
      .select({
        reason: commentReports.reason,
        createdAt: commentReports.createdAt,
        resolution: commentReports.resolution,
        body: comments.body,
      })
      .from(commentReports)
      .innerJoin(comments, eq(comments.id, commentReports.commentId))
      .where(eq(commentReports.reporterUserId, id))
      .orderBy(desc(commentReports.createdAt))
      .limit(20),
    db.$count(sessions, eq(sessions.userId, id)),
  ]);
  const self = actor.id === account.id;
  const banned = isBanned(account, new Date());

  return (
    <div>
      <PageTitle>{account.name}</PageTitle>
      <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">Usuario</dt>
        <dd>{account.username ? `@${account.username}` : "—"}</dd>
        <dt className="text-muted">Correo</dt>
        <dd className="break-all">
          {account.email}{" "}
          {account.emailVerified ? (
            <Badge tone="success">Verificado</Badge>
          ) : (
            <Badge>Sin verificar</Badge>
          )}
        </dd>
        <dt className="text-muted">Rol</dt>
        <dd>{roleLabel[account.role]}</dd>
        <dt className="text-muted">Alta</dt>
        <dd>{dateTime.format(account.createdAt)}</dd>
        <dt className="text-muted">Sesiones abiertas</dt>
        <dd>{sessionCount}</dd>
        {banned && (
          <>
            <dt className="text-muted">Suspensión</dt>
            <dd>
              <Badge tone="danger">Suspendida</Badge> {account.banReason}
              {account.banExpires
                ? ` · hasta ${dateTime.format(account.banExpires)}`
                : " · indefinida"}
            </dd>
          </>
        )}
      </dl>

      {self ? (
        <p className="mt-6 text-sm text-muted">
          Esta es tu cuenta. Otra persona administradora debe cambiar su rol o suspenderla.
        </p>
      ) : (
        <>
          <Panel title="Rol">
            <ActionForm
              action={setRoleAction.bind(null, account.id)}
              submitLabel="Cambiar rol"
              submitClassName={buttonClass}
              className="flex flex-wrap items-end gap-2"
            >
              <label className="flex flex-col gap-1 text-sm">
                Rol
                <select name="role" defaultValue={account.role} className={inputClass}>
                  {userRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel[role]}
                    </option>
                  ))}
                </select>
              </label>
            </ActionForm>
          </Panel>

          <Panel title="Suspensión y sesiones">
            <div className="space-y-4">
              {banned ? (
                <ActionForm
                  action={unbanUserAction.bind(null, account.id)}
                  submitLabel="Levantar suspensión"
                  submitClassName={buttonClass}
                />
              ) : (
                <BanForm action={banUserAction.bind(null, account.id)} />
              )}
              <ActionForm
                action={revokeSessionsAction.bind(null, account.id)}
                submitLabel="Cerrar todas sus sesiones"
                submitClassName={secondaryButtonClass}
              />
            </div>
          </Panel>

          <Panel title="Eliminar cuenta">
            <ActionForm
              action={deleteUserAction.bind(null, account.id)}
              submitLabel="Eliminar cuenta"
              submitClassName="rounded-md border border-danger px-3 py-1.5 text-sm font-medium text-danger"
            >
              <p className="text-sm text-muted">
                Borra la cuenta y sus datos de acceso. Sus comentarios se conservan como «usuario
                eliminado».
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="confirm" required />
                Entiendo que no se puede deshacer
              </label>
            </ActionForm>
          </Panel>
        </>
      )}

      <Panel title="Comentarios recientes">
        {recentComments.length === 0 ? (
          <p className="text-sm text-muted">Sin comentarios.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {recentComments.map(({ comment, slug, name }) => (
              <li key={comment.id}>
                <div className="flex flex-wrap items-center gap-2 text-muted">
                  <Badge>{commentStatusLabel[comment.status]}</Badge>
                  <Link href={`/politicos/${slug}#comentarios`} className="underline">
                    {name}
                  </Link>
                  · {dateTime.format(comment.createdAt)}
                </div>
                <p className="mt-1 break-words whitespace-pre-line">{comment.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Reportes enviados">
        {reports.length === 0 ? (
          <p className="text-sm text-muted">Sin reportes.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {reports.map((r, i) => (
              <li key={i}>
                <span className="text-muted">{dateTime.format(r.createdAt)} · </span>
                {r.reason}
                {r.resolution && (
                  <span className="text-muted">
                    {" "}
                    · resuelto: {reportResolutionLabel[r.resolution]}
                  </span>
                )}
                <p className="truncate text-muted">«{r.body}»</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="mt-6 text-sm">
        <Link href="/admin/usuarios" className="text-accent underline">
          ← Todas las cuentas
        </Link>
      </p>
    </div>
  );
}
