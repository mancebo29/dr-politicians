"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { Field, FormMessage, SubmitButton } from "./form-parts";

export function SignUpForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    setPending(true);
    setError(null);

    const { error } = await authClient.signUp.email({
      name: String(form.get("name")).trim(),
      username: String(form.get("username")).trim(),
      email,
      password: String(form.get("password")),
      callbackURL: "/?verificado=1",
    });

    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <FormMessage tone="success">
        Cuenta creada. Te enviamos un enlace a {sentTo} para confirmar tu correo; lo necesitas para
        comentar.
      </FormMessage>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Nombre" name="name" autoComplete="name" required maxLength={100} />
      <Field
        label="Nombre de usuario"
        name="username"
        autoComplete="username"
        required
        minLength={3}
        maxLength={30}
        pattern="[A-Za-z0-9_.]+"
        hint="Se muestra en tus comentarios. Letras, números, puntos y guiones bajos."
      />
      <Field label="Correo electrónico" name="email" type="email" autoComplete="email" required />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="Al menos 10 caracteres."
      />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <SubmitButton pending={pending}>Crear cuenta</SubmitButton>
      <p className="text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/iniciar-sesion" className="text-accent underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
