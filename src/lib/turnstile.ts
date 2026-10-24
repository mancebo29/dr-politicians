import { env, isProductionRuntime } from "@/lib/env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Field the Turnstile widget adds to the form it renders in.
export const TURNSTILE_FIELD = "cf-turnstile-response";

// Server-side Turnstile check for app forms; Better Auth's captcha plugin
// covers its own endpoints. Development without a secret skips the check so
// local runs and tests need no Cloudflare account; production fails closed.
export async function verifyTurnstile(
  token: string | null,
  remoteIp: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (isProductionRuntime) throw new Error("TURNSTILE_SECRET_KEY is not set");
    return true;
  }
  if (!token) return false;
  const response = await fetchImpl(SITEVERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret, response: token, ...(remoteIp && { remoteip: remoteIp }) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Turnstile siteverify answered ${response.status}`);
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}
