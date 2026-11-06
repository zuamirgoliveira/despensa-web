import { expect, test } from "@playwright/test";
import { semViolacaoDeCsp, vigiarConsole, irParaTela } from "./util";

const ROTAS = ["/", "/importar", "/compras", "/despensa", "/precos", "/painel", "/gastos", "/ajustes", "/conferencia", "/lista", "/compra", "/resumo", "/mercados"];

test("manifest válido com ícones e share_target", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m).toMatchObject({ display: "standalone", lang: "pt-BR", start_url: "/", scope: "/" });
  expect(m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`)).toEqual(
    expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]),
  );
  expect(m.share_target).toEqual({ action: "/importar", method: "GET", params: { title: "title", text: "text", url: "url" } });
  for (const i of m.icons) expect((await request.get(i.src)).ok()).toBe(true);
});

test("share_target abre /importar com o texto na URL", async ({ page }) => {
  await page.goto("/importar?text=ola");
  await expect(page.getByRole("heading", { name: "Importar" })).toBeVisible();
  await expect(page.getByLabel("Texto copiado da página da SEFAZ")).toHaveValue("ola");
  await expect(page).toHaveURL(/\/importar$/); // a URL é limpa depois de receber o texto
});

test("service worker: todas as rotas funcionam offline, inclusive ao recarregar", async ({ page, context }) => {
  const { erros } = vigiarConsole(page);
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // espera o SW assumir o controle da página
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  for (const r of ROTAS) await page.goto(r); // aquece o cache online

  await context.setOffline(true);

  for (const r of ROTAS) {
    await page.goto(r);
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
  }

  // navegação interna pelas abas, sem rede
  await page.goto("/importar");
  await irParaTela(page, "Compras");
  await expect(page).toHaveURL(/\/compras$/);
  await expect(page.getByRole("heading", { name: "Compras" })).toBeVisible();
  await irParaTela(page, "Preços");
  await expect(page.getByRole("heading", { name: "Preços" })).toBeVisible();

  semViolacaoDeCsp(erros);
  expect(erros.filter((e) => !/Failed to load resource|net::ERR|Failed to fetch RSC payload/i.test(e))).toEqual([]);
});
