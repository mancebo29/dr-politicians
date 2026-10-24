import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass, Panel } from "@/components/admin/ui";
import { ProfileView } from "@/components/profile/profile-view";
import { db } from "@/db";
import { profileRevisions, users } from "@/db/schema";
import { loadProfile } from "@/lib/profiles/load";
import { requireRole } from "@/lib/session";
import { createJobAction } from "../../investigacion/actions";
import { RequestRefreshButton } from "./request-refresh";

export const metadata: Metadata = { title: "Perfil" };
export const instant = false;

export default async function AdminProfilePage({ params }: PageProps<"/admin/perfiles/[slug]">) {
  const { slug } = await params;
  await requireRole(["admin"], `/admin/perfiles/${slug}`);
  const profile = await loadProfile(db, { slug });
  if (!profile) notFound();
  const revisions = await db
    .select({ r: profileRevisions, actor: users.name })
    .from(profileRevisions)
    .leftJoin(users, eq(profileRevisions.actorUserId, users.id))
    .where(eq(profileRevisions.politicianId, profile.id))
    .orderBy(desc(profileRevisions.createdAt));

  return (
    <div>
      <Link href="/admin/perfiles" className="text-sm text-muted hover:underline">
        ← Perfiles
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Vista previa interna · estado: {profile.status}
          {profile.publishedAt && ` · publicado ${profile.publishedAt.toLocaleDateString("es-DO")}`}
        </p>
        <RequestRefreshButton
          action={createJobAction}
          politicianId={profile.id}
          className={buttonClass}
        />
      </div>
      <div className="mt-6">
        <ProfileView payload={profile.payload} />
      </div>
      <Panel title="Historial de revisiones">
        <ul className="space-y-2 text-sm">
          {revisions.map(({ r, actor }) => (
            <li key={r.id}>
              <span className="tabular-nums">{r.createdAt.toLocaleString("es-DO")}</span> ·{" "}
              {actor ?? "—"} · {r.note}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
