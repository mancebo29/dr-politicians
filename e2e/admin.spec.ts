import { expect, test } from "@playwright/test";
import { promoteToAdmin } from "@/lib/admin/promote";
import { e2eDb, register, uniqueUser } from "./support";

test("anonymous visitors are sent to sign in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/iniciar-sesion\?next=%2Fadmin$/);
});

test("regular users cannot reach the admin area or admin APIs; admins can", async ({ page }) => {
  const user = uniqueUser("adm");
  await register(page, user);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/acceso-denegado$/);
  await expect(page.getByRole("heading", { name: "Acceso denegado" })).toBeVisible();
  const denied = await page.request.get("/api/auth/admin/list-users");
  expect([401, 403]).toContain(denied.status());
  await expect(page.getByRole("link", { name: "Administración" })).toHaveCount(0);

  const db = e2eDb();
  try {
    await promoteToAdmin(db, user.email);
  } finally {
    await db.$client.end();
  }

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  await expect(page.getByText("Cuentas")).toBeVisible();
  await expect(page.getByRole("link", { name: "Administración" })).toBeVisible();
  const allowed = await page.request.get("/api/auth/admin/list-users");
  expect(allowed.status()).toBe(200);
});
