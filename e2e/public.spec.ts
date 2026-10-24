import { expect, type Page, test } from "@playwright/test";

// Data comes from seedPublicSiteData (e2e/support.ts): 7 fictional samples,
// 16 filler profiles, one draft and a ranking week with three ranked people.

function listNames(page: Page) {
  return page.getByTestId("politician-list").locator("li a[href^='/politicos/']");
}

async function search(
  page: Page,
  fields: { q?: string; partido?: string; cargo?: string; provincia?: string; orden?: string },
) {
  if (fields.q !== undefined) await page.getByLabel("Buscar por nombre").fill(fields.q);
  if (fields.partido)
    await page.getByLabel("Partido", { exact: true }).selectOption(fields.partido);
  if (fields.cargo) await page.getByLabel("Cargo actual").selectOption(fields.cargo);
  if (fields.provincia) await page.getByLabel("Provincia").selectOption(fields.provincia);
  if (fields.orden) await page.getByLabel("Ordenar por").selectOption(fields.orden);
  await page.getByRole("button", { name: "Buscar" }).click();
}

test.describe("public list", () => {
  test("ranks by the latest week, then by name, without the deceased", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Relevancia en noticias, actualizado semanalmente" }),
    ).toHaveAttribute("href", "/metodologia#ranking");
    await expect(page.getByRole("status")).toHaveText("22 políticos");
    await expect(listNames(page).nth(0)).toHaveText("Carlos Ficticio");
    await expect(listNames(page).nth(1)).toHaveText("María Núñez");
    await expect(listNames(page).nth(2)).toHaveText("José Peña");
    await expect(listNames(page).nth(3)).toHaveText("Ana Prueba");
    await expect(page.getByText("subió 2 puestos")).toBeAttached();
    await expect(page.getByText("sin datos recientes")).toBeVisible();
    await expect(page.getByRole("link", { name: "Rafael Difunto" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "José Borrador Oculto" })).toHaveCount(0);
  });

  test("searches without accents and keeps the state in the URL", async ({ page }) => {
    await page.goto("/");
    await search(page, { q: "jose" });
    await expect(page).toHaveURL(/\/\?q=jose$/);
    await expect(listNames(page)).toHaveText(["José Peña"]);

    await search(page, { q: "NUNEZ" });
    await expect(listNames(page)).toHaveText(["María Núñez"]);

    await search(page, { q: "difunto" });
    await expect(listNames(page)).toHaveText(["Rafael Difunto"]);
    await expect(page.getByText("Fallecido")).toBeVisible();

    await search(page, { q: "nadie se llama así" });
    await expect(page.getByText("No encontramos políticos con esos criterios.")).toBeVisible();
  });

  test("filters by party, role and province, alone and with search", async ({ page }) => {
    await page.goto("/");
    await search(page, { partido: "prm" });
    await expect(page).toHaveURL(/partido=prm/);
    await expect(listNames(page)).toHaveText(["José Peña", "Ana Prueba"]);

    await page.goto("/");
    await search(page, { cargo: "senado" });
    await expect(listNames(page)).toHaveText(["José Peña"]);

    await page.goto("/");
    await search(page, { cargo: "exfuncionario" });
    await expect(listNames(page)).toHaveText(["Ana Prueba"]);

    await page.goto("/");
    await search(page, { provincia: "la-vega" });
    await expect(listNames(page)).toHaveText(["María Núñez", "Luis Demo"]);

    await page.goto("/");
    await search(page, { q: "ana", provincia: "santiago" });
    await expect(page).toHaveURL(/\?q=ana&provincia=santiago$/);
    await expect(listNames(page)).toHaveText(["Ana Prueba"]);

    await page.goto("/");
    await search(page, { partido: "fp", cargo: "camara" });
    await expect(listNames(page)).toHaveText(["María Núñez"]);

    await page.getByRole("link", { name: "Quitar filtros" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel("Partido", { exact: true })).toHaveValue("");
  });

  test("restores filters from a shared URL", async ({ page }) => {
    await page.goto("/?q=pena&partido=prm&cargo=senado&provincia=santiago&orden=name");
    await expect(page.getByLabel("Buscar por nombre")).toHaveValue("pena");
    await expect(page.getByLabel("Partido", { exact: true })).toHaveValue("prm");
    await expect(page.getByLabel("Cargo actual")).toHaveValue("senado");
    await expect(page.getByLabel("Provincia")).toHaveValue("santiago");
    await expect(page.getByLabel("Ordenar por")).toHaveValue("name");
    await expect(listNames(page)).toHaveText(["José Peña"]);
  });

  test("sorts by name and paginates", async ({ page }) => {
    await page.goto("/");
    await search(page, { orden: "name" });
    await expect(page).toHaveURL(/\?orden=name$/);
    await expect(listNames(page).first()).toHaveText("Ana Prueba");
    await expect(listNames(page)).toHaveCount(20);

    const pagination = page.getByRole("navigation", { name: "Paginación" });
    await expect(pagination).toContainText("Página 1 de 2");
    await pagination.getByRole("link", { name: "Siguiente →" }).click();
    await expect(page).toHaveURL(/\?orden=name&pagina=2$/);
    await expect(pagination).toContainText("Página 2 de 2");
    await expect(listNames(page)).toHaveText(["Persona de Relleno 15", "Persona de Relleno 16"]);
    await pagination.getByRole("link", { name: "← Anterior" }).click();
    await expect(page).toHaveURL(/\?orden=name$/);
  });
});

test.describe("profile page", () => {
  test("renders every section with numbered footnotes linked to sources", async ({ page }) => {
    await page.goto("/politicos/jose-pena");
    await expect(page).toHaveTitle("José Peña · Políticos RD");
    await expect(page.getByRole("heading", { level: 1, name: "José Peña" })).toBeVisible();
    for (const section of [
      "Resumen",
      "Trayectoria",
      "Partidos y alianzas",
      "Leyes e iniciativas",
      "Declaraciones e influencias",
      "Controversias",
      "Fuentes",
      "Última actualización",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name: section })).toBeVisible();
    }
    await expect(page.getByTestId("current-roles")).toHaveText("Senador, Santiago");
    await expect(page.getByRole("link", { name: "PRM" }).first()).toHaveAttribute(
      "href",
      "/partidos/prm",
    );

    const footnote = page.getByRole("link", { name: "fuente [1]" }).first();
    await expect(footnote).toHaveAttribute("href", "#fuente-1");
    await footnote.click();
    await expect(page).toHaveURL(/#fuente-1$/);

    const first = page.locator("#fuente-1");
    await expect(
      first.getByRole("link", { name: "Artículo de ejemplo 1 sobre jose-pena", exact: true }),
    ).toHaveAttribute("href", "https://example.org/muestra/jose-pena/1");
    await expect(first.getByRole("link", { name: /copia archivada/ })).toHaveAttribute(
      "href",
      /^https:\/\/web\.archive\.org\//,
    );
    await expect(page.locator("#fuente-3").getByRole("link")).toHaveAttribute(
      "href",
      "https://example.org/muestra/jose-pena/3",
    );
    await expect(
      page.locator("#fuente-3").getByRole("link", { name: /copia archivada/ }),
    ).toHaveCount(0);

    await expect(
      page.getByRole("link", { name: "Reportar un error / Derecho de réplica" }),
    ).toHaveAttribute("href", "/feedback?politico=jose-pena");
    await expect(page.getByText("Datos de muestra ficticios")).toBeVisible();
  });

  test("marks deceased people", async ({ page }) => {
    await page.goto("/politicos/rafael-difunto");
    await expect(page.getByText(/Persona fallecida \(marzo de 2025\)/)).toBeVisible();
  });

  // `next build` serves these with a 404 status (ensureStatic on the route);
  // `next dev` streams the same not-found page with a 200, so check the page.
  test("shows the not-found page for drafts and unknown profiles", async ({ page }) => {
    for (const slug of ["borrador-oculto", "no-existe"]) {
      await page.goto(`/politicos/${slug}`);
      await expect(page.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
      await expect(page.locator('meta[name="robots"][content="noindex"]').first()).toBeAttached();
      await expect(page.getByText("José Borrador Oculto")).toHaveCount(0);
    }
  });
});

test.describe("party, province and SEO routes", () => {
  test("party and province pages list the right people", async ({ page }) => {
    await page.goto("/partidos/prm");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Partido Revolucionario Moderno (PRM)",
    );
    await expect(listNames(page)).toHaveText(["José Peña", "Ana Prueba"]);
    await expect(page.getByLabel("Partido", { exact: true })).toHaveCount(0);
    await search(page, { cargo: "senado" });
    await expect(page).toHaveURL(/\/partidos\/prm\?cargo=senado$/);
    await expect(listNames(page)).toHaveText(["José Peña"]);

    await page.goto("/provincias/la-vega");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("La Vega");
    await expect(listNames(page)).toHaveText(["María Núñez", "Luis Demo"]);
  });

  test("serves sitemap, robots and social images", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/politicos/jose-pena</loc>");
    expect(sitemap).toContain("/partidos/prm</loc>");
    expect(sitemap).toContain("/provincias/la-vega</loc>");
    expect(sitemap).not.toContain("borrador-oculto");

    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);

    for (const path of ["/opengraph-image", "/politicos/jose-pena/opengraph-image"]) {
      const image = await request.get(path);
      expect(image.status()).toBe(200);
      expect(image.headers()["content-type"]).toBe("image/png");
    }
  });
});
