"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { type FeedbackState, submitFeedbackAction } from "@/app/(public)/feedback/actions";
import { Turnstile, turnstileEnabled } from "@/components/turnstile";
import { authClient } from "@/lib/auth-client";
import { type ProfileSection, profileSections } from "@/lib/community/profile-sections";
import { feedbackKindLabel } from "@/lib/labels";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-accent";
const labelClass = "flex flex-col gap-1.5 text-sm font-medium";

export function FeedbackForm({
  politician,
  section,
}: {
  politician: { slug: string; name: string } | null;
  section: ProfileSection | null;
}) {
  const { data: session, isPending } = authClient.useSession();
  const [attempt, setAttempt] = useState(0);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: FeedbackState, form: FormData) => {
      const result = await submitFeedbackAction(previous, form);
      // Turnstile tokens are single use; a new widget gives a fresh one.
      setAttempt((n) => n + 1);
      setCaptcha(null);
      return result;
    },
    null,
  );
  const needsCaptcha = !isPending && !session && turnstileEnabled;

  if (state?.sent) {
    return (
      <div role="status" className="rounded-lg border border-success p-4">
        <p className="font-medium text-success">Gracias, recibimos tu mensaje.</p>
        <p className="mt-1 text-sm">
          Una persona del equipo lo revisará.{" "}
          {politician ? (
            <Link href={`/politicos/${politician.slug}`} className="text-accent underline">
              Volver al perfil de {politician.name}
            </Link>
          ) : (
            <Link href="/" className="text-accent underline">
              Volver al inicio
            </Link>
          )}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {politician && (
        <>
          <input type="hidden" name="politicianSlug" value={politician.slug} />
          <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
            Sobre el perfil de <strong>{politician.name}</strong>
          </p>
        </>
      )}
      <label className={labelClass}>
        Tipo de mensaje
        <select
          name="kind"
          required
          defaultValue={politician ? "correction" : "suggestion"}
          className={inputClass}
        >
          {Object.entries(feedbackKindLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {politician && (
        <label className={labelClass}>
          Sección del perfil
          <select name="section" defaultValue={section ?? ""} className={inputClass}>
            <option value="">Todo el perfil</option>
            {Object.entries(profileSections).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={labelClass}>
        Mensaje
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Fuente que respalda la corrección (opcional)
        <input name="sourceUrl" type="url" placeholder="https://" className={inputClass} />
      </label>
      <label className={labelClass}>
        Correo para responderte (opcional)
        <input
          name="contactEmail"
          type="email"
          autoComplete="email"
          defaultValue={session?.user.email ?? ""}
          key={session?.user.email ?? "anon"}
          className={inputClass}
        />
        <span className="text-xs font-normal text-muted">
          Solo lo usamos para responder a este mensaje. Ver la{" "}
          <Link href="/privacidad" className="underline">
            política de privacidad
          </Link>
          .
        </span>
      </label>
      {needsCaptcha && <Turnstile key={attempt} action="feedback" onToken={setCaptcha} />}
      {state?.error && (
        <p role="alert" className="rounded-md border border-danger px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={pending || (needsCaptcha && !captcha)}
          className="rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground disabled:opacity-60"
        >
          {pending ? "Un momento…" : "Enviar mensaje"}
        </button>
      </div>
    </form>
  );
}
