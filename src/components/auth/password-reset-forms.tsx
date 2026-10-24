"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Turnstile, turnstileEnabled } from "@/components/turnstile";
import { authErrorMessage } from "@/lib/auth-errors";
import { Field, FormMessage, SubmitButton } from "./form-parts";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/restablecer-contrasena",
      fetchOptions: captcha ? { headers: { "x-captcha-response": captcha } } : undefined,
    });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      setCaptcha(null);
      setAttempt((n) => n + 1);
    } else setSent(true);
  }

  if (sent) {
    // Same message whether or not the account exists, so the form can't be
    // used to discover registered emails.
    return (
      <FormMessage tone="success">
        Si existe una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña.
      </FormMessage>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Correo electrónico" name="email" type="email" autoComplete="email" required />
      <Turnstile key={attempt} action="recuperar" onToken={setCaptcha} />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <SubmitButton pending={pending} disabled={turnstileEnabled && !captcha}>
        Enviar enlace
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newPassword = String(new FormData(event.currentTarget).get("password"));
    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword, token });
    setPending(false);
    if (error) setError(authErrorMessage(error));
    else setDone(true);
  }

  if (done) {
    return (
      <FormMessage tone="success">
        Contraseña actualizada.{" "}
        <Link href="/iniciar-sesion" className="underline">
          Inicia sesión
        </Link>
        .
      </FormMessage>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field
        label="Nueva contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="Al menos 10 caracteres."
      />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <SubmitButton pending={pending}>Guardar contraseña</SubmitButton>
    </form>
  );
}
