import { z } from "zod";

// `next build` runs with NODE_ENV=production but only needs to compile, so
// provider credentials are enforced when the production server starts instead.
const isProductionRuntime =
  process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";

// Google and Resend are optional outside production so the app, tests, and CI
// run without third-party credentials: Google sign-in is hidden and emails go
// to the dev mail transport (see src/lib/email.ts).
const requiredInProduction = isProductionRuntime ? z.string().min(1) : z.string().min(1).optional();

const schema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: requiredInProduction,
  GOOGLE_CLIENT_SECRET: requiredInProduction,
  RESEND_API_KEY: requiredInProduction,
  EMAIL_FROM: z.string().min(1).default("Políticos RD <no-reply@localhost>"),
  MAIL_OUTBOX_DIR: z.string().min(1).optional(),
  // Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`. Without it
  // the cron endpoints refuse every request.
  CRON_SECRET: requiredInProduction,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  // Blank lines like `GOOGLE_CLIENT_ID=` in .env files mean "not set".
  const present = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
  const parsed = schema.safeParse(present);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}
