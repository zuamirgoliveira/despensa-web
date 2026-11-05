import { expect, test } from "@playwright/test";
import { restaurarBackupPelaTela, semViolacaoDeCsp, vigiarConsole } from "./util";

test("sem compras: estado vazio", async ({ page }) => {
  await page.goto("/gastos");
  await expect(page.getByText("Nenhum gasto ainda")).toBeVisible();
});

test("com 3 meses de dados (seed): custo real, categorias, deslocamento e inflação pessoal", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  // 12 semanas de compras terminando em "hoje" (ver scripts/seed-dev.mjs)
  // @ts-expect-error módulo .mjs de script, sem tipos
  const { gerarSeed } = await import("../scripts/seed-dev.mjs");
  await page.goto("/ajustes");
  await restaurarBackupPelaTela(page, {
    name: "seed.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(gerarSeed(new Date()))),
  });
  await expect(page.getByText(/Restaurado: 12 compras/)).toBeVisible();

  await page.goto("/gastos");
  await expect(page.getByRole("heading", { name: "Custo real por mês" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Custo real por mês:/ })).toBeVisible();
  await expect(page.getByLabel("Inflação pessoal", { exact: true })).toContainText("Variação do custo de uma cesta fixa");
  await expect(page.getByRole("img", { name: /^Inflação pessoal mês a mês:/ })).toBeVisible();
  await expect(page.getByLabel("Inflação pessoal", { exact: true }).getByText(/^\+\d+,\d%$/).first()).toBeVisible(); // preços do seed sobem

  // o mês mais recente já vem aberto, com itens, deslocamento e categorias
  await expect(page.getByText(/Itens R\$ .* · deslocamento R\$ .* · \d+ compras?/).first()).toBeVisible();
  await expect(page.getByText("Mercearia").first()).toBeVisible();
  semViolacaoDeCsp(erros);
});
