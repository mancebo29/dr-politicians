import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { env } from "@/lib/env";

export type Email = { to: string; subject: string; text: string; html: string };

let resend: Resend | undefined;

// Resend in production; in development and tests, emails are written to
// MAIL_OUTBOX_DIR (read by the e2e tests) or printed to the server log.
export async function sendEmail(email: Email): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM, MAIL_OUTBOX_DIR } = env();

  if (RESEND_API_KEY) {
    resend ??= new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: EMAIL_FROM, ...email });
    if (error) throw new Error(`Resend failed to send "${email.subject}": ${error.message}`);
    return;
  }

  if (MAIL_OUTBOX_DIR) {
    await mkdir(MAIL_OUTBOX_DIR, { recursive: true });
    const file = path.join(MAIL_OUTBOX_DIR, `${Date.now()}-${crypto.randomUUID()}.json`);
    await writeFile(file, JSON.stringify({ from: EMAIL_FROM, ...email, sentAt: new Date() }));
    return;
  }

  console.info(`[email] to=${email.to} subject="${email.subject}"\n${email.text}`);
}
