import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { createDb, type Database } from "@/db/client";
import { politicians, popularitySnapshots } from "@/db/schema";
import { publishSampleProfiles } from "@/lib/public/sample-profiles";

export const MAIL_OUTBOX_DIR = ".tmp/e2e-mail";

export function e2eDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL is not set (see .env.example)");
  if (!new URL(url).pathname.endsWith("_e2e")) {
    throw new Error("E2E_DATABASE_URL must name a database ending in _e2e");
  }
  return url;
}

export function e2eDb() {
  return createDb(e2eDatabaseUrl(), { max: 1 });
}

// Public pages cache their reads, so everything the public specs look at is
// created before the server answers its first request. Profiles go through
// the real publish path; the draft and the ranking rows stand in for states
// that other features (admin edits, the weekly ranking job) produce.
export async function seedPublicSiteData(db: Database) {
  await publishSampleProfiles(db, { fillers: 16 });
  await db
    .insert(politicians)
    .values({ slug: "borrador-oculto", fullName: "José Borrador Oculto", status: "draft" });
  const ids = Object.fromEntries(
    (await db.select({ slug: politicians.slug, id: politicians.id }).from(politicians)).map((p) => [
      p.slug,
      p.id,
    ]),
  );
  await db.insert(popularitySnapshots).values([
    {
      weekStart: "2026-10-19",
      politicianId: ids["carlos-ficticio"],
      score: 9,
      rank: 1,
      rankDelta: 2,
    },
    { weekStart: "2026-10-19", politicianId: ids["maria-nunez"], score: 5, rank: 2 },
    { weekStart: "2026-10-19", politicianId: ids["jose-pena"], score: 3, rank: 3, rankDelta: -2 },
  ]);
}

export function uniqueUser(prefix = "u") {
  const id = Math.random().toString(36).slice(2, 8);
  return {
    name: `Prueba ${id}`,
    username: `${prefix}_${id}`,
    email: `${prefix}.${id}@example.org`,
    password: `clave-segura-${id}`,
  };
}

type OutboxEmail = { to: string; subject: string; text: string };

// Waits for the newest email sent to `to` whose subject matches, and returns
// the first link in it.
export async function latestEmailLink(to: string, subject: RegExp): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const files = (await readdir(MAIL_OUTBOX_DIR).catch(() => [])).sort().reverse();
        for (const file of files) {
          const email = JSON.parse(
            await readFile(path.join(MAIL_OUTBOX_DIR, file), "utf8"),
          ) as OutboxEmail;
          if (email.to === to && subject.test(email.subject)) {
            link = email.text.match(/https?:\/\/\S+/)?.[0];
            return Boolean(link);
          }
        }
        return false;
      },
      { message: `email to ${to} matching ${subject}`, timeout: 15_000 },
    )
    .toBe(true);
  return link!;
}

export async function register(page: Page, user: ReturnType<typeof uniqueUser>) {
  await page.goto("/registro");
  await page.getByLabel("Nombre", { exact: true }).fill(user.name);
  await page.getByLabel("Nombre de usuario").fill(user.username);
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("status")).toContainText(user.email);
  // Sign-up signs the new account in right away; verification gates commenting only.
  await expect(page.getByTestId("session-user")).toBeVisible();
}

export async function signIn(page: Page, identifier: string, password: string) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo o nombre de usuario").fill(identifier);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
}
