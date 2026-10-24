import type { Metadata } from "next";
import Link from "next/link";
import { hasRole, STAFF_ROLES } from "@/lib/roles";
import { requireRole } from "@/lib/session";

// The admin area is private and checks the session on every request, so it
// blocks on the server instead of streaming from a prerendered shell.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Administración", template: "%s · Administración" },
  robots: { index: false },
};

// Admin sections (PLAN §8); `roles` decides who sees each link.
const sections = [
  { href: "/admin", label: "Resumen", roles: STAFF_ROLES },
  { href: "/admin/investigacion", label: "Investigación", roles: ["admin"] },
  { href: "/admin/perfiles", label: "Perfiles", roles: ["admin"] },
  { href: "/admin/clasificacion", label: "Clasificación", roles: ["admin"] },
  { href: "/admin/moderacion", label: "Moderación", roles: STAFF_ROLES },
  { href: "/admin/feedback", label: "Mensajes", roles: STAFF_ROLES },
  { href: "/admin/usuarios", label: "Usuarios", roles: ["admin"] },
  { href: "/admin/configuracion", label: "Configuración", roles: ["admin"] },
  { href: "/admin/auditoria", label: "Auditoría", roles: ["admin"] },
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireRole(STAFF_ROLES);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:flex-row">
      <nav aria-label="Administración" className="md:w-48 md:shrink-0">
        <ul className="flex flex-wrap gap-2 md:flex-col">
          {sections
            .filter((s) => hasRole(user, s.roles))
            .map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="block rounded-md px-3 py-2 text-sm hover:bg-surface">
                  {s.label}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
