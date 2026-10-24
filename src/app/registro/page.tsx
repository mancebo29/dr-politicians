import type { Metadata } from "next";
import { AuthCard, FormMessage } from "@/components/auth/form-parts";
import { GoogleButton } from "@/components/auth/google-button";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { googleEnabled } from "@/lib/auth";
import { getRegistrationSettings } from "@/lib/public/data";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignUpPage() {
  const registration = await getRegistrationSettings();
  const google = googleEnabled && registration.enabled && registration.google;
  const password = registration.enabled && registration.password;
  return (
    <AuthCard title="Crear cuenta">
      {!google && !password && (
        <FormMessage tone="error">
          El registro de cuentas nuevas está cerrado en este momento.
        </FormMessage>
      )}
      {google && <GoogleButton next="/" />}
      {password && <SignUpForm />}
    </AuthCard>
  );
}
