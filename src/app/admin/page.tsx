import { and, desc, eq, gt, inArray, ne } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import {
  comments,
  feedback,
  politicians,
  rankingRuns,
  refreshProposals,
  researchJobs,
  users,
} from "@/db/schema";
import { STAFF_ROLES } from "@/lib/roles";
import { requireRole } from "@/lib/session";

export const instant = false;

const runStatus = { running: "en curso", succeeded: "completada", failed: "con error" } as const;

export default async function AdminDashboard() {
  // The layout checks too, but pages render in parallel with layouts, so each
  // page enforces its own access.
  await requireRole(STAFF_ROLES);
  const [
    published,
    drafts,
    queued,
    accounts,
    refreshes,
    lastRanking,
    reported,
    pendingComments,
    openFeedback,
  ] = await Promise.all([
    db.$count(politicians, eq(politicians.status, "published")),
    db.$count(politicians, eq(politicians.status, "draft")),
    db.$count(researchJobs, eq(researchJobs.status, "queued")),
    db.$count(users),
    db.$count(refreshProposals, eq(refreshProposals.status, "pending")),
    db.select().from(rankingRuns).orderBy(desc(rankingRuns.startedAt)).limit(1),
    db.$count(comments, and(gt(comments.reportCount, 0), ne(comments.status, "deleted"))),
    db.$count(comments, eq(comments.status, "pending")),
    db.$count(feedback, inArray(feedback.status, ["new", "triaged"])),
  ]);

  const stats: { label: string; value: number; href?: string }[] = [
    { label: "Perfiles publicados", value: published },
    { label: "Perfiles en borrador", value: drafts },
    { label: "Investigaciones en cola", value: queued },
    { label: "Cuentas", value: accounts },
    { label: "Actualizaciones sugeridas", value: refreshes },
    { label: "Comentarios reportados", value: reported, href: "/admin/moderacion" },
    {
      label: "Comentarios pendientes",
      value: pendingComments,
      href: "/admin/moderacion?vista=pendientes",
    },
    { label: "Mensajes abiertos", value: openFeedback, href: "/admin/feedback" },
  ];

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
      <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border p-4">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {s.href ? (
                <Link href={s.href} className="hover:underline">
                  {s.value}
                </Link>
              ) : (
                s.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-muted">
        Última clasificación:{" "}
        {lastRanking[0] ? runStatus[lastRanking[0].status] : "todavía no ejecutada"}.
      </p>
    </section>
  );
}
