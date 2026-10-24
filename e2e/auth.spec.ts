import { expect, test } from "@playwright/test";
import { latestEmailLink, register, signIn, signOut, uniqueUser } from "./support";

test("register, verify email, then sign in with username or email", async ({ page }) => {
  const user = uniqueUser("reg");
  await register(page, user);

  const verifyLink = await latestEmailLink(user.email, /Confirma tu correo/);
  await page.goto(verifyLink);
  await expect(page).toHaveURL(/verificado=1/);
  await expect(page.getByTestId("session-user")).toBeVisible();
  const session = await page.request.get("/api/auth/get-session");
  expect((await session.json()).user.emailVerified).toBe(true);

  await signOut(page);
  await signIn(page, user.username, user.password);
  await expect(page.getByTestId("session-user")).toBeVisible();

  await signOut(page);
  await signIn(page, user.email, user.password);
  await expect(page.getByTestId("session-user")).toBeVisible();
});

test("rejects a wrong password with a Spanish message", async ({ page }) => {
  const user = uniqueUser("bad");
  await register(page, user);
  await signOut(page);
  await signIn(page, user.username, "contraseña-incorrecta");
  await expect(page.locator("p[role=alert]")).toHaveText("Usuario o contraseña incorrectos.");
  await expect(page.getByTestId("session-user")).toHaveCount(0);
});

test("reset a forgotten password", async ({ page }) => {
  const user = uniqueUser("reset");
  await register(page, user);
  await signOut(page);

  await page.goto("/recuperar-contrasena");
  await page.getByLabel("Correo electrónico").fill(user.email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("status")).toContainText("te enviamos un enlace");

  await page.goto(await latestEmailLink(user.email, /Restablece tu contraseña/));
  await expect(page).toHaveURL(/\/restablecer-contrasena\?token=/);
  const newPassword = `${user.password}-nueva`;
  await page.getByLabel("Nueva contraseña").fill(newPassword);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("status")).toContainText("Contraseña actualizada");

  await signIn(page, user.username, user.password);
  await expect(page.locator("p[role=alert]")).toBeVisible();
  await signIn(page, user.username, newPassword);
  await expect(page.getByTestId("session-user")).toBeVisible();
});
