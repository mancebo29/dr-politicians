import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, captcha, username } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { passwordResetEmail, verificationEmail } from "@/lib/auth-emails";
import { sendEmail } from "@/lib/email";
import { env, isProductionRuntime } from "@/lib/env";
import { loadSetting } from "@/lib/site-settings";

const config = env();

// Account creation honours the registration settings (PLAN §8.3). Paths
// other than sign-up and the OAuth callback (e.g. trusted scripts) are not
// public registration and stay allowed.
async function assertRegistrationOpen(path: string | undefined) {
  const method = path?.startsWith("/sign-up")
    ? "password"
    : path?.startsWith("/callback")
      ? "google"
      : null;
  if (!method) return;
  const settings = await loadSetting(db, "registration");
  if (!settings.enabled || !settings[method]) {
    throw new APIError("FORBIDDEN", {
      code: "REGISTRATION_CLOSED",
      message: "Registration is closed",
    });
  }
}

export const googleEnabled = Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  appName: "Políticos RD",
  baseURL: config.BETTER_AUTH_URL,
  secret: config.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  advanced: { database: { generateId: "uuid" } },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Unverified accounts can sign in; commenting requires a verified email (PLAN §7.3).
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(passwordResetEmail(user.email, url));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(verificationEmail(user.email, url));
    },
  },
  databaseHooks: {
    user: { create: { before: async (_user, ctx) => assertRegistrationOpen(ctx?.path) } },
  },
  // On by default in production only; the database store keeps the limits
  // shared across serverless instances.
  rateLimit: { storage: "database" },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: config.GOOGLE_CLIENT_ID!,
          clientSecret: config.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    // Without a secret, development skips Turnstile; production keeps the
    // plugin so the requests fail instead of going unprotected.
    ...(config.TURNSTILE_SECRET_KEY || isProductionRuntime
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: config.TURNSTILE_SECRET_KEY ?? "",
            endpoints: ["/sign-up/email", "/request-password-reset"],
          }),
        ]
      : []),
    // Must stay last so cookies set inside server actions reach the browser.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
