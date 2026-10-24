import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/form-parts";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Recuperar contraseña">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
