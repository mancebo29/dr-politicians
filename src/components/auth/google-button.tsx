"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { FormMessage } from "./form-parts";

export function GoogleButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: next });
    // On success the browser is already navigating to Google.
    if (error) {
      setError(authErrorMessage(error));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className="rounded-md border border-border px-4 py-2 font-medium disabled:opacity-60"
      >
        Continuar con Google
      </button>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
