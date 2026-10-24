import { desc, ilike, or } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, buttonClass, inputClass, PageTitle } from "@/components/admin/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isBanned } from "@/lib/community/comments";
import { roleLabel } from "@/lib/labels";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Usuarios" };
export const instant = false;

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export default async function UsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  await requireRole(["admin"], "/admin/usuarios");
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim().slice(0, 100) : "";
  const pattern = `%${escapeLike(q)}%`;
  const rows = await db
    .select()
    .from(users)
    .where(
      q
        ? or(
            ilike(users.name, pattern),
            ilike(users.email, pattern),
            ilike(users.username, pattern),
          )
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(50);
  const now = new Date();

  return (
    <div>
      <PageTitle>Usuarios</PageTitle>
      <form className="mt-4 flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Nombre, correo o usuario"
          aria-label="Buscar cuentas"
          className={inputClass}
        />
        <button className={buttonClass}>Buscar</button>
      </form>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">Cuenta</th>
              <th className="py-2 pr-3 font-medium">Correo</th>
              <th className="py-2 pr-3 font-medium">Rol</th>
              <th className="py-2 pr-3 font-medium">Estado</th>
              <th className="py-2 font-medium">Alta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-muted">
                  No hay cuentas que coincidan.
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="py-2 pr-3">
                  <Link href={`/admin/usuarios/${u.id}`} className="font-medium hover:underline">
                    {u.name}
                  </Link>
                  {u.username && <span className="block text-muted">@{u.username}</span>}
                </td>
                <td className="py-2 pr-3 break-all">{u.email}</td>
                <td className="py-2 pr-3">{roleLabel[u.role]}</td>
                <td className="py-2 pr-3">
                  {isBanned(u, now) ? (
                    <Badge tone="danger">Suspendida</Badge>
                  ) : u.emailVerified ? (
                    <Badge tone="success">Verificada</Badge>
                  ) : (
                    <Badge>Sin verificar</Badge>
                  )}
                </td>
                <td className="py-2">{u.createdAt.toLocaleDateString("es-DO")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
