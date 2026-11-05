import { expect, test } from "@playwright/test";
import { irParaTela, restaurarBackupPelaTela, semViolacaoDeCsp, vigiarConsole } from "./util";

// Dados de 3 meses e 2 mercados (scripts/seed-dev.mjs), importados como backup.
test("E2 com 3 meses e 2 mercados: histórico, comparação, gastos e painel", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  // @ts-expect-error módulo .mjs de script, sem tipos
  const { gerarSeed } = await import("../scripts/seed-dev.mjs");
  await page.goto("/ajustes");
  await restaurarBackupPelaTela(page, { name: "seed.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(gerarSeed(new Date()))) });
  await expect(page.getByText(/Restaurado: 12 compras/)).toBeVisible();

  // histórico: variação em relação à compra anterior
  await irParaTela(page, "Preços");
  const tomate = page.getByRole("listitem").filter({ hasText: "Tomate" }).first();
  await expect(tomate.getByText(/[▲▼] \d+,\d%/)).toBeVisible();
  await tomate.getByText("Tomate").first().click();
  await expect(tomate.getByText(/Menor R\$ .* · maior R\$ .* · média R\$ /)).toBeVisible();

  // comparação entre os dois mercados e cesta com cobertura
  await page.getByRole("button", { name: "Comparar" }).click();
  const cesta = page.getByLabel("Cesta por mercado");
  await expect(cesta).toContainText("CIA SANTOS (seed)");
  await expect(cesta).toContainText("SUPERMERCADO EXEMPLO (seed)");
  await expect(cesta.getByText(/preços de \d+ de \d+ itens/).first()).toBeVisible();

  // gastos e inflação
  await irParaTela(page, "Gastos");
  await expect(page.getByRole("img", { name: /^Custo real por mês:/ })).toBeVisible();
  await expect(page.getByLabel("Inflação pessoal", { exact: true })).toContainText("cesta fixa");

  // painel: 12 idas no total espalhadas em 3 meses; o mês atual tem ao menos uma
  await irParaTela(page, "Painel");
  await expect(page.getByLabel("Gasto com deslocamento: valor do mês")).toBeVisible();
  await expect(page.getByLabel("Idas ao mercado: valor do mês")).toHaveText(/^[1-9]\d*(▲|▼|=)?$/);
  semViolacaoDeCsp(erros);
});
