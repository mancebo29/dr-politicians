import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard, FormMessage } from "@/components/auth/form-parts";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = { title: "Restablecer contraseña" };

export default function ResetPasswordPage({ searchParams }: PageProps<"/restablecer-contrasena">) {
  return (
    <AuthCard title="Restablecer contraseña">
      <Suspense>
        <ResetPasswordContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

// Better Auth redirects here with ?token=… from the email link, or ?error=INVALID_TOKEN.
async function ResetPasswordContent({
  searchParams,
}: Pick<PageProps<"/restablecer-contrasena">, "searchParams">) {
  const { token } = await searchParams;
  if (typeof token === "string" && token) return <ResetPasswordForm token={token} />;
  return (
    <FormMessage tone="error">
      El enlace no es válido o ya venció.{" "}
      <Link href="/recuperar-contrasena" className="underline">
        Solicita uno nuevo
      </Link>
      .
    </FormMessage>
  );
}
