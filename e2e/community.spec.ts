import { type Browser, expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { comments, researchJobs, users } from "@/db/schema";
import { promoteToAdmin } from "@/lib/admin/promote";
import { e2eDb, latestEmailLink, register, signIn, uniqueUser } from "./support";

// Phase 5 acceptance (PLAN §11): comment, reply, edit window, report →
// auto-hide → moderator restore, banned users cannot post, settings changes
// take effect, and feedback reaches the admin inbox.

const PROFILE = "/politicos/jose-pena";

async function withDb<T>(work: (db: ReturnType<typeof e2eDb>) => Promise<T>) {
  const db = e2eDb();
  try {
    return await work(db);
  } finally {
    await db.$client.end();
  }
}

// A signed-in account with a confirmed email, in its own browser context.
async function verifiedUser(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  const user = uniqueUser(prefix);
  await register(page, user);
  await page.goto(await latestEmailLink(user.email, /Confirma tu correo/));
  await expect(page.getByTestId("session-user")).toBeVisible();
  return { page, user };
}

async function staff(browser: Browser, role: "admin" | "moderator") {
  const account = await verifiedUser(browser, role === "admin" ? "adm" : "mod");
  await withDb(async (db) => {
    if (role === "admin") await promoteToAdmin(db, account.user.email);
    else await db.update(users).set({ role }).where(eq(users.email, account.user.email));
  });
  return account;
}

const commentsSection = (page: Page) => page.locator("#comentarios");
const commentBy = (page: Page, username: string, text: string) =>
  commentsSection(page)
    .getByRole("article", { name: `Comentario de ${username}` })
    .filter({
      hasText: text,
    });

async function threadLoaded(page: Page) {
  await expect(commentsSection(page).getByText("Cargando comentarios…")).toHaveCount(0);
}

async function postComment(page: Page, text: string) {
  await page.goto(`${PROFILE}#comentarios`);
  await commentsSection(page).getByLabel("Escribe un comentario").fill(text);
  await commentsSection(page).getByRole("button", { name: "Publicar comentario" }).click();
}

// Saves one panel of /admin/configuracion after `edit` changes its fields.
async function saveSettings(
  page: Page,
  panel: string,
  edit: (section: ReturnType<Page["locator"]>) => Promise<void>,
) {
  await page.goto("/admin/configuracion");
  const section = page.locator("section", {
    has: page.getByRole("heading", { name: panel, exact: true }),
  });
  await edit(section);
  await section.getByRole("button", { name: "Guardar" }).click();
  await expect(section.getByRole("status")).toHaveText("Guardado.");
}

test.describe.configure({ timeout: 120_000 });

test("comment, reply, edit within the window and delete", async ({ browser, page }) => {
  // Visitors and unverified accounts are told what they need first.
  await page.goto(`${PROFILE}#comentarios`);
  await expect(commentsSection(page).getByRole("link", { name: "Inicia sesión" })).toBeVisible();
  const unverified = uniqueUser("nover");
  await register(page, unverified);
  await page.goto(`${PROFILE}#comentarios`);
  await expect(commentsSection(page)).toContainText("Confirma tu correo para comentar.");

  const { page: ana, user } = await verifiedUser(browser, "ana");
  const text = `Comentario de prueba ${user.username}`;
  await postComment(ana, text);
  const mine = commentBy(ana, user.username, text);
  await expect(mine).toBeVisible();

  await mine.getByRole("button", { name: "Responder" }).click();
  await commentsSection(ana).getByLabel(`Responder a ${user.username}`).fill("Una respuesta");
  await commentsSection(ana).getByRole("button", { name: "Publicar respuesta" }).click();
  await expect(commentBy(ana, user.username, "Una respuesta")).toBeVisible();

  await mine.getByRole("button", { name: "Editar" }).click();
  await commentsSection(ana).getByLabel("Editar comentario").fill(`${text}, corregido`);
  await commentsSection(ana).getByRole("button", { name: "Guardar cambios" }).click();
  const edited = commentBy(ana, user.username, `${text}, corregido`);
  await expect(edited).toContainText("editado");

  // Once the window has passed the edit option is gone.
  await withDb((db) =>
    db
      .update(comments)
      .set({ createdAt: new Date(Date.now() - 60 * 60_000) })
      .where(eq(comments.body, `${text}, corregido`)),
  );
  await ana.reload();
  await expect(edited).toBeVisible();
  await expect(edited.getByRole("button", { name: "Editar" })).toHaveCount(0);

  // Deleting keeps the reply in place under a placeholder.
  await edited.getByRole("button", { name: "Eliminar" }).click();
  await edited.getByRole("button", { name: "Sí, eliminar" }).click();
  await expect(commentBy(ana, user.username, text)).toHaveCount(0);
  await expect(commentBy(ana, user.username, "Una respuesta")).toBeVisible();
  await expect(commentsSection(ana).getByText("Comentario eliminado.").first()).toBeVisible();
});

test("reports auto-hide a comment until a moderator restores it", async ({ browser, page }) => {
  const admin = await staff(browser, "admin");
  const moderator = await staff(browser, "moderator");
  const author = await verifiedUser(browser, "autor");
  const reporter = await verifiedUser(browser, "rep");

  await saveSettings(admin.page, "Comentarios", (s) =>
    s.getByLabel("Reportes para ocultar un comentario").fill("1"),
  );
  try {
    const text = `Comentario reportable ${author.user.username}`;
    await postComment(author.page, text);
    await expect(commentBy(author.page, author.user.username, text)).toBeVisible();

    await reporter.page.goto(`${PROFILE}#comentarios`);
    const target = commentBy(reporter.page, author.user.username, text);
    await target.getByRole("button", { name: "Reportar" }).click();
    await reporter.page.getByLabel("Motivo del reporte").selectOption("abuse");
    await reporter.page.getByRole("button", { name: "Enviar reporte" }).click();
    await expect(commentsSection(reporter.page).getByRole("status")).toContainText("Gracias");

    await page.goto(`${PROFILE}#comentarios`);
    await threadLoaded(page);
    await expect(commentsSection(page).getByText(text)).toHaveCount(0);

    await moderator.page.goto("/admin/moderacion");
    const item = moderator.page.getByTestId("moderation-item").filter({ hasText: text });
    await expect(item).toContainText("Oculto");
    await expect(item).toContainText("Insultos, acoso o amenazas");
    await item.getByRole("button", { name: "Restaurar" }).click();
    await expect(item).toHaveCount(0);

    await page.reload();
    await expect(commentsSection(page).getByText(text)).toBeVisible();
  } finally {
    await saveSettings(admin.page, "Comentarios", (s) =>
      s.getByLabel("Reportes para ocultar un comentario").fill("3"),
    );
  }
});

test("banned users cannot post or sign in", async ({ browser }) => {
  const admin = await staff(browser, "admin");
  const banned = await verifiedUser(browser, "ban");
  const lingering = await verifiedUser(browser, "ses");

  const [{ id }] = await withDb((db) =>
    db.select({ id: users.id }).from(users).where(eq(users.email, banned.user.email)),
  );
  await admin.page.goto(`/admin/usuarios/${id}`);
  await admin.page.getByLabel("Motivo de la suspensión").fill("Spam reiterado");
  await admin.page.getByRole("button", { name: "Suspender cuenta" }).click();
  await expect(admin.page.getByText("Spam reiterado")).toBeVisible();

  // The ban ended every session; signing in again is refused.
  await banned.page.goto(`${PROFILE}#comentarios`);
  await expect(
    commentsSection(banned.page).getByRole("link", { name: "Inicia sesión" }),
  ).toBeVisible();
  await signIn(banned.page, banned.user.username, banned.user.password);
  await expect(banned.page.locator("p[role=alert]")).toHaveText("Esta cuenta está suspendida.");

  // A session that predates a ban still cannot post.
  await withDb((db) =>
    db
      .update(users)
      .set({ banned: true, banReason: "Prueba" })
      .where(eq(users.email, lingering.user.email)),
  );
  await lingering.page.goto(`${PROFILE}#comentarios`);
  await expect(commentsSection(lingering.page)).toContainText("Tu cuenta está suspendida");
  await expect(commentsSection(lingering.page).getByLabel("Escribe un comentario")).toHaveCount(0);
});

test("pre-moderation, registration and banner settings take effect", async ({ browser, page }) => {
  const admin = await staff(browser, "admin");
  const author = await verifiedUser(browser, "pre");

  await saveSettings(admin.page, "Comentarios", (s) =>
    s.getByLabel("Revisar cada comentario antes de publicarlo").check(),
  );
  try {
    const text = `Comentario moderado ${author.user.username}`;
    await postComment(author.page, text);
    await expect(commentsSection(author.page).getByRole("status")).toContainText(
      "pendiente de revisión",
    );
    await expect(commentBy(author.page, author.user.username, text)).toContainText(
      "Pendiente de revisión",
    );
    await page.goto(`${PROFILE}#comentarios`);
    await threadLoaded(page);
    await expect(commentsSection(page).getByText(text)).toHaveCount(0);

    await admin.page.goto("/admin/moderacion?vista=pendientes");
    await admin.page
      .getByTestId("moderation-item")
      .filter({ hasText: text })
      .getByRole("button", { name: "Aprobar" })
      .click();
    await page.reload();
    await expect(commentsSection(page).getByText(text)).toBeVisible();
  } finally {
    await saveSettings(admin.page, "Comentarios", (s) =>
      s.getByLabel("Revisar cada comentario antes de publicarlo").uncheck(),
    );
  }

  await saveSettings(admin.page, "Registro de cuentas", (s) =>
    s.getByLabel("Permitir crear cuentas nuevas").uncheck(),
  );
  try {
    await page.goto("/registro");
    await expect(page.getByText("El registro de cuentas nuevas está cerrado")).toBeVisible();
    await expect(page.getByLabel("Nombre de usuario")).toHaveCount(0);
  } finally {
    await saveSettings(admin.page, "Registro de cuentas", (s) =>
      s.getByLabel("Permitir crear cuentas nuevas").check(),
    );
  }
  await page.goto("/registro");
  await expect(page.getByLabel("Nombre de usuario")).toBeVisible();

  await saveSettings(admin.page, "Contenido", (s) =>
    s.getByLabel("Aviso destacado").fill("Aviso de prueba para el público"),
  );
  try {
    await page.goto("/");
    await expect(page.getByRole("note")).toHaveText("Aviso de prueba para el público");
  } finally {
    await saveSettings(admin.page, "Contenido", (s) => s.getByLabel("Aviso destacado").fill(""));
  }
  await page.goto("/");
  await expect(page.getByRole("note")).toHaveCount(0);
});

test("a correction reaches the inbox and becomes a research job", async ({ browser, page }) => {
  // `next dev` compiles a route on first use and Fast Refresh then reloads the
  // open page, which would swallow the click below; compile /feedback first.
  await page.request.get("/feedback");
  // The link next to each profile section prefills the form.
  await page.goto(PROFILE);
  await page.getByRole("link", { name: "Reportar un error en esta sección" }).nth(1).click();
  await expect(page).toHaveURL(/\/feedback\?politico=jose-pena&seccion=trayectoria$/);
  await expect(page.getByText("Sobre el perfil de José Peña")).toBeVisible();
  await expect(page.getByLabel("Sección del perfil")).toHaveValue("trayectoria");
  const message = `El periodo en el Senado empezó en 2016 (${Date.now()}).`;
  await page.getByLabel("Mensaje", { exact: true }).fill(message);
  await page
    .getByLabel("Fuente que respalda la corrección (opcional)")
    .fill("https://example.org/fuente");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.getByRole("status")).toContainText("Gracias, recibimos tu mensaje.");

  const admin = await staff(browser, "admin");
  await admin.page.goto("/admin/feedback");
  const item = admin.page.getByTestId("feedback-item").filter({ hasText: message });
  await expect(item).toContainText("Corrección de un perfil");
  await expect(item).toContainText("José Ramón Peña Ejemplo (Trayectoria)");
  await item.getByRole("button", { name: "Crear investigación de corrección" }).click();
  await expect(item.getByRole("link", { name: "ver trabajo" })).toBeVisible();

  await item.getByLabel("Nota de resolución").fill("Se pidió una nueva investigación.");
  await item.getByRole("button", { name: "Cerrar mensaje" }).click();
  await expect(item).toHaveCount(0);
  await admin.page.goto("/admin/feedback?estado=resueltos");
  await expect(admin.page.getByTestId("feedback-item").filter({ hasText: message })).toContainText(
    "Se pidió una nueva investigación.",
  );

  await admin.page.goto("/admin/auditoria?entidad=feedback");
  await expect(admin.page.getByTestId("audit-entry").first()).toContainText("feedback.set_status");

  // Leave the shared research queue as the research spec expects it.
  await withDb((db) =>
    db
      .update(researchJobs)
      .set({ status: "cancelled" })
      .where(eq(researchJobs.kind, "targeted_correction")),
  );
});
