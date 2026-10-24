import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { MAIL_OUTBOX_DIR } from "./e2e/support";

config({ path: ".env.local", quiet: true });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// Runs against `next dev` because production mode requires real Google and
// Resend credentials. Stop any other `pnpm dev` first; Next allows one dev
// server per project directory.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    // Pages read the database (the footer reads site settings), so probe a
    // route that does not while globalSetup recreates the E2E schema.
    url: `${baseURL}/robots.txt`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
      BETTER_AUTH_URL: baseURL,
      MAIL_OUTBOX_DIR,
      // Never reach real providers from tests, even if .env.local has keys.
      RESEND_API_KEY: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
  },
});
