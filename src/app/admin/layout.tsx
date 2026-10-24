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

// Sections arrive in later milestones (PLAN §8); `roles` decides who sees each link.
const sections = [{ href: "/admin", label: "Resumen", roles: STAFF_ROLES }] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireRole(STAFF_ROLES);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:flex-row">
      <nav aria-label="Administración" className="md:w-48 md:shrink-0">
        <ul className="flex gap-2 md:flex-col">
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
