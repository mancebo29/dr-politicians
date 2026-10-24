import Link from "next/link";
import { getContentSettings } from "@/lib/public/data";

const links = [
  { href: "/metodologia", label: "Metodología" },
  { href: "/feedback", label: "Reportar un error" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Términos" },
];

export async function SiteFooter() {
  const { about } = await getContentSettings();
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        {about && <p>{about}</p>}
        <nav aria-label="Pie de página" className="flex flex-wrap gap-x-4 gap-y-1">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="underline-offset-4 hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
