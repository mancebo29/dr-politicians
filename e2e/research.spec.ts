import { expect, test } from "@playwright/test";
import { promoteToAdmin } from "@/lib/admin/promote";
import { samplePayload } from "@/lib/research/fixtures";
import { e2eDb, register, uniqueUser } from "./support";

test("queue, claim, submit, review and publish a research job", async ({ page }) => {
  const admin = uniqueUser("rev");
  await register(page, admin);
  const db = e2eDb();
  try {
    await promoteToAdmin(db, admin.email);
  } finally {
    await db.$client.end();
  }

  await page.goto("/admin/investigacion/tokens");
  await page.getByPlaceholder("Ej.: portátil de Jairo").fill("e2e");
  await page.getByRole("button", { name: "Crear token" }).click();
  const token = (await page.getByTestId("new-token").textContent())!.trim();
  expect(token).toMatch(/^rt_/);

  const name = `Persona E2E ${Date.now()}`;
  await page.goto("/admin/investigacion");
  await page.getByPlaceholder("Nombre completo").fill(name);
  await page.getByRole("button", { name: "Agregar a la cola" }).click();
  await expect(page.getByRole("link", { name })).toBeVisible();

  const api = (path: string, data: unknown, bearer = token) =>
    page.request.post(`/api/research/${path}`, {
      data,
      headers: { authorization: `Bearer ${bearer}` },
    });

  expect((await api("claim", {}, "rt_invalid")).status()).toBe(401);
  const claim = await api("claim", {});
  const { brief } = await claim.json();
  expect(brief.job.requestedName).toBe(name);

  const invalid = await api("submit", { jobId: brief.job.id, payload: { schemaVersion: 1 } });
  expect(invalid.status()).toBe(422);

  const payload = samplePayload();
  payload.politician!.fullName = name;
  payload.politician!.knownAs = name;
  const submitted = await api("submit", { jobId: brief.job.id, payload });
  expect(submitted.status()).toBe(200);

  // Not public until approved; visiting first also fills the public caches
  // that publishing has to invalidate.
  const publicPath = `/politicos/${name.toLowerCase().replace(/ /g, "-")}`;
  await page.goto(publicPath);
  await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
  await page.goto(`/?q=${encodeURIComponent(name)}`);
  await expect(page.getByText("No encontramos políticos con esos criterios.")).toBeVisible();

  await page.goto(`/admin/investigacion/${brief.job.id}`);
  await expect(page.getByText("Pendiente de revisión")).toBeVisible();
  await expect(page.getByText("+ Senador — Senado de la República, Santiago")).toBeVisible();
  await page.getByPlaceholder("Nota de la revisión (opcional").fill("Perfil de prueba revisado");
  await page.getByRole("button", { name: "Aprobar y publicar" }).click();

  await expect(page).toHaveURL(/\/admin\/perfiles\//);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fuentes" })).toBeVisible();
  await expect(page.getByText("Perfil de prueba revisado")).toBeVisible();
  await expect(page.getByRole("link", { name: "Artículo A" })).toHaveAttribute(
    "href",
    "https://example.org/a",
  );

  await page.goto(publicPath);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.goto(`/?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link", { name })).toBeVisible();
});
