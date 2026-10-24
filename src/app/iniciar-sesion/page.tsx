import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/form-parts";
import { GoogleButton } from "@/components/auth/google-button";
import { SignInForm } from "@/components/auth/sign-in-form";
import { googleEnabled } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function SignInPage({ searchParams }: PageProps<"/iniciar-sesion">) {
  return (
    <AuthCard title="Iniciar sesión">
      <Suspense>
        <SignInOptions searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

// Reads ?next= at request time, so it streams in behind the page's static shell.
async function SignInOptions({ searchParams }: Pick<PageProps<"/iniciar-sesion">, "searchParams">) {
  const next = safeRedirectPath((await searchParams).next);
  return (
    <>
      {googleEnabled && <GoogleButton next={next} />}
      <SignInForm next={next} />
    </>
  );
}
