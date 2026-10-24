"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { Field, FormMessage, SubmitButton } from "./form-parts";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier")).trim();
    const password = String(form.get("password"));
    setPending(true);
    setError(null);

    const { error } = identifier.includes("@")
      ? await authClient.signIn.email({ email: identifier, password })
      : await authClient.signIn.username({ username: identifier, password });

    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field
        label="Correo o nombre de usuario"
        name="identifier"
        autoComplete="username"
        required
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <SubmitButton pending={pending}>Iniciar sesión</SubmitButton>
      <div className="flex justify-between text-sm">
        <Link
          href="/recuperar-contrasena"
          className="text-accent underline-offset-4 hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href="/registro" className="text-accent underline-offset-4 hover:underline">
          Crear cuenta
        </Link>
      </div>
    </form>
  );
}
