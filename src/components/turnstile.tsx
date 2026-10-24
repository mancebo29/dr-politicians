"use client";

import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Without a site key (development, tests) no widget renders and the server
// skips the check; see src/lib/turnstile.ts.
export const turnstileEnabled = Boolean(SITE_KEY);

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      language?: string;
      action?: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoading: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  scriptLoading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject());
    script.onerror = () => {
      scriptLoading = undefined;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

// Cloudflare Turnstile widget. Inside a <form> it adds the token as the
// cf-turnstile-response field; `onToken` also receives it (null on expiry).
// Tokens are single use: remount the widget (change its `key`) after a submit.
export function Turnstile({
  action,
  onToken,
}: {
  action?: string;
  onToken?: (token: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const tokenListener = useRef(onToken);

  useEffect(() => {
    tokenListener.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY) return;
    let widgetId: string | undefined;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) return;
        widgetId = turnstile.render(container.current, {
          sitekey: SITE_KEY,
          language: "es",
          action,
          callback: (token) => tokenListener.current?.(token),
          "expired-callback": () => tokenListener.current?.(null),
          "error-callback": () => tokenListener.current?.(null),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [action]);

  if (!SITE_KEY) return null;
  return <div ref={container} className="min-h-[65px]" />;
}
