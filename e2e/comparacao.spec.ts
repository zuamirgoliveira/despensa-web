import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { irParaTela, pularEstimativa, semViolacaoDeCsp, vigiarConsole } from "./util";

const NOTA_A = readFileSync("tests/fixtures/notas/cia-santos-hortifruti.txt", "utf8");
/** Outro mercado (CNPJ válido 11.222.333/0001-81), mesmos produtos, melão a R$ 6,00. */
const NOTA_B = NOTA_A.replace("CIA SANTOS DISTRIBUIDORA E IMPORTADORA DE HORTIFRUTI LTDA", "SACOLAO DO B")
  .replace("CNPJ: 08.868.231/0006-38", "CNPJ: 11.222.333/0001-81")
  .replace("Número: 68903 Série: 2", "Número: 1 Série: 1")
  .replace("2626 1108 8682 3100 0638 6500 2000 0689 0310 2077 8720", "2626 1111 2223 3300 0181 6500 1000 0000 0110 0000 0018")
  .replace("Vl. Unit.: 7,88", "Vl. Unit.: 6,00");

async function salvar(page: Page, texto: string) {
  await page.goto("/importar");
  await page.getByLabel("Texto copiado da página da SEFAZ").fill(texto);
  await page.getByRole("button", { name: "Ler nota" }).click();
  await page.getByRole("button", { name: "Salvar compra" }).click();
  await pularEstimativa(page);
}

test("com um só mercado, Comparar pede o segundo", async ({ page }) => {
  await salvar(page, NOTA_A);
  await page.goto("/precos");
  await page.getByRole("button", { name: "Comparar" }).click();
  await expect(page.getByText("Falta um segundo mercado")).toBeVisible();
});

test("2 mercados: melhor preço por produto, cesta com cobertura e sugestão de mercado preferido", async ({ page }) => {
  const { erros } = vigiarConsole(page);
  await salvar(page, NOTA_A);
  await salvar(page, NOTA_B);
  await page.goto("/precos");
  await page.getByRole("button", { name: "Comparar" }).click();

  const cesta = page.getByLabel("Cesta por mercado");
  await expect(cesta).toContainText("SACOLAO DO B");
  await expect(cesta).toContainText("CIA SANTOS");
  await expect(cesta.getByText("preços de 16 de 16 itens")).toHaveCount(2);

  const melao = page.getByRole("listitem").filter({ hasText: "Melao Japones" }).first();
  await melao.getByText("Melao Japones").first().click();
  await expect(melao.getByText("melhor")).toBeVisible();
  await expect(melao.getByText("R$ 6,00/kg")).toBeVisible();
  await expect(melao.getByText("R$ 7,88/kg")).toBeVisible();
  await expect(melao.getByText(/SACOLAO DO B é 24% mais barato/)).toBeVisible();

  // aceitar a sugestão grava o mercado preferido (e some a sugestão)
  await melao.getByRole("button", { name: /Definir SACOLAO DO B como preferido/ }).click();
  await expect(page.getByText("Mercado preferido de Melao Japones definido.")).toBeVisible();
  await expect(melao.getByText(/é 24% mais barato/)).toHaveCount(0);

  // a despensa mostra o preferido
  await irParaTela(page, "Despensa");
  const naDespensa = page.getByRole("listitem").filter({ hasText: "Melao Japones" }).first();
  await naDespensa.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Mercado preferido")).not.toHaveValue("");
  semViolacaoDeCsp(erros);
});

test("a janela de comparação é editável em Ajustes", async ({ page }) => {
  await page.goto("/ajustes");
  await expect(page.getByLabel("Janela de comparação de preços (dias)")).toHaveValue("60");
  await page.getByLabel("Janela de comparação de preços (dias)").fill("90");
  await page.getByRole("button", { name: "Salvar regras e custos" }).click();
  await expect(page.getByText("Ajustes salvos.").first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Janela de comparação de preços (dias)")).toHaveValue("90");
});
