import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import {
  Badge,
  buttonClass,
  inputClass,
  PageTitle,
  Panel,
  secondaryButtonClass,
} from "@/components/admin/ui";
import { db } from "@/db";
import { researchTokens } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { createTokenAction, revokeTokenAction } from "../actions";

export const metadata: Metadata = { title: "Tokens de investigación" };
export const instant = false;

export default async function ResearchTokensPage() {
  await requireRole(["admin"], "/admin/investigacion/tokens");
  const tokens = await db.select().from(researchTokens).orderBy(desc(researchTokens.createdAt));

  return (
    <div>
      <Link href="/admin/investigacion" className="text-sm text-muted hover:underline">
        ← Investigación
      </Link>
      <PageTitle>Tokens de investigación</PageTitle>
      <p className="mt-2 text-sm text-muted">
        La CLI de investigación (<code>pnpm research:*</code>) usa estos tokens como{" "}
        <code>RESEARCH_TOKEN</code>. Solo pueden reclamar y entregar investigaciones; no publican.
      </p>

      <Panel title="Crear token">
        <ActionForm
          action={createTokenAction}
          submitLabel="Crear token"
          submitClassName={buttonClass}
        >
          <input name="name" required className={inputClass} placeholder="Ej.: portátil de Jairo" />
        </ActionForm>
      </Panel>

      <ul className="mt-6 space-y-2 text-sm">
        {tokens.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2"
          >
            <div>
              <span className="font-medium">{t.name}</span>{" "}
              {t.revokedAt ? (
                <Badge tone="danger">Revocado</Badge>
              ) : (
                <Badge tone="success">Activo</Badge>
              )}
              <p className="text-xs text-muted">
                Creado {t.createdAt.toLocaleString("es-DO")} · último uso{" "}
                {t.lastUsedAt ? t.lastUsedAt.toLocaleString("es-DO") : "nunca"}
              </p>
            </div>
            {!t.revokedAt && (
              <form action={revokeTokenAction.bind(null, t.id)}>
                <button className={secondaryButtonClass}>Revocar</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
