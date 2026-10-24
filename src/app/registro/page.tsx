import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/form-parts";
import { GoogleButton } from "@/components/auth/google-button";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { googleEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <AuthCard title="Crear cuenta">
      {googleEnabled && <GoogleButton next="/" />}
      <SignUpForm />
    </AuthCard>
  );
}
