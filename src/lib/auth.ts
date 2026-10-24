import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { passwordResetEmail, verificationEmail } from "@/lib/auth-emails";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

const config = env();

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
    // Must stay last so cookies set inside server actions reach the browser.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
