"use server";

import { headers } from "next/headers";
import { db } from "@/db";
import { CommunityError } from "@/lib/community/comments";
import { submitFeedback } from "@/lib/community/feedback";
import { clientFingerprint, clientIp, consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { TURNSTILE_FIELD, verifyTurnstile } from "@/lib/turnstile";

export type FeedbackState = { error?: string; sent?: boolean } | null;

function field(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

// Anyone may send feedback (PLAN §7.5); anonymous senders pass Turnstile.
export async function submitFeedbackAction(
  _: FeedbackState,
  form: FormData,
): Promise<FeedbackState> {
  const session = await getSession();
  const requestHeaders = await headers();
  if (!session) {
    const passed = await verifyTurnstile(
      field(form, TURNSTILE_FIELD) || null,
      clientIp(requestHeaders),
    );
    if (!passed) return { error: "Completa la verificación de seguridad e inténtalo de nuevo." };
  }

  const subject = session ? `user:${session.user.id}` : `ip:${clientFingerprint(requestHeaders)}`;
  if (!(await consumeRateLimit(db, `feedback:${subject}`, RATE_LIMITS.feedback))) {
    return { error: "Recibimos varios mensajes seguidos tuyos. Inténtalo de nuevo más tarde." };
  }

  try {
    await submitFeedback(db, {
      kind: field(form, "kind") as Parameters<typeof submitFeedback>[1]["kind"],
      message: field(form, "message"),
      politicianSlug: field(form, "politicianSlug"),
      section: field(form, "section"),
      sourceUrl: field(form, "sourceUrl"),
      contactEmail: field(form, "contactEmail"),
      userId: session?.user.id ?? null,
    });
  } catch (error) {
    if (error instanceof CommunityError) return { error: error.message };
    throw error;
  }
  return { sent: true };
}
