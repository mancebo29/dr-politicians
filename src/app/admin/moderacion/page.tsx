import { and, desc, eq, gt, inArray, isNull, ne, type SQL } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { BanForm } from "@/components/admin/ban-form";
import { Badge, buttonClass, PageTitle, secondaryButtonClass } from "@/components/admin/ui";
import { db } from "@/db";
import { commentReports, comments, politicians, users } from "@/db/schema";
import { isBanned } from "@/lib/community/comments";
import type { ModerationAction } from "@/lib/community/moderation";
import { commentStatusLabel } from "@/lib/labels";
import { STAFF_ROLES } from "@/lib/roles";
import { requireRole } from "@/lib/session";
import { banUserAction, moderateCommentAction } from "./actions";

export const metadata: Metadata = { title: "Moderación" };
export const instant = false;

const views = {
  reportados: {
    label: "Reportados",
    where: and(gt(comments.reportCount, 0), ne(comments.status, "deleted")),
  },
  pendientes: { label: "Pendientes", where: eq(comments.status, "pending") },
  ocultos: { label: "Ocultos", where: eq(comments.status, "hidden") },
} satisfies Record<string, { label: string; where: SQL | undefined }>;
type View = keyof typeof views;

const dateTime = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Santo_Domingo",
});

const statusTone = {
  visible: "success",
  pending: "info",
  hidden: "danger",
  deleted: "neutral",
} as const;

const actionsFor: Record<string, [ModerationAction, string][]> = {
  pending: [
    ["approve", "Aprobar"],
    ["delete", "Eliminar"],
  ],
  hidden: [
    ["restore", "Restaurar"],
    ["delete", "Eliminar"],
  ],
  visible: [
    ["dismiss", "Descartar reportes"],
    ["hide", "Ocultar"],
    ["delete", "Eliminar"],
  ],
};

export default async function ModerationPage({ searchParams }: PageProps<"/admin/moderacion">) {
  const { user } = await requireRole(STAFF_ROLES, "/admin/moderacion");
  const requested = (await searchParams).vista;
  const view: View =
    typeof requested === "string" && Object.hasOwn(views, requested)
      ? (requested as View)
      : "reportados";

  const rows = await db
    .select({
      comment: comments,
      politician: { slug: politicians.slug, name: politicians.fullName },
      author: {
        id: users.id,
        username: users.username,
        role: users.role,
        banned: users.banned,
        banExpires: users.banExpires,
      },
    })
    .from(comments)
    .innerJoin(politicians, eq(politicians.id, comments.politicianId))
    .leftJoin(users, eq(users.id, comments.userId))
    .where(views[view].where)
    .orderBy(desc(comments.reportCount), desc(comments.createdAt))
    .limit(100);

  const ids = rows.map((r) => r.comment.id);
  const reports = ids.length
    ? await db
        .select({ commentId: commentReports.commentId, reason: commentReports.reason })
        .from(commentReports)
        .where(and(inArray(commentReports.commentId, ids), isNull(commentReports.resolvedAt)))
    : [];
  const reasons = Map.groupBy(reports, (r) => r.commentId);
  const now = new Date();

  return (
    <div>
      <PageTitle>Moderación</PageTitle>
      <nav aria-label="Vistas de moderación" className="mt-4 flex gap-2">
        {Object.entries(views).map(([key, v]) => (
          <Link
            key={key}
            href={`/admin/moderacion?vista=${key}`}
            aria-current={key === view ? "page" : undefined}
            className={key === view ? buttonClass : secondaryButtonClass}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          No hay comentarios en esta vista.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map(({ comment, politician, author }) => {
            const open = reasons.get(comment.id) ?? [];
            const canBan =
              author?.id &&
              author.id !== user.id &&
              !isBanned(author, now) &&
              (user.role === "admin" || author.role === "user");
            return (
              <li
                key={comment.id}
                data-testid="moderation-item"
                className="rounded-lg border border-border p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={statusTone[comment.status]}>
                    {commentStatusLabel[comment.status]}
                  </Badge>
                  {comment.reportCount > 0 && (
                    <Badge tone="danger">
                      {comment.reportCount} {comment.reportCount === 1 ? "reporte" : "reportes"}
                    </Badge>
                  )}
                  <span className="font-medium">{author?.username ?? "Usuario eliminado"}</span>
                  {author && isBanned(author, now) && <Badge>Suspendida</Badge>}
                  <span className="text-muted">
                    en{" "}
                    <Link href={`/politicos/${politician.slug}#comentarios`} className="underline">
                      {politician.name}
                    </Link>{" "}
                    · {dateTime.format(comment.createdAt)}
                  </span>
                  {author?.id && user.role === "admin" && (
                    <Link href={`/admin/usuarios/${author.id}`} className="text-accent underline">
                      Ver cuenta
                    </Link>
                  )}
                </div>
                <p className="mt-2 text-sm break-words whitespace-pre-line">{comment.body}</p>
                {open.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                    {open.map((r, i) => (
                      <li key={i}>{r.reason}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(actionsFor[comment.status] ?? []).map(([action, label]) => (
                    <form
                      key={action}
                      action={moderateCommentAction.bind(null, comment.id, action)}
                    >
                      <button
                        className={
                          action === "delete" || action === "hide"
                            ? secondaryButtonClass
                            : buttonClass
                        }
                      >
                        {label}
                      </button>
                    </form>
                  ))}
                </div>
                {canBan && (
                  <div className="mt-3 border-t border-border pt-3">
                    <BanForm action={banUserAction.bind(null, author.id)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
