import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { politicians, rankingRuns, refreshProposals } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { decideRefreshProposalAction } from "./actions";

export const instant = false;

const dateTime = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Santo_Domingo",
});
const runStatus = { running: "En curso", succeeded: "Completada", failed: "Con error" } as const;

export default async function RankingAdminPage() {
  await requireRole(["admin"], "/admin/clasificacion");
  const [proposals, runs] = await Promise.all([
    db
      .select({
        id: refreshProposals.id,
        weekStart: refreshProposals.weekStart,
        rank: refreshProposals.rank,
        profileUpdatedAt: refreshProposals.profileUpdatedAt,
        name: politicians.fullName,
      })
      .from(refreshProposals)
      .innerJoin(politicians, eq(politicians.id, refreshProposals.politicianId))
      .where(eq(refreshProposals.status, "pending"))
      .orderBy(refreshProposals.rank),
    db.select().from(rankingRuns).orderBy(desc(rankingRuns.startedAt)).limit(10),
  ]);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Clasificación semanal</h1>
      <p className="mt-2 text-sm text-muted">
        Ejecuciones del ranking y perfiles antiguos sugeridos para una nueva investigación.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Actualizaciones sugeridas</h2>
      {proposals.length ? (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  #{proposal.rank} · {proposal.name}
                </p>
                <p className="text-sm text-muted">
                  Semana {proposal.weekStart} · perfil actualizado{" "}
                  {dateTime.format(proposal.profileUpdatedAt)}
                </p>
              </div>
              <form action={decideRefreshProposalAction.bind(null, proposal.id, "approved")}>
                <button className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
                  Aprobar
                </button>
              </form>
              <form action={decideRefreshProposalAction.bind(null, proposal.id, "dismissed")}>
                <button className="rounded-md border border-border px-3 py-2 text-sm">
                  Descartar
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          No hay actualizaciones pendientes de aprobación.
        </p>
      )}

      <h2 className="mt-8 text-lg font-semibold">Últimas ejecuciones</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Inicio</th>
              <th className="px-3 py-2 font-medium">Semana</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Artículos</th>
              <th className="px-3 py-2 font-medium">Perfiles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.map((run) => (
              <tr key={run.id}>
                <td className="px-3 py-2">{dateTime.format(run.startedAt)}</td>
                <td className="px-3 py-2">{run.weekStart}</td>
                <td className="px-3 py-2">{runStatus[run.status]}</td>
                <td className="px-3 py-2 tabular-nums">{run.articlesIngested ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{run.politiciansRanked ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
