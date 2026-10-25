import { expect, test } from "@playwright/test";
import { promoteToAdmin } from "@/lib/admin/promote";
import { samplePayload, sampleRoster } from "@/lib/research/fixtures";
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

test("queues a wave from a pasted list and reports skipped names", async ({ page }) => {
  const admin = uniqueUser("ola");
  await register(page, admin);
  const db = e2eDb();
  try {
    await promoteToAdmin(db, admin.email);
  } finally {
    await db.$client.end();
  }

  const stamp = Date.now();
  const first = `Primera Ola ${stamp}`;
  const second = `Segunda Ola ${stamp}`;
  await page.goto("/admin/investigacion");
  const form = page.locator("form", { has: page.locator('textarea[name="people"]') });
  await form
    .locator('textarea[name="people"]')
    .fill(`${first} | vicepresidenta\n${second}\n${first}\n`);
  await form.locator('input[name="wave"]').fill("1");
  await form.getByRole("button", { name: "Agregar personas a la cola" }).click();

  await expect(form.getByRole("status")).toContainText("2 en cola; 1 omitidas:");
  await expect(form.getByRole("status")).toContainText(`${first}: repetido en la lista`);
  await expect(page.getByRole("link", { name: first })).toBeVisible();
  await expect(page.getByRole("link", { name: second })).toBeVisible();
});

test("discovers a wave roster, approves part of it and chains the next segment", async ({
  page,
}) => {
  const admin = uniqueUser("descubre");
  await register(page, admin);
  const db = e2eDb();
  try {
    await promoteToAdmin(db, admin.email);
  } finally {
    await db.$client.end();
  }
  await page.goto("/admin/investigacion/tokens");
  await page.getByPlaceholder("Ej.: portátil de Jairo").fill("e2e-descubrimiento");
  await page.getByRole("button", { name: "Crear token" }).click();
  const token = (await page.getByTestId("new-token").textContent())!.trim();
  const api = (path: string, data: unknown) =>
    page.request.post(`/api/research/${path}`, {
      data,
      headers: { authorization: `Bearer ${token}` },
    });

  await page.goto("/admin/investigacion");
  const discovery = page.locator("form", { has: page.locator('select[name="segment"]') });
  await expect(discovery.locator("select")).toHaveValue("ola-1");
  await discovery.getByRole("button", { name: "Descubrir con IA" }).click();
  await expect(discovery.getByRole("status")).toContainText("Descubrimiento en cola");

  const { brief } = await (await api("claim", {})).json();
  expect(brief.job.kind).toBe("roster_discovery");
  expect(brief.segment.key).toBe("ola-1");
  const stamp = Date.now();
  const roster = sampleRoster();
  roster.people = roster.people.slice(0, 2).map((p, i) => ({
    ...p,
    fullName: `${p.fullName} ${stamp}-${i}`,
  }));
  expect((await api("submit", { jobId: brief.job.id, payload: roster })).status()).toBe(200);
  expect(await (await api("status", { jobId: brief.job.id })).json()).toMatchObject({
    status: "submitted",
  });

  await page.goto(`/admin/investigacion/${brief.job.id}`);
  await expect(page.getByRole("heading", { name: "Personas encontradas (2)" })).toBeVisible();
  await page.getByRole("checkbox", { name: `Incluir a ${roster.people[1].fullName}` }).uncheck();
  await page.getByRole("button", { name: "Aprobar y poner en cola las seleccionadas" }).click();

  await expect(page).toHaveURL(/\/admin\/investigacion$/);
  await expect(page.getByRole("link", { name: roster.people[0].fullName })).toBeVisible();
  await expect(page.getByRole("link", { name: roster.people[1].fullName })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ola 2 · Senado y gabinete" })).toBeVisible();
});
