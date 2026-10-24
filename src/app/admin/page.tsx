import { eq } from "drizzle-orm";
import { db } from "@/db";
import { politicians, researchJobs, users } from "@/db/schema";
import { STAFF_ROLES } from "@/lib/roles";
import { requireRole } from "@/lib/session";

export const instant = false;

export default async function AdminDashboard() {
  // The layout checks too, but pages render in parallel with layouts, so each
  // page enforces its own access.
  await requireRole(STAFF_ROLES);
  const [published, drafts, queued, accounts] = await Promise.all([
    db.$count(politicians, eq(politicians.status, "published")),
    db.$count(politicians, eq(politicians.status, "draft")),
    db.$count(researchJobs, eq(researchJobs.status, "queued")),
    db.$count(users),
  ]);

  const stats = [
    { label: "Perfiles publicados", value: published },
    { label: "Perfiles en borrador", value: drafts },
    { label: "Investigaciones en cola", value: queued },
    { label: "Cuentas", value: accounts },
  ];

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
      <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border p-4">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
