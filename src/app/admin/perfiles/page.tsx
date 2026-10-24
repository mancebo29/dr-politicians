import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageTitle } from "@/components/admin/ui";
import { db } from "@/db";
import { parties, politicians } from "@/db/schema";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Perfiles" };
export const instant = false;

const statusLabel = { draft: "Borrador", published: "Publicado", archived: "Archivado" } as const;

export default async function ProfilesPage() {
  await requireRole(["admin"], "/admin/perfiles");
  const rows = await db
    .select({ p: politicians, party: parties.acronym })
    .from(politicians)
    .leftJoin(parties, eq(politicians.currentPartyId, parties.id))
    .orderBy(desc(politicians.updatedAt));

  return (
    <div>
      <PageTitle>Perfiles</PageTitle>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          Aún no hay perfiles. Se crean al aprobar una investigación.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {rows.map(({ p, party }) => (
            <li
              key={p.id}
              className="flex items-center justify-between border-b border-border pb-2"
            >
              <Link href={`/admin/perfiles/${p.slug}`} className="font-medium hover:underline">
                {p.knownAs ?? p.fullName}
              </Link>
              <span className="flex items-center gap-2 text-sm text-muted">
                {party}
                <Badge tone={p.status === "published" ? "success" : "neutral"}>
                  {statusLabel[p.status]}
                </Badge>
                actualizado {p.updatedAt.toLocaleDateString("es-DO")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
